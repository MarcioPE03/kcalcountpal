import { useSyncExternalStore } from "react";
import { fechaLocal } from "./nutri";
import type { ResultadoAnalisis } from "./analisis";

function createStore<T>(initial: () => T) {
  let value: T | undefined;
  const subs = new Set<() => void>();
  const get = () => {
    if (value === undefined) value = initial();
    return value;
  };
  return {
    get,
    set(v: T) {
      value = v;
      subs.forEach((s) => s());
    },
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

// Selected day in "Hoy" (local date). Used by Agregar.
export const fechaStore = createStore<string>(() => fechaLocal());
export function useFechaSeleccionada(): [string, (f: string) => void] {
  const f = useSyncExternalStore(fechaStore.subscribe, fechaStore.get, fechaStore.get);
  return [f, fechaStore.set];
}

// Draft between analysis and review screens.
export type Borrador = {
  origen: "foto" | "texto";
  descripcion: string | null;
  foto: Blob | null;
  fotoUrl: string | null;
  resultado: ResultadoAnalisis;
};
export const borradorStore = createStore<Borrador | null>(() => null);
export function useBorrador() {
  return useSyncExternalStore(borradorStore.subscribe, borradorStore.get, borradorStore.get);
}
