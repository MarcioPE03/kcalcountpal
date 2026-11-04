import { describe, expect, it } from "vitest";
import {
  caloriasRestantes,
  crearIngrediente,
  escalarIngrediente,
  fechaLocal,
  fmt,
  fmtRango,
  metasSugeridas,
  momentoPorHora,
  sumar,
  validarAtwater,
  vacio,
} from "./nutri";
import { limiteAlcanzado } from "./limits";

describe("fechas locales", () => {
  it("una cena a las 22:00 en Buenos Aires queda en el mismo día (no UTC)", () => {
    // 22:00 ART del 3/11 = 01:00 UTC del 4/11
    const cena = new Date("2026-11-04T01:00:00Z");
    expect(fechaLocal(cena, "America/Argentina/Buenos_Aires")).toBe("2026-11-03");
  });
  it("preselecciona cena a las 22 y desayuno a las 8", () => {
    expect(momentoPorHora(22)).toBe("cena");
    expect(momentoPorHora(8)).toBe("desayuno");
    expect(momentoPorHora(16)).toBe("merienda");
    expect(momentoPorHora(1)).toBe("snack");
  });
});

describe("recálculo de ingredientes", () => {
  it("escala nutrientes al cambiar gramos", () => {
    const pollo = crearIngrediente("1", "Pollo", 200, {
      ...vacio(),
      calorias: 330,
      proteinas: 62,
      grasas: 7,
    });
    const mitad = escalarIngrediente(pollo, 100);
    expect(mitad.calorias).toBe(165);
    expect(mitad.proteinas).toBe(31);
    const total = sumar([mitad, crearIngrediente("2", "Arroz", 150, { ...vacio(), calorias: 195, carbohidratos: 42 })]);
    expect(total.calorias).toBe(360);
  });
});

describe("validación Atwater", () => {
  it("corrige kcal cuando difieren más de 12 %", () => {
    const t = { ...vacio(), calorias: 300, proteinas: 30, carbohidratos: 50, grasas: 20 }; // macros = 500
    expect(validarAtwater(t)).toEqual({ calorias: 500, corregido: true });
  });
  it("no corrige dentro de la tolerancia", () => {
    const t = { ...vacio(), calorias: 470, proteinas: 30, carbohidratos: 50, grasas: 20 };
    expect(validarAtwater(t).corregido).toBe(false);
  });
});

describe("metas sugeridas", () => {
  it("respeta el piso de 1200 kcal para mujeres", () => {
    const m = metasSugeridas({
      peso_kg: 45, altura_cm: 150, edad: 70, sexo: "mujer", nivel_actividad: "sedentario", objetivo: "bajar",
    });
    expect(m.calorias).toBe(1200);
  });
  it("respeta el piso de 1500 kcal para hombres", () => {
    const m = metasSugeridas({
      peso_kg: 50, altura_cm: 160, edad: 80, sexo: "hombre", nivel_actividad: "sedentario", objetivo: "bajar",
    });
    expect(m.calorias).toBe(1500);
  });
  it("proteína 1,6 g/kg", () => {
    const m = metasSugeridas({
      peso_kg: 75, altura_cm: 178, edad: 30, sexo: "hombre", nivel_actividad: "moderado", objetivo: "mantener",
    });
    expect(m.proteinas_g).toBe(120);
  });
});

describe("formato y restantes", () => {
  it("usa coma decimal", () => {
    expect(fmt(78.5, 1)).toBe("78,5");
    expect(fmtRango(520, 450, 600)).toBe("~520 kcal (450-600)");
  });
  it("calcula restantes y excedidas", () => {
    expect(caloriasRestantes(1500, 2000)).toEqual({ restante: 500, excedido: 0 });
    expect(caloriasRestantes(2150, 2000)).toEqual({ restante: 0, excedido: 150 });
  });
  it("límite diario de análisis: 30 por defecto", () => {
    expect(limiteAlcanzado(29)).toBe(false);
    expect(limiteAlcanzado(30)).toBe(true);
    expect(limiteAlcanzado(5, 5)).toBe(true);
  });
});

import { fechaDeCalendario, calendarioDeFecha, tituloLista, fechaLocal as fl } from "./nutri";
describe("fechas del calendario", () => {
  it("elegir el día 3 devuelve 3, no 2 ni 4", () => {
    const f = fechaDeCalendario(new Date(2026, 10, 3));
    expect(f).toBe("2026-11-03");
    expect(fechaDeCalendario(calendarioDeFecha("2026-11-03"))).toBe("2026-11-03");
  });
  it("hoy se calcula en Buenos Aires (22 h del 3 = día 3, no 4)", () => {
    expect(fl(new Date("2026-11-04T01:00:00Z"))).toBe("2026-11-03");
  });
  it("título de la lista", () => {
    expect(tituloLista("2026-11-03", "2026-11-03")).toBe("Comidas de hoy");
    expect(tituloLista("2026-11-02", "2026-11-03")).toBe("Lunes 2 de noviembre");
  });
});

import { balanceDia, validarQuemadas } from "./nutri";
describe("balance con entrenamientos", () => {
  it("restantes sin entrenamientos", () => {
    expect(balanceDia({ consumidas: 1500, limite: 2000, quemadas: 0, sumarQuemadas: true }).restante).toBe(500);
  });
  it("restantes suma quemadas si el interruptor está activado", () => {
    expect(balanceDia({ consumidas: 1500, limite: 2000, quemadas: 300, sumarQuemadas: true }).restante).toBe(800);
  });
  it("con interruptor apagado las quemadas no cambian el restante", () => {
    expect(balanceDia({ consumidas: 1500, limite: 2000, quemadas: 300, sumarQuemadas: false }).restante).toBe(500);
  });
  it("progreso del anillo según el interruptor", () => {
    expect(balanceDia({ consumidas: 1150, limite: 2000, quemadas: 300, sumarQuemadas: true }).progreso).toBe(0.5);
    expect(balanceDia({ consumidas: 1000, limite: 2000, quemadas: 300, sumarQuemadas: false }).progreso).toBe(0.5);
  });
  it("progreso con tope del 100 % y límite 0", () => {
    expect(balanceDia({ consumidas: 3000, limite: 2000, quemadas: 0, sumarQuemadas: true }).progreso).toBe(1);
    expect(balanceDia({ consumidas: 0, limite: 0, quemadas: 0, sumarQuemadas: true }).progreso).toBe(0);
    expect(balanceDia({ consumidas: 500, limite: 0, quemadas: 0, sumarQuemadas: false }).progreso).toBe(1);
  });
  it("muestra kcal de más al pasarse", () => {
    const b = balanceDia({ consumidas: 2400, limite: 2000, quemadas: 200, sumarQuemadas: true });
    expect(b).toMatchObject({ restante: 0, excedido: 200, leyenda: "kcal de más" });
  });
  it("valida rango de kcal quemadas", () => {
    expect(validarQuemadas(0)).not.toBeNull();
    expect(validarQuemadas(5001)).not.toBeNull();
    expect(validarQuemadas(null)).not.toBeNull();
    expect(validarQuemadas(1)).toBeNull();
    expect(validarQuemadas(5000)).toBeNull();
  });
});
