export const LIMITE_ANALISIS_DEFECTO = 30;
export const LIMITE_CATEGORIAS_DEFECTO = 100;
/** analisis_ia rows with this estado are category classifications, not photo/text analyses. */
export const ESTADO_CATEGORIA = "categoria";

/** Failed/non-label readings are logged but never consume the analysis quota. */
export const ESTADO_ETIQUETA_FALLIDA = "etiqueta_fallida";

export function limiteAlcanzado(usados: number, limite: number = LIMITE_ANALISIS_DEFECTO) {
  return usados >= limite;
}

/** AI corrections: own quota (successful ones) plus a technical cap on attempts (every start counts). */
export const LIMITE_CORRECCIONES_DEFECTO = 50;
export const LIMITE_INTENTOS_CORRECCION = 150;
export const ESTADO_CORRECCION = "correccion";
export const ESTADO_CORRECCION_FALLIDA = "correccion_fallida";
export const ESTADO_CORRECCION_EN_CURSO = "correccion_en_curso";
const ESTADOS_CORRECCION = new Set([ESTADO_CORRECCION, ESTADO_CORRECCION_FALLIDA, ESTADO_CORRECCION_EN_CURSO]);

/** Splits today's analisis_ia rows into independent quotas. Corrections never count as analyses. */
export function contarCupos(estados: string[]) {
  const categorias = estados.filter((e) => e === ESTADO_CATEGORIA).length;
  const fallidas = estados.filter((e) => e === ESTADO_ETIQUETA_FALLIDA).length;
  const deCorreccion = estados.filter((e) => ESTADOS_CORRECCION.has(e)).length;
  return {
    analisis: estados.length - categorias - fallidas - deCorreccion,
    categorias,
    correcciones: estados.filter((e) => e === ESTADO_CORRECCION).length,
    intentosCorreccion: estados.filter((e) => e === ESTADO_CORRECCION_EN_CURSO).length,
  };
}

/** A correction is running when the latest start (< 2 min old) has no later finish row. */
export function correccionEnCurso(filas: { estado: string; created_at: string }[], ahora: number, ventanaMs = 120_000): boolean {
  const inicios = filas.filter((f) => f.estado === ESTADO_CORRECCION_EN_CURSO).map((f) => Date.parse(f.created_at));
  if (!inicios.length) return false;
  const ultimo = Math.max(...inicios);
  if (ahora - ultimo > ventanaMs) return false;
  return !filas.some((f) => (f.estado === ESTADO_CORRECCION || f.estado === ESTADO_CORRECCION_FALLIDA) && Date.parse(f.created_at) >= ultimo);
}
