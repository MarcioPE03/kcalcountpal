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

import { ESTADO_ETIQUETA_FALLIDA } from "./limits";
import { aPor100, normalizarCodigo, normalizarEtiqueta, productoDesdePropio, puedeGuardar, resolverProducto, valoresProducto, type LecturaEtiqueta } from "./off";

const lectura = (o: Partial<LecturaEtiqueta>): LecturaEtiqueta => ({
  es_etiqueta: true, nombre: "Galletitas", columna: "100g", porcion_cantidad: null, porcion_unidad: null, solo_preparado: false,
  kcal: null, kj: null, proteinas: null, carbohidratos: null, grasas: null, grasas_saturadas: null, fibra: null, azucares: null,
  sodio_mg: null, sal_g: null, ...o,
});

describe("códigos normalizados a EAN-13", () => {
  it("UPC-A de 12 dígitos y su versión 0+12 son el mismo producto", () => {
    expect(normalizarCodigo("036000291452")).toBe("0036000291452");
    expect(normalizarCodigo("0036000291452")).toBe(normalizarCodigo("036000291452"));
    expect(normalizarCodigo("96385074")).toBe("0000096385074");
  });
});

describe("valores base por 100 g", () => {
  it("1 porción de 40 g con 200 kcal se guarda como 500 kcal por 100 g", () => {
    const v = { calorias: 200, proteinas: 4, carbohidratos: 20, grasas: 12, grasas_saturadas: 0, fibra: 0, azucares: 0, sodio_mg: 0 };
    expect(aPor100(v, 40).calorias).toBe(500);
    expect(aPor100(v, 40).proteinas).toBe(10);
  });
  it("etiqueta por porción en ml se toma como gramos", () => {
    const r = normalizarEtiqueta("1", lectura({ columna: "porcion", porcion_cantidad: 200, porcion_unidad: "ml", kcal: 84, proteinas: 6, carbohidratos: 10, grasas: 2 }));
    expect(r.ok && r.producto.por100.calorias).toBe(42);
    expect(r.ok && r.producto.base).toBe("100g");
    expect(r.ok && r.producto.porcion_ml).toBe(true);
  });
  it("porción sin peso en gramos queda con base 'porcion'", () => {
    const r = normalizarEtiqueta("1", lectura({ columna: "porcion", porcion_cantidad: 1, porcion_unidad: "unidad", kcal: 150, proteinas: 2, carbohidratos: 20, grasas: 7 }));
    expect(r.ok && r.producto.base).toBe("porcion");
    expect(r.ok && valoresProducto(r.producto, 2).calorias).toBe(300);
  });
  it("si la IA usó la columna de 100 g, no se reescala aunque haya porción", () => {
    const r = normalizarEtiqueta("1", lectura({ columna: "100g", porcion_cantidad: 30, porcion_unidad: "g", kcal: 450, proteinas: 7, carbohidratos: 70, grasas: 15 }));
    expect(r.ok && r.producto.por100.calorias).toBe(450);
    expect(r.ok && r.producto.porcion_g).toBe(30);
  });
});

describe("lectura de etiqueta: null vs 0", () => {
  it("0 ('no aporta cantidades significativas') es 0 y no falta; null falta", () => {
    const r = normalizarEtiqueta("1", lectura({ kcal: 350, proteinas: 8, carbohidratos: 75, grasas: 0, grasas_saturadas: 0, fibra: null }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.producto.por100.grasas).toBe(0);
    expect(r.producto.faltantesPrincipales).toEqual([]);
    expect(r.producto.faltantes).toContain("fibra");
    expect(r.producto.faltantes).not.toContain("grasas saturadas");
  });
  it("una foto que no es etiqueta no da producto", () => {
    expect(normalizarEtiqueta("1", lectura({ es_etiqueta: false })).ok).toBe(false);
  });
});

describe("datos parciales", () => {
  it("producto con solo kcal: se acepta y marca los 3 macros faltantes", () => {
    const r = parseProducto("1", prod({ "energy-kcal_100g": 380 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.producto.faltantesPrincipales).toEqual(["proteinas", "carbohidratos", "grasas"]);
  });
  it("producto con solo macros: kcal = 4/4/9", () => {
    const r = parseProducto("1", prod({ proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 10 }));
    expect(r.ok && r.producto.por100.calorias).toBe(330);
  });
  it("sin kcal ni macros completos: sin datos", () => {
    expect(parseProducto("1", prod({ proteins_100g: 10 })).ok).toBe(false);
  });
  it("guardar con datos incompletos se permite solo con kcal determinables", () => {
    expect(puedeGuardar({ calorias: 200, proteinas: null })).toBe(true);
    expect(puedeGuardar({ calorias: null, proteinas: 5, carbohidratos: 10, grasas: 2 })).toBe(true);
    expect(puedeGuardar({ calorias: null, proteinas: 5 })).toBe(false);
  });
});

describe("Mis productos", () => {
  it("tiene prioridad sobre Open Food Facts", () => {
    expect(resolverProducto("propio", "off")).toEqual({ producto: "propio", fuente: "propio" });
    expect(resolverProducto(null, "off")).toEqual({ producto: "off", fuente: "off" });
    expect(resolverProducto(null, null)).toBeNull();
  });
  it("una fila propia con base 'porcion' conserva su base", () => {
    const p = productoDesdePropio({ codigo: "0000096385074", nombre: "Alfajor", marca: null, categoria: "Dulces y snacks", base: "porcion", porcion_g: null, porcion_ml: false,
      calorias: 240, proteinas: 3, carbohidratos: 35, grasas: 10, grasas_saturadas: null, fibra: null, azucares: null, sodio_mg: null });
    expect(p.base).toBe("porcion");
    expect(p.fuente).toBe("propio");
  });
});

describe("cupo y etiquetas", () => {
  it("una lectura de etiqueta fallida no consume el cupo", () => {
    expect(contarCupos(["ok", ESTADO_ETIQUETA_FALLIDA, ESTADO_ETIQUETA_FALLIDA]).analisis).toBe(1);
  });
});
