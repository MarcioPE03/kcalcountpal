import { describe, expect, it } from "vitest";
import {
  MAX_SELECCION_ENT, claveEntrenamiento, dedupRecientesEntrenamientos, escalarEntrenamiento, fechaValidaOHoy,
  favoritoEntrenamientoDesde, filasEntrenamientoParaRegistrar,
} from "./mis-entrenamientos";
import { ordenarComidas, validarQuemadas } from "./nutri";

describe("ordenarComidas", () => {
  it("desayuno cargado después de una merienda de las 20:00 va primero", () => {
    const r = ordenarComidas([
      { id: "m", momento: "merienda", created_at: "2026-11-08T20:00:00Z" },
      { id: "d", momento: "desayuno", created_at: "2026-11-08T21:00:00Z" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["d", "m"]);
  });
  it("dentro del momento por created_at y desconocidos al final", () => {
    const r = ordenarComidas([
      { id: "x", momento: null, created_at: "2026-11-08T01:00:00Z" },
      { id: "a2", momento: "almuerzo", created_at: "2026-11-08T13:00:00Z" },
      { id: "a1", momento: "almuerzo", created_at: "2026-11-08T12:00:00Z" },
      { id: "z", momento: "otro", created_at: "2026-11-08T00:00:00Z" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["a1", "a2", "z", "x"]);
  });
});

describe("clave y recientes", () => {
  it("misma nombre y kcal con distinta duración son distintas", () => {
    expect(claveEntrenamiento("Pesas", 300, 45)).not.toBe(claveEntrenamiento("Pesas", 300, 60));
    expect(claveEntrenamiento("Pésas ", 300.4, null)).toBe(claveEntrenamiento("pesas", 300, null));
  });
  it("dedup deja el más nuevo", () => {
    const rows = [
      { id: "1", nombre: "Correr", calorias_quemadas: 400, duracion_min: 30, fecha: "2026-11-01", created_at: "a" },
      { id: "2", nombre: "correr", calorias_quemadas: 400, duracion_min: 30, fecha: "2026-11-05", created_at: "a" },
      { id: "3", nombre: "Correr", calorias_quemadas: 400, duracion_min: 45, fecha: "2026-11-02", created_at: "a" },
    ];
    expect(dedupRecientesEntrenamientos(rows).map((r) => r.id)).toEqual(["2", "3"]);
  });
});

describe("escalado seguro", () => {
  it("3000 kcal ×2 se rechaza sin recortar", () => {
    const v = escalarEntrenamiento({ nombre: "X", calorias_quemadas: 3000, duracion_min: null }, 2);
    expect(v.calorias_quemadas).toBe(6000);
    expect(v.error).not.toBeNull();
  });
  it("45 min ×1,5 da 68", () => {
    const v = escalarEntrenamiento({ nombre: "X", calorias_quemadas: 300, duracion_min: 45 }, 1.5);
    expect(v.duracion_min).toBe(68);
    expect(v.calorias_quemadas).toBe(450);
    expect(v.error).toBeNull();
  });
  it("1 kcal ×0,5 se rechaza", () => {
    expect(escalarEntrenamiento({ nombre: "X", calorias_quemadas: 1, duracion_min: null }, 0.5).error).not.toBeNull();
  });
});

describe("registro múltiple", () => {
  const item = { nombre: "Pesas", calorias_quemadas: 300, duracion_min: 60 };
  it("todas las filas en la fecha elegida", () => {
    const f = filasEntrenamientoParaRegistrar([{ clave: "a", item, factor: 1 }, { clave: "b", item: { ...item, nombre: "Correr" }, factor: 2 }], "2026-11-03");
    expect(f.every((x) => x.fecha === "2026-11-03")).toBe(true);
    expect(f[1]?.calorias_quemadas).toBe(600);
  });
  it("rechaza más de 10 y filas inválidas", () => {
    const muchas = Array.from({ length: MAX_SELECCION_ENT + 1 }, (_, i) => ({ clave: String(i), item, factor: 1 }));
    expect(() => filasEntrenamientoParaRegistrar(muchas, "2026-11-03")).toThrow();
    expect(() => filasEntrenamientoParaRegistrar([{ clave: "a", item: { ...item, calorias_quemadas: 3000 }, factor: 2 }], "2026-11-03")).toThrow();
  });
});

describe("favorito independiente", () => {
  it("es una copia de valores sin id del original", () => {
    const original = { id: "orig", nombre: " Pesas ", calorias_quemadas: 300, duracion_min: 45 };
    const fav = favoritoEntrenamientoDesde(original);
    expect(fav).toEqual({ clave: claveEntrenamiento("Pesas", 300, 45), nombre: "Pesas", calorias_quemadas: 300, duracion_min: 45 });
    expect("id" in fav).toBe(false);
  });
});

describe("fecha del enlace", () => {
  const hoy = "2026-11-08";
  it("malformada o futura usa hoy", () => {
    expect(fechaValidaOHoy("08/11/2026", hoy)).toBe(hoy);
    expect(fechaValidaOHoy("2026-02-30", hoy)).toBe(hoy);
    expect(fechaValidaOHoy("2026-11-09", hoy)).toBe(hoy);
    expect(fechaValidaOHoy(undefined, hoy)).toBe(hoy);
  });
  it("válida y pasada se respeta", () => {
    expect(fechaValidaOHoy("2026-11-03", hoy)).toBe("2026-11-03");
  });
});

describe("rango de kcal quemadas", () => {
  it("1–5000", () => {
    expect(validarQuemadas(0)).not.toBeNull();
    expect(validarQuemadas(5001)).not.toBeNull();
    expect(validarQuemadas(1)).toBeNull();
    expect(validarQuemadas(5000)).toBeNull();
  });
});
