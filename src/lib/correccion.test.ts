import { describe, expect, it } from "vitest";
import { filtrarDescartables, procesarRespuesta, type RespuestaIA } from "./analisis";
import { aplicarCorreccion, apilar, deshacer, diffCorreccion, escalarRango, type RespuestaCorreccionIA } from "./correccion";
import { contarCupos, correccionEnCurso } from "./limits";
import {
  avisoAtwater, crearIngrediente, editarValoresIngrediente, escalarIngrediente, normalizarIngredientes, sumar, vacio, type Ingrediente, type Nutrientes,
} from "./nutri";

const val = (o: Partial<Nutrientes>): Nutrientes => ({ ...vacio(), ...o });
const ing = (id: string, nombre: string, g: number, o: Partial<Nutrientes>, cat = "Carnes", extra: Partial<Ingrediente> = {}): Ingrediente => ({
  ...crearIngrediente(id, nombre, g, val(o), cat), ...extra,
});
const fila = (i: Ingrediente, accion: RespuestaCorreccionIA["ingredientes"][number]["accion"], cambios: Partial<Ingrediente> = {}) => ({
  id: i.id, accion, nombre: i.nombre, categoria: i.categoria ?? "Otros", gramos: i.gramos,
  calorias: i.calorias, proteinas: i.proteinas, carbohidratos: i.carbohidratos, grasas: i.grasas,
  grasas_saturadas: i.grasas_saturadas, fibra: i.fibra, azucares: i.azucares, sodio_mg: i.sodio_mg, descartable: !!i.descartable,
  ...cambios,
});
let n = 0;
const nid = () => `n${++n}`;

const bife = ing("a", "Bife ancho", 200, { calorias: 440, proteinas: 50, grasas: 26 });
const arroz = ing("b", "Arroz blanco", 150, { calorias: 195, proteinas: 4, carbohidratos: 42, grasas: 0.5 }, "Cereales y panificados");

describe("editor por ingrediente", () => {
  it("editar un valor recalcula su por gramo y luego escala por gramos", () => {
    const e = editarValoresIngrediente(arroz, { proteinas: 6 });
    expect(e.por_gramo.proteinas).toBeCloseTo(6 / 150);
    expect(e.por_gramo.calorias).toBe(arroz.por_gramo.calorias);
    const x = escalarIngrediente(e, 300);
    expect(x.proteinas).toBeCloseTo(12);
    expect(x.calorias).toBeCloseTo(390);
  });
  it("una edición manual no se corrige con Atwater; solo avisa", () => {
    const e = editarValoresIngrediente(arroz, { calorias: 900 });
    expect(e.calorias).toBe(900);
    expect(e.editado_manual).toBe(true);
    expect(avisoAtwater(e)).toBe(true);
  });
  it("guardar sin cambios devuelve el mismo objeto", () => {
    expect(editarValoresIngrediente(arroz, { proteinas: arroz.proteinas })).toBe(arroz);
    expect(escalarIngrediente(arroz, arroz.gramos)).toBe(arroz);
  });
  it("gramos 0 no divide por cero y conserva los valores", () => {
    const r = ing("r", "Registro rápido", 0, { calorias: 300, proteinas: 10 });
    const e = editarValoresIngrediente(r, { calorias: 350 });
    expect(e.calorias).toBe(350);
    expect(Number.isFinite(e.por_gramo.calorias)).toBe(true);
    const g = escalarIngrediente(e, 100);
    expect(g.calorias).toBe(350);
    expect(g.por_gramo.calorias).toBeCloseTo(3.5);
  });
  it("el total es la suma de los ingredientes", () => {
    expect(sumar([bife, arroz]).calorias).toBe(635);
  });
  it("comida vieja sin ids ni por_gramo se normaliza", () => {
    const r = normalizarIngredientes([
      { nombre: "Pollo", gramos: 100, calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6, grasas_saturadas: 1, fibra: 0, azucares: 0, sodio_mg: 70 },
      { nombre: "Pollo", gramos: 0, calorias: 50, proteinas: 1, carbohidratos: 1, grasas: 1, grasas_saturadas: 0, fibra: 0, azucares: 0, sodio_mg: 0 },
      { nombre: "Solo kcal", calorias: 100 },
    ]);
    expect(r).toHaveLength(2);
    expect(new Set(r.map((i) => i.id)).size).toBe(2);
    expect(r[0]!.por_gramo.proteinas).toBeCloseTo(0.31);
    expect(r[1]!.por_gramo.calorias).toBe(0);
  });
});

describe("corrección con IA", () => {
  it("las filas no mencionadas quedan idénticas y la modificada usa los valores nuevos", () => {
    const r = aplicarCorreccion([bife, arroz], {
      pregunta: null, cambios: ["Arroz a 100 g"],
      ingredientes: [fila(bife, "sin_cambios", { calorias: 999 }), fila(arroz, "modificada", { gramos: 100, calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3 })],
    }, "eran 100 g de arroz", "Bife con arroz", nid);
    expect(r.ingredientes[0]).toBe(bife);
    expect(r.ingredientes[1]!.id).toBe("b");
    expect(r.ingredientes[1]!.calorias).toBe(130);
  });
  it("una fila omitida aparece como eliminada en la vista previa", () => {
    const r = aplicarCorreccion([bife, arroz], { pregunta: null, cambios: [], ingredientes: [fila(bife, "sin_cambios")] }, "sin arroz", "Bife", nid);
    const d = diffCorreccion([bife, arroz], r.ingredientes);
    expect(d.eliminadas.map((i) => i.id)).toEqual(["b"]);
    expect(d.kcalDespues).toBe(440);
  });
  it("no permite dejar la comida vacía", () => {
    const r = aplicarCorreccion([bife], { pregunta: null, cambios: [], ingredientes: [fila(bife, "eliminada")] }, "no comí nada", "Bife", nid);
    expect(diffCorreccion([bife], r.ingredientes).vacia).toBe(true);
  });
  it("una fila editada a mano se protege salvo mención explícita", () => {
    const manual = { ...arroz, editado_manual: true };
    const resp = { pregunta: null, cambios: [], ingredientes: [fila(bife, "modificada", { gramos: 150, calorias: 330, proteinas: 37, grasas: 19.5 }), fila(manual, "modificada", { gramos: 50, calorias: 65, carbohidratos: 14, proteinas: 1.3, grasas: 0.2 })] };
    const r1 = aplicarCorreccion([bife, manual], resp, "el bife era más chico", "Bife con arroz", nid);
    expect(r1.ingredientes.find((i) => i.id === "b")).toBe(manual);
    const r2 = aplicarCorreccion([bife, manual], resp, "el arroz era menos", "Bife con arroz", nid);
    expect(r2.ingredientes.find((i) => i.id === "b")!.gramos).toBe(50);
    expect(diffCorreccion([bife, manual], r2.ingredientes).modificadas.find((m) => m.despues.id === "b")!.manual).toBe(true);
  });
  it("categoría inválida pasa a Otros", () => {
    const r = aplicarCorreccion([bife], { pregunta: null, cambios: [], ingredientes: [fila(bife, "sin_cambios"), { ...fila(arroz, "nueva"), id: "nueva-1", categoria: "Guarniciones" }] }, "agregá arroz", "Bife", nid);
    expect(r.ingredientes[1]!.categoria).toBe("Otros");
  });
  it("una pregunta deja todo sin cambios", () => {
    const r = aplicarCorreccion([bife], { pregunta: "¿Cuánto arroz?", cambios: [], ingredientes: [] }, "cambialo", "Bife", nid);
    expect(r.ingredientes).toEqual([bife]);
    expect(r.pregunta).toBe("¿Cuánto arroz?");
  });
  it("descartable sobrevive en filas sin cambios", () => {
    const grasa = ing("g", "Grasa visible del bife ancho (descartable)", 40, { calorias: 360, grasas: 40 }, "Carnes", { descartable: true });
    const r = aplicarCorreccion([bife, grasa, arroz], { pregunta: null, cambios: [], ingredientes: [fila(bife, "sin_cambios"), { ...fila(grasa, "sin_cambios"), descartable: false }, fila(arroz, "modificada", { gramos: 100 })] }, "arroz 100 g", "Bife ancho con arroz", nid);
    expect(r.ingredientes.find((i) => i.id === "g")!.descartable).toBe(true);
  });
  it("rango escalado tras la corrección", () => {
    expect(escalarRango(500, 700, 600, 300)).toEqual({ min: 250, max: 350 });
    expect(escalarRango(null, null, 600, 300)).toEqual({ min: null, max: null });
  });
  it("deshacer restaura la versión anterior", () => {
    const h = apilar(apilar([], [bife]), [bife, arroz]);
    const { anterior, resto } = deshacer(h);
    expect(anterior).toEqual([bife, arroz]);
    expect(deshacer(resto).anterior).toEqual([bife]);
  });
});

describe("cupos de corrección", () => {
  it("las correcciones no consumen el cupo de análisis y las fallidas no cuentan", () => {
    const c = contarCupos(["ok", "correccion_en_curso", "correccion", "correccion_en_curso", "correccion_fallida", "categoria"]);
    expect(c.analisis).toBe(1);
    expect(c.correcciones).toBe(1);
    expect(c.intentosCorreccion).toBe(2);
  });
  it("una corrección en curso bloquea otra", () => {
    const t = Date.parse("2026-11-08T21:00:00Z");
    expect(correccionEnCurso([{ estado: "correccion_en_curso", created_at: "2026-11-08T20:59:30Z" }], t)).toBe(true);
    expect(correccionEnCurso([{ estado: "correccion_en_curso", created_at: "2026-11-08T20:59:30Z" }, { estado: "correccion", created_at: "2026-11-08T20:59:40Z" }], t)).toBe(false);
    expect(correccionEnCurso([{ estado: "correccion_en_curso", created_at: "2026-11-08T20:50:00Z" }], t)).toBe(false);
  });
});

describe("grasa visible y piel (respuestas simuladas)", () => {
  const resp = (plato: string, filas: { nombre: string; cat?: string; desc?: boolean; kcal?: number }[]): RespuestaIA => ({
    es_comida: true, motivo_rechazo: null, nombre_plato: plato, confianza: "media", kcal_min: 0, kcal_max: 0, nota: null,
    ingredientes: filas.map((f) => ({ nombre: f.nombre, categoria: f.cat ?? "Carnes", gramos: 100, calorias: f.kcal ?? 200, proteinas: 20, carbohidratos: 0, grasas: 13, grasas_saturadas: 5, fibra: 0, azucares: 0, sodio_mg: 50, descartable: !!f.desc })),
  });
  const tieneDescartable = (r: RespuestaIA) => procesarRespuesta(r).ingredientes.some((i) => i.descartable);

  it("yogur, ensalada, pechuga, milanesa y fideos no generan fila de grasa aunque la IA la marque", () => {
    expect(tieneDescartable(resp("Yogur con granola", [{ nombre: "Yogur", cat: "Lácteos y huevos" }, { nombre: "Grasa", desc: true }]))).toBe(false);
    expect(tieneDescartable(resp("Ensalada mixta", [{ nombre: "Lechuga", cat: "Verduras" }, { nombre: "Grasa visible", desc: true }]))).toBe(false);
    expect(tieneDescartable(resp("Pechuga a la plancha", [{ nombre: "Pechuga de pollo" }, { nombre: "Piel del pollo", desc: true }]))).toBe(false);
    expect(tieneDescartable(resp("Milanesa de pollo con puré", [{ nombre: "Milanesa de pollo" }, { nombre: "Piel del pollo", desc: true }]))).toBe(false);
    expect(tieneDescartable(resp("Fideos con tuco", [{ nombre: "Fideos", cat: "Cereales y panificados" }, { nombre: "Grasa", desc: true }]))).toBe(false);
  });
  it("la fila inválida se une a la carne sin perder kcal", () => {
    const r = procesarRespuesta(resp("Milanesa de pollo", [{ nombre: "Milanesa de pollo", kcal: 300 }, { nombre: "Piel del pollo", desc: true, kcal: 100 }]));
    expect(r.ingredientes).toHaveLength(1);
    expect(r.ingredientes[0]!.calorias).toBe(400);
  });
  it("bife ancho con grasa visible y muslo de pollo al horno sí", () => {
    expect(tieneDescartable(resp("Bife ancho con ensalada", [{ nombre: "Bife ancho magro" }, { nombre: "Grasa visible del bife ancho (descartable)", desc: true }, { nombre: "Ensalada", cat: "Verduras" }]))).toBe(true);
    expect(tieneDescartable(resp("Muslo de pollo al horno", [{ nombre: "Muslo de pollo sin piel" }, { nombre: "Piel del pollo", desc: true }]))).toBe(true);
  });
  it("la fila de grasa no se valida a sí misma", () => {
    const g = ing("g", "Grasa visible del bife ancho (descartable)", 40, { calorias: 360, grasas: 40 }, "Carnes", { descartable: true });
    const out = filtrarDescartables("Plato", [ing("x", "Carne", 100, { calorias: 200 }), g]);
    expect(out.some((i) => i.descartable)).toBe(false);
  });
});
