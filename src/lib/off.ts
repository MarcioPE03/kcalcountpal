// Pure Open Food Facts helpers: barcode validation, parsing, coherence checks, quantity math.
import { NUTRIENTES, vacio, type NutrienteKey, type Nutrientes } from "./nutri";

/** Valid EAN-13, EAN-8 or UPC-A (12 digits) with a correct check digit. */
export function codigoValido(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop()!;
  let sum = 0;
  // Weights 3,1,3,1… starting from the rightmost digit before the check digit.
  for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += d[i]! * w;
  return (10 - (sum % 10)) % 10 === check;
}

export const OFF_FIELDS = [
  "code", "product_name", "product_name_es", "brands", "serving_size", "serving_quantity", "serving_quantity_unit",
  "nutriments.energy-kcal_100g,nutriments.energy-kj_100g,nutriments.proteins_100g,nutriments.carbohydrates_100g,nutriments.fat_100g,nutriments.saturated-fat_100g,nutriments.fiber_100g,nutriments.sugars_100g,nutriments.sodium_100g,nutriments.salt_100g,nutriments.alcohol_100g",
].join(",");

export const PORCION_MAX_G = 1000;

export type ProductoOFF = {
  codigo: string;
  nombre: string;
  /** Values per 100 g (or 100 ml). */
  por100: Nutrientes;
  porcion_g: number | null;
  porcion_ml: boolean;
  /** Secondary nutrients missing (counted as 0). */
  faltantes: string[];
  /** Main macros missing (counted as 0, highlighted in review). Optional for older drafts. */
  faltantesPrincipales?: NutrienteKey[];
  inconsistente: boolean;
  /** '100g': por100 is per 100 g. 'porcion': por100 holds per-serving values (serving weight unknown). */
  base?: Base;
  fuente?: Fuente;
  marca?: string | null;
  categoria?: string | null;
  /** Label reading only had "prepared" values. */
  soloPreparado?: boolean;
};

export type Base = "100g" | "porcion";
export type Fuente = "off" | "propio" | "etiqueta";

export type ParseOFF =
  | { ok: true; producto: ProductoOFF }
  | { ok: false; motivo: "sin_datos" | "invalido"; nombre: string | null };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function nombreProducto(p: Record<string, unknown>): string | null {
  const n = String(p["product_name_es"] || p["product_name"] || "").trim();
  const marca = String(p["brands"] || "").split(",")[0]?.trim();
  if (!n) return marca || null;
  return marca ? `${marca} · ${n}` : n;
}

/** kcal from label: kcal field, else kJ ÷ 4,184. Null when absent. */
export function kcalDe(n: Record<string, unknown>): number | null {
  const k = num(n["energy-kcal_100g"]);
  if (k !== null) return k;
  const kj = num(n["energy-kj_100g"]) ?? (n["energy_unit"] === "kJ" ? num(n["energy_100g"]) : null);
  return kj !== null ? Math.round((kj / 4.184) * 10) / 10 : null;
}

/** Sodium in mg: sodio_g × 1000, else sal_g × 400. Null when absent. */
export function sodioMgDe(n: Record<string, unknown>): number | null {
  const s = num(n["sodium_100g"]);
  if (s !== null) return Math.round(s * 1000);
  const sal = num(n["salt_100g"]);
  return sal !== null ? Math.round(sal * 400) : null;
}

/** Warning only when diff > 25 % AND > 20 kcal per 100 g. Alcohol (% vol) adds 7 kcal/g (0,789 g/ml). */
export function kcalInconsistentes(v: Pick<Nutrientes, "calorias" | "proteinas" | "carbohidratos" | "grasas">, alcoholVol = 0): boolean {
  const est = 4 * v.proteinas + 4 * v.carbohidratos + 9 * v.grasas + 7 * alcoholVol * 0.789;
  const diff = Math.abs(v.calorias - est);
  const base = Math.max(v.calorias, est);
  return diff > 20 && base > 0 && diff / base > 0.25;
}

export function datosInvalidos(v: Pick<Nutrientes, "calorias" | "proteinas" | "carbohidratos" | "grasas">): boolean {
  return v.proteinas + v.carbohidratos + v.grasas > 105 || v.calorias > 900 || v.calorias < 0;
}

export function porcionDe(p: Record<string, unknown>): { g: number | null; ml: boolean } {
  const q = num(p["serving_quantity"]);
  const unit = String(p["serving_quantity_unit"] || "").toLowerCase();
  const size = String(p["serving_size"] || "").toLowerCase();
  const ml = unit === "ml" || (!unit && /\bml\b/.test(size));
  if (q === null || q <= 0 || q > PORCION_MAX_G) return { g: null, ml: false };
  return { g: q, ml };
}

export function parseProducto(codigo: string, p: Record<string, unknown> | null | undefined): ParseOFF {
  if (!p) return { ok: false, motivo: "sin_datos", nombre: null };
  const nombre = nombreProducto(p);
  const n = (p["nutriments"] ?? {}) as Record<string, unknown>;
  const kcal = kcalDe(n);
  const prot = num(n["proteins_100g"]);
  const carb = num(n["carbohydrates_100g"]);
  const gras = num(n["fat_100g"]);
  const macrosCompletos = prot !== null && carb !== null && gras !== null;
  if (kcal === null && !macrosCompletos) return { ok: false, motivo: "sin_datos", nombre };
  const faltantesPrincipales: NutrienteKey[] = [];
  if (prot === null) faltantesPrincipales.push("proteinas");
  if (carb === null) faltantesPrincipales.push("carbohidratos");
  if (gras === null) faltantesPrincipales.push("grasas");
  const kcalFinal = kcal ?? Math.round((4 * prot! + 4 * carb! + 9 * gras!) * 10) / 10;

  const faltantes: string[] = [];
  const opt = (key: string, label: string) => {
    const v = num(n[key]);
    if (v === null) faltantes.push(label);
    return v ?? 0;
  };
  const sodio = sodioMgDe(n);
  if (sodio === null) faltantes.push("sodio");
  const por100: Nutrientes = {
    calorias: kcalFinal,
    proteinas: prot ?? 0,
    carbohidratos: carb ?? 0,
    grasas: gras ?? 0,
    grasas_saturadas: opt("saturated-fat_100g", "grasas saturadas"),
    fibra: opt("fiber_100g", "fibra"),
    azucares: opt("sugars_100g", "azúcares"),
    sodio_mg: sodio ?? 0,
  };
  if (datosInvalidos(por100)) return { ok: false, motivo: "invalido", nombre };
  const porcion = porcionDe(p);
  return {
    ok: true,
    producto: {
      codigo,
      nombre: nombre || "Producto",
      por100,
      porcion_g: porcion.g,
      porcion_ml: porcion.ml,
      faltantes,
      faltantesPrincipales,
      inconsistente: faltantesPrincipales.length === 0 && kcalInconsistentes(por100, num(n["alcohol_100g"]) ?? 0),
      base: "100g",
      fuente: "off",
      marca: String(p["brands"] || "").split(",")[0]?.trim() || null,
    },
  };
}

/** Grams for a quantity in grams or (fractional) servings. */
export function gramosDe(modo: "gramos" | "porciones", cantidad: number, porcion_g: number | null): number {
  const c = Math.max(0, cantidad || 0);
  if (modo === "porciones" && porcion_g) return Math.round(c * porcion_g * 10) / 10;
  return c;
}

export function valoresPara(por100: Nutrientes, gramos: number): Nutrientes {
  const v = vacio();
  for (const k of NUTRIENTES) v[k] = Math.round(((por100[k] * gramos) / 100) * 10) / 10;
  return v;
}

/** Every code is stored/queried as EAN-13: UPC-A gets one leading 0, EAN-8 is left-padded to 13. */
export function normalizarCodigo(code: string): string {
  const c = code.replace(/\s/g, "");
  return c.length >= 13 ? c : c.padStart(13, "0");
}

/** A product/meal can be saved only when its kcal are known or derivable from the 3 macros. */
export function puedeGuardar(v: Partial<Record<NutrienteKey, number | null>>): boolean {
  const ok = (x: number | null | undefined) => typeof x === "number" && Number.isFinite(x) && x >= 0;
  return ok(v.calorias) || (ok(v.proteinas) && ok(v.carbohidratos) && ok(v.grasas));
}

/** Converts values for one serving of `porcion_g` grams (ml = g) into values per 100 g. */
export function aPor100(v: Nutrientes, porcion_g: number): Nutrientes {
  const out = vacio();
  for (const k of NUTRIENTES) out[k] = Math.round(((v[k] * 100) / porcion_g) * 10) / 10;
  return out;
}

/** Nutrients for a quantity: grams for base '100g', servings for base 'porcion'. */
export function valoresProducto(p: Pick<ProductoOFF, "por100" | "base">, gramosOPorciones: number): Nutrientes {
  return p.base === "porcion" ? valoresPara(p.por100, gramosOPorciones * 100) : valoresPara(p.por100, gramosOPorciones);
}

/** User's own product always wins over Open Food Facts. */
export function resolverProducto<T>(propio: T | null | undefined, off: T | null | undefined): { producto: T; fuente: "propio" | "off" } | null {
  if (propio) return { producto: propio, fuente: "propio" };
  if (off) return { producto: off, fuente: "off" };
  return null;
}

export type FilaProductoPropio = {
  codigo: string; nombre: string; marca: string | null; categoria: string; base: string;
  porcion_g: number | null; porcion_ml: boolean;
} & Record<NutrienteKey, number | null>;

export function productoDesdePropio(r: FilaProductoPropio): ProductoOFF {
  const por100 = vacio();
  const faltantesPrincipales: NutrienteKey[] = [];
  const faltantes: string[] = [];
  for (const k of NUTRIENTES) {
    const v = r[k];
    if (v === null || v === undefined) {
      if (k === "proteinas" || k === "carbohidratos" || k === "grasas") faltantesPrincipales.push(k);
      else if (k !== "calorias") faltantes.push(k);
    }
    por100[k] = Number(v ?? 0);
  }
  return {
    codigo: r.codigo, nombre: r.nombre, por100, porcion_g: r.porcion_g ? Number(r.porcion_g) : null, porcion_ml: r.porcion_ml,
    faltantes, faltantesPrincipales, inconsistente: false, base: r.base === "porcion" ? "porcion" : "100g",
    fuente: "propio", marca: r.marca, categoria: r.categoria,
  };
}

// ---------- Nutrition label reading (AI output → normalized product) ----------

export type LecturaEtiqueta = {
  es_etiqueta: boolean;
  nombre: string | null;
  columna: "100g" | "porcion" | null;
  porcion_cantidad: number | null;
  porcion_unidad: "g" | "ml" | "unidad" | null;
  solo_preparado: boolean;
  kcal: number | null;
  kj: number | null;
  proteinas: number | null;
  carbohidratos: number | null;
  grasas: number | null;
  grasas_saturadas: number | null;
  fibra: number | null;
  azucares: number | null;
  sodio_mg: number | null;
  sal_g: number | null;
};

/** null = not on the label; 0 = label says 0 / "no aporta cantidades significativas". */
export function normalizarEtiqueta(codigo: string, l: LecturaEtiqueta, nombreFallback?: string | null): ParseOFF {
  const nombre = l.nombre?.trim() || nombreFallback || null;
  if (!l.es_etiqueta) return { ok: false, motivo: "sin_datos", nombre };
  const n: Record<string, unknown> = {
    "energy-kcal_100g": l.kcal, "energy-kj_100g": l.kj,
    proteins_100g: l.proteinas, carbohydrates_100g: l.carbohidratos, fat_100g: l.grasas,
    "saturated-fat_100g": l.grasas_saturadas, fiber_100g: l.fibra, sugars_100g: l.azucares,
    sodium_100g: l.sodio_mg === null ? null : l.sodio_mg / 1000, salt_100g: l.sal_g,
  };
  const porcionG = l.porcion_cantidad && l.porcion_cantidad > 0 && l.porcion_cantidad <= PORCION_MAX_G && (l.porcion_unidad === "g" || l.porcion_unidad === "ml")
    ? l.porcion_cantidad : null;
  const porcionMl = l.porcion_unidad === "ml";
  if (l.columna !== "porcion") {
    const r = parseProducto(codigo, { product_name: nombre ?? "", nutriments: n });
    if (!r.ok) return r;
    return { ok: true, producto: { ...r.producto, nombre: nombre || "Producto", porcion_g: porcionG, porcion_ml: porcionMl, fuente: "etiqueta", marca: null, soloPreparado: l.solo_preparado } };
  }
  // Per-serving values: invalid-check after scaling (per-serving values can legitimately exceed 100 g caps).
  const rs = parsePorcion(codigo, n, nombre);
  if (!rs.ok) return rs;
  const p = rs.producto;
  if (porcionG) {
    const por100 = aPor100(p.por100, porcionG);
    if (datosInvalidos(por100)) return { ok: false, motivo: "invalido", nombre };
    return { ok: true, producto: { ...p, por100, porcion_g: porcionG, porcion_ml: porcionMl, base: "100g", inconsistente: (p.faltantesPrincipales ?? []).length === 0 && kcalInconsistentes(por100), soloPreparado: l.solo_preparado } };
  }
  return { ok: true, producto: { ...p, porcion_g: null, porcion_ml: false, base: "porcion", soloPreparado: l.solo_preparado } };
}

function parsePorcion(codigo: string, n: Record<string, unknown>, nombre: string | null): ParseOFF {
  // Reuse parseProducto with a huge-scale trick avoided: scale down by 10 to dodge the per-100 caps, then scale back.
  const scaled: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n)) scaled[k] = typeof v === "number" ? v / 10 : v;
  const r = parseProducto(codigo, { product_name: nombre ?? "", nutriments: scaled });
  if (!r.ok) return r;
  const por100 = vacio();
  for (const k of NUTRIENTES) por100[k] = Math.round(r.producto.por100[k] * 10 * 10) / 10;
  return { ok: true, producto: { ...r.producto, nombre: nombre || "Producto", por100, fuente: "etiqueta", marca: null } };
}
