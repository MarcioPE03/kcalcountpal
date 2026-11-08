import { describe, expect, it } from "vitest";
import {
  caloriasPorCategoria, diferenciaPeso, dominioPeso, fechaLocal, fmtDiferencia, macrosEscalados,
  normalizarCategoria, promedioDiario, rangoPeriodo, topCategorias, validarPeso,
} from "./nutri";
import { procesarRespuesta } from "./analisis";

describe("categorías", () => {
  it("categoría fuera de la lista se convierte en Otros", () => {
    expect(normalizarCategoria("Comida rápida")).toBe("Otros");
    expect(normalizarCategoria("lacteos y huevos")).toBe("Lácteos y huevos");
  });
  it("la IA con categoría inválida no rechaza el análisis", () => {
    const r = procesarRespuesta({
      es_comida: true, motivo_rechazo: null, nombre_plato: "Mate", confianza: "alta", kcal_min: 0, kcal_max: 0, nota: null,
      ingredientes: [{ nombre: "Yerba", categoria: "Infusiones", gramos: 10, calorias: 4, proteinas: 0, carbohidratos: 1, grasas: 0, grasas_saturadas: 0, fibra: 0, azucares: 0, sodio_mg: 0, descartable: false }],
    });
    expect(r.ingredientes[0]!.categoria).toBe("Otros");
  });
  it("reparte las kcal registradas en proporción y suma exacto", () => {
    const m = caloriasPorCategoria([
      { calorias: 600, ingredientes: [{ calorias: 200, categoria: "Carnes" }, { calorias: 100, categoria: "Aceites y grasas" }] },
      { calorias: 150, ingredientes: [] },
    ]);
    expect(m.Carnes).toBeCloseTo(400);
    expect(m["Aceites y grasas"]).toBeCloseTo(200);
    expect(m.Otros).toBe(150);
    expect(Object.values(m).reduce((s, v) => s + v, 0)).toBeCloseTo(750);
  });
  it("agrupa el resto en Otras", () => {
    const t = topCategorias({ a: 50, b: 20, c: 10, d: 10, e: 5, f: 3, g: 2 }, 5);
    expect(t.map((x) => x.nombre)).toEqual(["a", "b", "c", "d", "e", "Otras"]);
    expect(t[5]!.kcal).toBe(5);
  });
});

describe("estadísticas", () => {
  it("promedia solo días con comidas, sin contar días vacíos como 0", () => {
    const r = promedioDiario([
      { fecha: "2026-11-01", calorias: 1000 }, { fecha: "2026-11-01", calorias: 1000 }, { fecha: "2026-11-03", calorias: 1000 },
    ]);
    expect(r).toEqual({ promedio: 1500, dias: 2 });
  });
  it("macros escalados suman las kcal reales del día", () => {
    const m = macrosEscalados({ calorias: 1000, proteinas: 50, carbohidratos: 100, grasas: 20 }); // 4/4/9 = 780
    expect(m.proteinas + m.carbohidratos + m.grasas).toBeCloseTo(1000);
    expect(m.grasas / m.proteinas).toBeCloseTo(180 / 200);
  });
  it("semana lunes a domingo y mes completo", () => {
    expect(rangoPeriodo("semana", "2026-11-03")).toMatchObject({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(rangoPeriodo("mes", "2026-02-10").dias).toHaveLength(28);
  });
});

describe("peso", () => {
  it("valida rango 25–300 kg y fecha no futura", () => {
    expect(validarPeso(24, "2026-11-03", "2026-11-03")).not.toBeNull();
    expect(validarPeso(301, "2026-11-03", "2026-11-03")).not.toBeNull();
    expect(validarPeso(70, "2026-11-04", "2026-11-03")).not.toBeNull();
    expect(validarPeso(70, "2026-11-03", "2026-11-03")).toBeNull();
  });
  it("'hoy' es Buenos Aires: 23:30 del 3/11 ART no pasa al 4", () => {
    expect(fechaLocal(new Date("2026-11-04T02:30:00Z"))).toBe("2026-11-03");
  });
  it("diferencia funciona para bajar y para subir", () => {
    expect(diferenciaPeso([{ fecha: "2026-10-01", peso_kg: 80 }, { fecha: "2026-11-01", peso_kg: 76.5 }])).toBe(-3.5);
    expect(diferenciaPeso([{ fecha: "2026-11-01", peso_kg: 62 }, { fecha: "2026-10-01", peso_kg: 60 }])).toBe(2);
    expect(fmtDiferencia(-3.5)).toBe("-3,5 kg");
  });
  it("eje Y no arranca en cero e incluye la meta", () => {
    const [a, b] = dominioPeso([80, 78], 70);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(70);
    expect(b).toBeGreaterThan(80);
  });
});
