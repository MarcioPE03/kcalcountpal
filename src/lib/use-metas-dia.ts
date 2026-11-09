import { useQuery } from "@tanstack/react-query";
import { entrenamientosDiaQuery, metasQuery, perfilQuery, totalQuemadas } from "./data";
import { metasParaDia, modoValido } from "./nutri";

/** Effective goals for a local date. `listo` is false until goals, profile and workouts are loaded. */
export function useMetasDia(fecha: string) {
  const perfil = useQuery(perfilQuery());
  const metas = useQuery(metasQuery());
  const ent = useQuery(entrenamientosDiaQuery(fecha));
  const modo = modoValido(perfil.data?.modo_entrenamiento);
  const quemadas = totalQuemadas(ent.data ?? []);
  const listo = !!metas.data && !!perfil.data && !!ent.data;
  const r = metas.data
    ? metasParaDia({ metas: metas.data, modo, umbral: perfil.data?.umbral_entreno_kcal ?? 0, quemadasDelDia: quemadas, hayEntrenamiento: (ent.data?.length ?? 0) > 0 })
    : null;
  return { listo, modo, quemadas, metas: r?.metasEfectivas ?? null, esDiaEntreno: r?.esDiaEntreno ?? false, faltanEntreno: r?.faltanEntreno ?? false };
}
