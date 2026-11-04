import { describe, expect, it } from "vitest";
import { codigoValido, gramosDe, kcalDe, parseProducto, porcionDe, sodioMgDe, valoresPara } from "./off";
import { contarCupos, limiteAlcanzado } from "./limits";

const prod = (n: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ product_name: "X", nutriments: n, ...extra });

describe("código de barras", () => {
  it("valida dígito verificador EAN-13, EAN-8 y UPC-A", () => {
    expect(codigoValido("7790070318725")).toBe(true);
    expect(codigoValido("7790070318726")).toBe(false);
    expect(codigoValido("96385074")).toBe(true);
    expect(codigoValido("036000291452")).toBe(true);
    expect(codigoValido("036000291453")).toBe(false);
    expect(codigoValido("12345")).toBe(false);
  });
});

describe("unidades OFF", () => {
  it("kJ ÷ 4,184 cuando falta kcal", () => {
    expect(kcalDe({ "energy-kj_100g": 418.4 })).toBe(100);
  });
  it("sodio_g × 1000 y sal_g × 400", () => {
    expect(sodioMgDe({ sodium_100g: 0.4 })).toBe(400);
    expect(sodioMgDe({ salt_100g: 1 })).toBe(400);
  });
});

describe("ausente vs cero y coherencia", () => {
  it("gaseosa cero: 0 kcal es válido y sin aviso", () => {
    const r = parseProducto("1", prod({ "energy-kcal_100g": 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 }));
    expect(r.ok && r.producto.inconsistente).toBe(false);
    expect(r.ok).toBe(true);
  });
  it("falta un macro (ausente) -> sin datos", () => {
    const r = parseProducto("1", prod({ "energy-kcal_100g": 50, proteins_100g: 0, carbohydrates_100g: 10 }));
    expect(r).toMatchObject({ ok: false, motivo: "sin_datos" });
  });
  it("cerveza (kcal del alcohol) no dispara aviso", () => {
    const r = parseProducto("1", prod({ "energy-kcal_100g": 43, proteins_100g: 0.5, carbohydrates_100g: 3.6, fat_100g: 0, alcohol_100g: 5 }));
    expect(r.ok && r.producto.inconsistente).toBe(false);
  });
  it("datos realmente inconsistentes -> aviso, sin rechazar", () => {
    const r = parseProducto("1", prod({ "energy-kcal_100g": 100, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 20 }));
    expect(r.ok).toBe(true);
    expect(r.ok && r.producto.inconsistente).toBe(true);
  });
  it("P+C+G > 105 g -> inválido; 104 g se acepta", () => {
    expect(parseProducto("1", prod({ "energy-kcal_100g": 500, proteins_100g: 40, carbohydrates_100g: 40, fat_100g: 30 }))).toMatchObject({ ok: false, motivo: "invalido" });
    expect(parseProducto("1", prod({ "energy-kcal_100g": 400, proteins_100g: 0, carbohydrates_100g: 104, fat_100g: 0 })).ok).toBe(true);
  });
  it("kcal > 900 -> inválido", () => {
    expect(parseProducto("1", prod({ "energy-kcal_100g": 950, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 100 }))).toMatchObject({ ok: false, motivo: "invalido" });
  });
});

describe("porciones", () => {
  it("ignora porciones mayores a 1.000 g", () => {
    expect(porcionDe({ serving_quantity: 1500 }).g).toBeNull();
    expect(porcionDe({ serving_quantity: 30 }).g).toBe(30);
  });
  it("media porción de 30 g = 15 g y escala nutrientes", () => {
    const g = gramosDe("porciones", 0.5, 30);
    expect(g).toBe(15);
    expect(valoresPara({ calorias: 400, proteinas: 10, carbohidratos: 0, grasas: 0, grasas_saturadas: 0, fibra: 0, azucares: 0, sodio_mg: 0 }, g).calorias).toBe(60);
  });
});

describe("cupos", () => {
  it("clasificar categorías no consume el cupo de 30 análisis", () => {
    const estados = [...Array(29).fill("ok"), ...Array(50).fill("categoria")];
    const c = contarCupos(estados);
    expect(c.analisis).toBe(29);
    expect(c.categorias).toBe(50);
    expect(limiteAlcanzado(c.analisis, 30)).toBe(false);
  });
});
