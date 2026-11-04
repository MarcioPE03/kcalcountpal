// Pure rules for "Mis comidas": recent dedup, favourites keys, multiplier scaling, bulk rows.
import { NUTRIENTES, fmtFechaLarga, normalizarCategoria, sumarDias, sumar, type Ingrediente, type Momento, type Nutrientes } from "./nutri";

export const MAX_SELECCION = 20;
export const FACTOR_MIN = 0.1;
export const FACTOR_MAX = 10;
export const FACTORES_RAPIDOS = [0.5, 1, 1.5, 2] as const;

const COLS = {
  calorias: "calorias",
  proteinas: "proteinas_g",
  carbohidratos: "carbohidratos_g",
  grasas: "grasas_g",
  grasas_saturadas: "grasas_saturadas_g",
  fibra: "fibra_g",
  azucares: "azucares_g",
  sodio_mg: "sodio_mg",
} as const satisfies Record<keyof Nutrientes, string>;
type Col = (typeof COLS)[keyof typeof COLS];
type Num = number | string;

export type ItemComida = { nombre: string; ingredientes: unknown; categoria?: string | null; kcal_min?: Num | null; kcal_max?: Num | null; confianza?: string | null } & Record<Col, Num>;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Same normalized name + same rounded kcal = same meal. */
export function claveComida(nombre: string, kcal: Num): string {
  return `${norm(nombre)}|${Math.round(Number(kcal) || 0)}`;
}

export function coincideBusqueda(nombre: string, q: string): boolean {
  const k = norm(q);
  return !k || norm(nombre).includes(k);
}

/** Newest first by `fecha`, then `created_at`; keeps only the first of each key. */
export function dedupRecientes<T extends { nombre: string; calorias: Num; fecha: string; created_at: string }>(rows: T[]): T[] {
  const orden = [...rows].sort((a, b) => (a.fecha === b.fecha ? b.created_at.localeCompare(a.created_at) : b.fecha.localeCompare(a.fecha)));
  const vistos = new Set<string>();
  return orden.filter((r) => {
    const k = claveComida(r.nombre, r.calorias);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

export function etiquetaFecha(ymd: string, hoy: string): string {
  if (ymd === hoy) return "Hoy";
  if (ymd === sumarDias(hoy, -1)) return "Ayer";
  const s = fmtFechaLarga(ymd);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function agruparPorFecha<T extends { fecha: string }>(rows: T[], hoy: string): { fecha: string; titulo: string; items: T[] }[] {
  const out: { fecha: string; titulo: string; items: T[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.fecha === r.fecha) last.items.push(r);
    else out.push({ fecha: r.fecha, titulo: etiquetaFecha(r.fecha, hoy), items: [r] });
  }
  return out;
}

/** Parses "1,5" etc. Returns null if outside 0,1–10. */
export function validarFactor(v: string | number): number | null {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < FACTOR_MIN || n > FACTOR_MAX) return null;
  return n;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function esIngredienteCompleto(i: unknown): i is Ingrediente {
  return !!i && typeof i === "object" && "por_gramo" in i && "gramos" in i;
}

/** Ingredient list; when empty, a single ingredient carrying the item's category. */
export function ingredientesDe(item: ItemComida): Record<string, unknown>[] {
  const arr = Array.isArray(item.ingredientes) ? (item.ingredientes as Record<string, unknown>[]) : [];
  if (arr.length > 0) return arr;
  return [{ nombre: item.nombre, categoria: normalizarCategoria(item.categoria), calorias: Number(item.calorias) || 0 }];
}

export type Escalado = { ingredientes: Record<string, unknown>[]; kcal_min: number | null; kcal_max: number | null; confianza: string | null } & Record<Col, number>;

/** Multiplies kcal, the 8 nutrients, ingredient grams/values and kcal range; rounds only at the end. */
export function escalarComida(item: ItemComida, factor: number): Escalado {
  const ings = ingredientesDe(item);
  const completos = ings.every(esIngredienteCompleto);
  const nuevos = ings.map((i) => {
    const o: Record<string, unknown> = { ...i };
    const g = i["gramos"];
    if (typeof g === "number" || typeof g === "string") o["gramos"] = r1(Number(g) * factor);
    for (const k of NUTRIENTES) if (i[k] != null) o[k] = r1(Number(i[k]) * factor);
    return o;
  });
  const cols = {} as Record<Col, number>;
  if (completos) {
    const t = sumar(nuevos as unknown as Nutrientes[]);
    for (const k of NUTRIENTES) cols[COLS[k]] = t[k];
  } else {
    for (const k of NUTRIENTES) cols[COLS[k]] = r1(Number(item[COLS[k]]) * factor);
  }
  const rango = (v: Num | null | undefined) => (v == null ? null : Math.round(Number(v) * factor));
  return { ...cols, ingredientes: nuevos, kcal_min: rango(item.kcal_min), kcal_max: rango(item.kcal_max), confianza: item.confianza ?? null };
}

export type Seleccion = { clave: string; item: ItemComida; factor: number };

export type FilaNueva = { fecha: string; momento: Momento; nombre: string; origen: "copia"; descripcion: null } & Escalado;

/** Rows to insert for the chosen day/moment; independent from the original meal row. */
export function filasParaRegistrar(sel: Seleccion[], fecha: string, momento: Momento): FilaNueva[] {
  return sel.slice(0, MAX_SELECCION).map((s) => ({
    fecha,
    momento,
    nombre: s.item.nombre,
    origen: "copia",
    descripcion: null,
    ...escalarComida(s.item, s.factor),
  }));
}

/** Value copy for the favoritos table; never stores the source meal id. */
export function favoritoDesde(item: ItemComida) {
  const ings = ingredientesDe(item);
  const cat = ings.find((i) => i["categoria"])?.["categoria"] ?? item.categoria;
  const cols = {} as Record<Col, number>;
  for (const k of NUTRIENTES) cols[COLS[k]] = Math.max(0, Number(item[COLS[k]]) || 0);
  return { clave: claveComida(item.nombre, item.calorias), nombre: item.nombre.trim(), categoria: normalizarCategoria(cat), ingredientes: ings, ...cols };
}
