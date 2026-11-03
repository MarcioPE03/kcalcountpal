export const LIMITE_ANALISIS_DEFECTO = 30;

export function limiteAlcanzado(usados: number, limite: number = LIMITE_ANALISIS_DEFECTO) {
  return usados >= limite;
}
