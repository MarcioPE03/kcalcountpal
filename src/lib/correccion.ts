// Pure rules for "Corregir con IA": apply the model's per-row actions, preview diff, kcal range, undo stack.
import { z } from "zod";
import { filtrarDescartables } from "./analisis";
import { NUTRIENTES, crearIngrediente, normalizarCategoria, sumar, vacio, validarAtwater, type Ingrediente } from "./nutri";

export const MAX_INGREDIENTES_CORRECCION = 25;
export const MAX_ACLARACION = 500;

export const AccionIA = z.enum(["sin_cambios", "modificada", "nueva", "eliminada"]);

export const FilaCorreccionIA = z.object({
  id: z.string(),
  accion: AccionIA,
  nombre: z.string(),
  categoria: z.string(),
  gramos: z.number(),
  calorias: z.number(),
  proteinas: z.number(),
  carbohidratos: z.number(),
  grasas: z.number(),
  grasas_saturadas: z.number(),
  fibra: z.number(),
  azucares: z.number(),
  sodio_mg: z.number(),
  descartable: z.boolean(),
});

export const RespuestaCorreccionIA = z.object({
  pregunta: z.string().nullable(),
  cambios: z.array(z.string()),
  ingredientes: z.array(FilaCorreccionIA),
});
export type RespuestaCorreccionIA = z.infer<typeof RespuestaCorreccionIA>;

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A hand-edited row may change only when the clarification names it (any word of 4+ letters of its name). */
export function mencionaFila(aclaracion: string, nombre: string): boolean {
  const a = ` ${sinAcentos(aclaracion).replace(/[^a-z0-9ñ]+/g, " ")} `;
  return sinAcentos(nombre).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4).some((w) => a.includes(w));
}

function filaDesdeIA(id: string, f: z.infer<typeof FilaCorreccionIA>): Ingrediente {
  const v = vacio();
  for (const k of NUTRIENTES) v[k] = Math.max(0, Number.isFinite(f[k]) ? f[k] : 0);
  const gramos = Math.min(5000, Math.max(0, Number.isFinite(f.gramos) ? f.gramos : 0));
  // Atwater correction only on rows the AI touched.
  const at = validarAtwater(v);
  if (at.corregido) v.calorias = at.calorias;
  const ing = crearIngrediente(id, f.nombre.trim() || "Ingrediente", gramos, v, normalizarCategoria(f.categoria));
  return f.descartable ? { ...ing, descartable: true } : ing;
}

export type ResultadoCorreccion = { ingredientes: Ingrediente[]; pregunta: string | null; cambios: string[] };

/**
 * Applies the model's actions by id. Only `sin_cambios` keeps the exact previous row (flags included);
 * omitted rows are removed; unknown ids become new rows. Never matches rows by content.
 */
export function aplicarCorreccion(
  antes: Ingrediente[],
  r: RespuestaCorreccionIA,
  aclaracion: string,
  nombrePlato: string,
  nuevoId: () => string,
): ResultadoCorreccion {
  const previos = new Map(antes.map((i) => [i.id, i]));
  if (r.pregunta && r.pregunta.trim()) return { ingredientes: antes, pregunta: r.pregunta.trim(), cambios: [] };
  const out: Ingrediente[] = [];
  const tocadas = new Set<string>();
  const vistos = new Set<string>();
  for (const f of r.ingredientes.slice(0, MAX_INGREDIENTES_CORRECCION)) {
    const prev = previos.get(f.id);
    const protegida = prev?.editado_manual && !mencionaFila(aclaracion, prev.nombre);
    if (prev && vistos.has(prev.id)) continue;
    if (prev) vistos.add(prev.id);
    if (prev && (f.accion === "sin_cambios" || protegida)) { out.push(prev); continue; }
    if (f.accion === "eliminada") continue;
    if (!f.nombre.trim()) continue;
    const id = prev && f.accion === "modificada" ? prev.id : nuevoId();
    out.push(filaDesdeIA(id, f));
    tocadas.add(id);
  }
  // Protected hand-edited rows the AI omitted are kept.
  for (const prev of antes) {
    if (!vistos.has(prev.id) && prev.editado_manual && !mencionaFila(aclaracion, prev.nombre)) out.push(prev);
  }
  return { ingredientes: filtrarDescartables(nombrePlato, out, tocadas), pregunta: null, cambios: r.cambios.slice(0, 12) };
}

export type DiffCorreccion = {
  kcalAntes: number;
  kcalDespues: number;
  agregadas: Ingrediente[];
  modificadas: { antes: Ingrediente; despues: Ingrediente; manual: boolean }[];
  eliminadas: Ingrediente[];
  vacia: boolean;
  cambioGrande: boolean;
  sinCambios: boolean;
};

const igual = (a: Ingrediente, b: Ingrediente) =>
  a.nombre === b.nombre && a.gramos === b.gramos && (a.categoria ?? "") === (b.categoria ?? "") && NUTRIENTES.every((k) => a[k] === b[k]);

/** Preview computed by comparing the two lists (the AI's text is only an explanation). */
export function diffCorreccion(antes: Ingrediente[], despues: Ingrediente[]): DiffCorreccion {
  const nuevos = new Map(despues.map((i) => [i.id, i]));
  const viejos = new Map(antes.map((i) => [i.id, i]));
  const eliminadas = antes.filter((i) => !nuevos.has(i.id));
  const agregadas = despues.filter((i) => !viejos.has(i.id));
  const modificadas = despues
    .filter((i) => viejos.has(i.id) && !igual(viejos.get(i.id)!, i))
    .map((d) => ({ antes: viejos.get(d.id)!, despues: d, manual: !!viejos.get(d.id)!.editado_manual }));
  const kcalAntes = sumar(antes).calorias;
  const kcalDespues = sumar(despues).calorias;
  const cambioGrande = kcalAntes > 0 ? Math.abs(kcalDespues - kcalAntes) / kcalAntes > 0.5 : kcalDespues > 0;
  return {
    kcalAntes, kcalDespues, agregadas, modificadas, eliminadas,
    vacia: despues.length === 0, cambioGrande,
    sinCambios: !eliminadas.length && !agregadas.length && !modificadas.length,
  };
}

/** Scales the kcal range to the new total; null when there is no range or no previous total. */
export function escalarRango(min: number | null, max: number | null, totalAntes: number, totalDespues: number): { min: number | null; max: number | null } {
  if (min == null || max == null || !(totalAntes > 0)) return { min: null, max: null };
  const r = totalDespues / totalAntes;
  return { min: Math.round(min * r), max: Math.round(max * r) };
}

/** Undo stack (in memory). */
export function apilar<T>(hist: readonly T[], estado: T, max = 20): T[] {
  return [...hist, estado].slice(-max);
}
export function deshacer<T>(hist: readonly T[]): { anterior: T | undefined; resto: T[] } {
  return { anterior: hist[hist.length - 1], resto: hist.slice(0, -1) };
}
