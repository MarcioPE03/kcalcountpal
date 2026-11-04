export const LIMITE_ANALISIS_DEFECTO = 30;
export const LIMITE_CATEGORIAS_DEFECTO = 100;
/** analisis_ia rows with this estado are category classifications, not photo/text analyses. */
export const ESTADO_CATEGORIA = "categoria";

export function limiteAlcanzado(usados: number, limite: number = LIMITE_ANALISIS_DEFECTO) {
  return usados >= limite;
}

/** Splits today's analisis_ia rows into the two independent quotas. */
export function contarCupos(estados: string[]) {
  const categorias = estados.filter((e) => e === ESTADO_CATEGORIA).length;
  return { analisis: estados.length - categorias, categorias };
}
