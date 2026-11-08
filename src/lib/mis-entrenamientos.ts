// Pure rules for workouts re-logging: key, recent dedup, safe scaling, bulk rows, favourite copies, date param.
import { fechaLocal, QUEMADAS_MAX, QUEMADAS_MIN } from "./nutri";
import { normTexto } from "./mis-comidas";

export const MAX_SELECCION_ENT = 10;

type Num = number | string;
export type ItemEnt = { nombre: string; calorias_quemadas: Num; duracion_min: number | null };

/** Normalized name + rounded kcal + rounded duration ("" when none). */
export function claveEntrenamiento(nombre: string, kcal: Num, dur: number | null | undefined): string {
  const d = dur == null || !Number.isFinite(Number(dur)) || Number(dur) <= 0 ? "" : String(Math.round(Number(dur)));
  return `${normTexto(nombre)}|${Math.round(Number(kcal) || 0)}|${d}`;
}
export const claveDe = (e: ItemEnt) => claveEntrenamiento(e.nombre, e.calorias_quemadas, e.duracion_min);

/** Newest first; keeps only the first of each key. */
export function dedupRecientesEntrenamientos<T extends ItemEnt & { fecha: string; created_at: string }>(rows: T[]): T[] {
  const orden = [...rows].sort((a, b) => (a.fecha === b.fecha ? b.created_at.localeCompare(a.created_at) : b.fecha.localeCompare(a.fecha)));
  const vistos = new Set<string>();
  return orden.filter((r) => {
    const k = claveDe(r);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

export type EntEscalado = { calorias_quemadas: number; duracion_min: number | null; error: string | null };

/** Rounds to integers; never clamps — out-of-range results carry an error. */
export function escalarEntrenamiento(e: ItemEnt, factor: number): EntEscalado {
  const rawK = Number(e.calorias_quemadas) * factor;
  const rawD = e.duracion_min == null ? null : e.duracion_min * factor;
  const kcal = Math.round(rawK);
  const dur = rawD == null ? null : Math.round(rawD);
  let error: string | null = null;
  // Range is checked on the unrounded value so rounding never turns 0,5 kcal into a valid 1.
  if (!Number.isFinite(rawK) || rawK < QUEMADAS_MIN || rawK > QUEMADAS_MAX) error = "Las kcal quedan fuera de 1–5000";
  else if (rawD != null && rawD < 1) error = "La duración queda en menos de 1 min";
  return { calorias_quemadas: kcal, duracion_min: dur, error };
}

export type SelEnt = { clave: string; item: ItemEnt; factor: number };

/** Rows to insert on `fecha`; throws if any row is invalid or too many are selected. */
export function filasEntrenamientoParaRegistrar(sel: SelEnt[], fecha: string) {
  if (sel.length === 0) throw new Error("Nada seleccionado");
  if (sel.length > MAX_SELECCION_ENT) throw new Error(`Máximo ${MAX_SELECCION_ENT}`);
  return sel.map((s) => {
    const v = escalarEntrenamiento(s.item, s.factor);
    if (v.error) throw new Error(v.error);
    return { fecha, nombre: s.item.nombre.trim(), calorias_quemadas: v.calorias_quemadas, duracion_min: v.duracion_min };
  });
}

/** Independent value copy for favoritos_entrenamientos (no source id). */
export function favoritoEntrenamientoDesde(e: ItemEnt) {
  const dur = e.duracion_min != null && e.duracion_min > 0 ? Math.round(e.duracion_min) : null;
  return { clave: claveEntrenamiento(e.nombre, e.calorias_quemadas, dur), nombre: e.nombre.trim(), calorias_quemadas: Math.round(Number(e.calorias_quemadas)), duracion_min: dur };
}

/** ?fecha= must be YYYY-MM-DD, a real date and not in the future (Buenos Aires); else today. */
export function fechaValidaOHoy(v: string | undefined, hoy: string = fechaLocal()): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return hoy;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return hoy;
  return v > hoy ? hoy : v;
}
