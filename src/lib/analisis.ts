import { z } from "zod";
import {
  NUTRIENTES,
  bajarConfianza,
  crearIngrediente,
  normalizarCategoria,
  rangoPorConfianza,
  sumar,
  validarAtwater,
  vacio,
  type Confianza,
  type Ingrediente,
  type Nutrientes,
} from "./nutri";

export const IngredienteIA = z.object({
  nombre: z.string(),
  /** Closed list in the prompt; anything else is normalized to "Otros" (never rejected). */
  categoria: z.string(),
  gramos: z.number(),
  calorias: z.number(),
  proteinas: z.number(),
  carbohidratos: z.number(),
  grasas: z.number(),
  grasas_saturadas: z.number(),
  fibra: z.number(),
  azucares: z.number(),
  sodio_mg: z.number(),
});

export const RespuestaIA = z.object({
  es_comida: z.boolean(),
  motivo_rechazo: z.string().nullable(),
  nombre_plato: z.string(),
  confianza: z.enum(["baja", "media", "alta"]),
  kcal_min: z.number(),
  kcal_max: z.number(),
  nota: z.string().nullable(),
  ingredientes: z.array(IngredienteIA),
});
export type RespuestaIA = z.infer<typeof RespuestaIA>;

export type ResultadoAnalisis = {
  nombre_plato: string;
  confianza: Confianza;
  kcal_min: number;
  kcal_max: number;
  nota: string | null;
  corregido_atwater: boolean;
  ingredientes: Ingrediente[];
  totales: Nutrientes;
};

/** Normalize AI output: sum ingredients, Atwater check, sane range. */
export function procesarRespuesta(r: RespuestaIA): ResultadoAnalisis {
  let ingredientes = r.ingredientes
    .filter((i) => i.nombre.trim())
    .map((i, idx) => {
      const v = vacio();
      for (const k of NUTRIENTES) v[k] = Math.max(0, Number(i[k]) || 0);
      return crearIngrediente(`ia-${idx}`, i.nombre.trim(), Math.max(0, Math.round(i.gramos)), v, normalizarCategoria(i.categoria));
    });
  let totales = sumar(ingredientes);
  let confianza: Confianza = r.confianza;
  let kcal_min = r.kcal_min;
  let kcal_max = r.kcal_max;

  const at = validarAtwater(totales);
  if (at.corregido) {
    const ratio = totales.calorias > 0 ? at.calorias / totales.calorias : 1;
    ingredientes = ingredientes.map((ing) => {
      const v = vacio();
      for (const k of NUTRIENTES) v[k] = ing[k];
      v.calorias =
        totales.calorias > 0
          ? Math.round(ing.calorias * ratio * 10) / 10
          : Math.round((4 * ing.proteinas + 4 * ing.carbohidratos + 9 * ing.grasas) * 10) / 10;
      return crearIngrediente(ing.id, ing.nombre, ing.gramos, v, ing.categoria);
    });
    totales = sumar(ingredientes);
    confianza = bajarConfianza(confianza);
    kcal_min = kcal_min * ratio;
    kcal_max = kcal_max * ratio;
  }

  if (!(kcal_min <= totales.calorias && totales.calorias <= kcal_max) || kcal_min <= 0) {
    [kcal_min, kcal_max] = rangoPorConfianza(totales.calorias, confianza);
  }

  return {
    nombre_plato: r.nombre_plato.trim() || "Comida",
    confianza,
    kcal_min: Math.round(kcal_min),
    kcal_max: Math.round(kcal_max),
    nota: r.nota,
    corregido_atwater: at.corregido,
    ingredientes,
    totales,
  };
}

export type AnalisisRespuesta =
  | { ok: true; resultado: ResultadoAnalisis; usados: number; limite: number }
  | {
      ok: false;
      codigo: "no_comida" | "limite" | "creditos" | "rate" | "invalido" | "error";
      mensaje: string;
    };
