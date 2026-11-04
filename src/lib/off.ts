// Pure Open Food Facts helpers: barcode validation, parsing, coherence checks, quantity math.
import { NUTRIENTES, vacio, type Nutrientes } from "./nutri";

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
  faltantes: string[];
  inconsistente: boolean;
};

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
  if (kcal === null || prot === null || carb === null || gras === null) return { ok: false, motivo: "sin_datos", nombre };

  const faltantes: string[] = [];
  const opt = (key: string, label: string) => {
    const v = num(n[key]);
    if (v === null) faltantes.push(label);
    return v ?? 0;
  };
  const sodio = sodioMgDe(n);
  if (sodio === null) faltantes.push("sodio");
  const por100: Nutrientes = {
    calorias: kcal,
    proteinas: prot,
    carbohidratos: carb,
    grasas: gras,
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
      inconsistente: kcalInconsistentes(por100, num(n["alcohol_100g"]) ?? 0),
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
