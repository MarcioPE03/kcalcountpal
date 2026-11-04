import { describe, expect, it } from "vitest";
import { agruparPorFecha, claveComida, dedupRecientes, escalarComida, favoritoDesde, filasParaRegistrar, validarFactor, type ItemComida } from "./mis-comidas";
import { caloriasPorCategoria, crearIngrediente, fechaLocal } from "./nutri";

const base = { proteinas_g: 10, carbohidratos_g: 20, grasas_g: 5, grasas_saturadas_g: 1, fibra_g: 2, azucares_g: 3, sodio_mg: 100 };
const row = (nombre: string, calorias: number, fecha: string, created_at: string) => ({ nombre, calorias, fecha, created_at });

describe("recientes", () => {
  it("deduplica por nombre normalizado + mismas kcal y ordena por fecha", () => {
    const r = dedupRecientes([
      row("Café con leche", 80, "2026-11-01", "2026-11-01T10:00:00Z"),
      row("cafe  con LECHE ", 80, "2026-11-03", "2026-11-03T10:00:00Z"),
      row("Café con leche", 120, "2026-11-02", "2026-11-02T10:00:00Z"),
    ]);
    expect(r.map((x) => [x.fecha, x.calorias])).toEqual([["2026-11-03", 80], ["2026-11-02", 120]]);
    expect(claveComida("Café", 80.4)).toBe(claveComida("cafe", 80));
  });
  it("una cena a las 22:00 en Buenos Aires se agrupa en su día, con Hoy/Ayer", () => {
    const fechaCena = fechaLocal(new Date("2026-11-04T01:00:00Z")); // 22:00 ART del 3/11
    expect(fechaCena).toBe("2026-11-03");
    const g = agruparPorFecha([row("Cena", 600, fechaCena, "2026-11-04T01:00:00Z")], "2026-11-04");
    expect(g[0].titulo).toBe("Ayer");
  });
});

describe("multiplicador", () => {
  const ing = crearIngrediente("a", "Arroz", 100, { calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3, grasas_saturadas: 0.1, fibra: 0.4, azucares: 0.1, sodio_mg: 1 });
  const item: ItemComida = { nombre: "Arroz", calorias: 130, ...base, proteinas_g: 2.7, ingredientes: [ing], kcal_min: 110, kcal_max: 150 };
  it("escala kcal, gramos, rango y deja el total = suma de ingredientes", () => {
    expect(escalarComida(item, 0.5).calorias).toBe(65);
    const x = escalarComida(item, 1.5);
    expect(x.calorias).toBe(195);
    expect(x.ingredientes[0].gramos).toBe(150);
    expect(x.kcal_min).toBe(165);
    expect(escalarComida(item, 2).proteinas_g).toBe(5.4);
  });
  it("valida el factor con coma decimal", () => {
    expect(validarFactor("1,5")).toBe(1.5);
    expect(validarFactor("0")).toBeNull();
    expect(validarFactor("11")).toBeNull();
  });
});

describe("favoritos y registro múltiple", () => {
  it("el favorito es una copia de valores: sobrevive al borrado de la comida", () => {
    const comida = { id: "c1", nombre: "Tostadas", calorias: 200, ...base, ingredientes: [] as unknown[] };
    const fav = favoritoDesde(comida);
    expect(fav).not.toHaveProperty("id");
    comida.calorias = 0; // la comida original cambia / se borra
    const filas = filasParaRegistrar([{ clave: fav.clave, item: fav, factor: 1 }], "2026-11-04", "desayuno");
    expect(filas[0].calorias).toBe(200);
  });
  it("favorito manual de Lácteos y huevos cuenta como lácteos en estadísticas", () => {
    const fav = { ...favoritoDesde({ nombre: "Yogur", calorias: 150, ...base, ingredientes: [], categoria: "Lácteos y huevos" }), ingredientes: [] };
    const filas = filasParaRegistrar([{ clave: fav.clave, item: fav, factor: 1 }], "2026-11-04", "merienda");
    expect(caloriasPorCategoria(filas)["Lácteos y huevos"]).toBe(150);
  });
  it("guarda N comidas en la fecha y momento elegidos", () => {
    const a = { nombre: "A", calorias: 100, ...base, ingredientes: [] };
    const filas = filasParaRegistrar([{ clave: "a", item: a, factor: 1 }, { clave: "b", item: { ...a, nombre: "B" }, factor: 2 }], "2026-11-03", "cena");
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.fecha === "2026-11-03" && f.momento === "cena" && f.origen === "copia")).toBe(true);
    expect(filas[1].calorias).toBe(200);
  });
});
