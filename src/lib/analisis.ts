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
  /** Visible fat / chicken skin row (validated against a closed list by filtrarDescartables). */
  descartable: z.boolean(),
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
      const ing = crearIngrediente(`ia-${idx}`, i.nombre.trim(), Math.max(0, Math.round(i.gramos)), v, normalizarCategoria(i.categoria));
      return i.descartable ? { ...ing, descartable: true } : ing;
    });
  ingredientes = filtrarDescartables(r.nombre_plato, ingredientes);
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
      const nuevo = crearIngrediente(ing.id, ing.nombre, ing.gramos, v, ing.categoria);
      return ing.descartable ? { ...nuevo, descartable: true } : nuevo;
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

// ---------- Visible fat / chicken skin (closed list) ----------

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const tiene = (texto: string, palabras: readonly string[]) => {
  const t = ` ${sinAcentos(texto).replace(/[^a-z0-9ñ]+/g, " ")} `;
  return palabras.some((p) => t.includes(` ${p} `) || t.includes(` ${p}s `) || t.includes(` ${p}es `));
};

/** Beef/pork cuts with visible fat, and chicken pieces with skin. */
export const CORTES_CON_GRASA = ["bife ancho", "asado", "costillar", "vacio", "bondiola", "panceta", "chuleta"] as const;
export const POLLO_CON_PIEL = ["pata muslo", "muslo", "alita", "pollo entero", "pollo al horno"] as const;
/** Exclusions always win (dish name or the anchor meat row). */
export const EXCLUSIONES_GRASA = [
  "yogur", "yogurt", "leche", "queso", "ensalada", "guiso", "estofado", "milanesa", "pechuga", "lomo", "peceto", "nalga", "cuadril",
  "fideo", "pasta", "arroz", "pan", "salsa", "pure", "tarta", "empanada", "pizza", "sandwich", "hamburguesa", "locro", "wok", "salteado",
] as const;
const PERMITIDOS = [...CORTES_CON_GRASA, ...POLLO_CON_PIEL];

/**
 * Keeps `descartable` only when the dish name or ANOTHER row names an allowed cut and no exclusion applies
 * (the fat row never validates itself). Invalid fat rows are merged back into the main meat row.
 * `revisar`: ids to validate (default all); other rows keep their flag untouched.
 */
export function filtrarDescartables(plato: string, ings: Ingrediente[], revisar?: ReadonlySet<string>): Ingrediente[] {
  let out = [...ings];
  for (const d of ings) {
    if (!d.descartable || (revisar && !revisar.has(d.id))) continue;
    const otras = out.filter((i) => i.id !== d.id && !i.descartable);
    const anclas = otras.filter((i) => tiene(i.nombre, PERMITIDOS));
    const platoOk = tiene(plato, PERMITIDOS);
    const excluido = tiene(plato, EXCLUSIONES_GRASA.filter((e) => e !== "pan" && e !== "ensalada" && e !== "arroz" && e !== "pure" && e !== "salsa"))
      || anclas.some((a) => tiene(a.nombre, EXCLUSIONES_GRASA))
      || (anclas.length === 0 && tiene(plato, EXCLUSIONES_GRASA));
    const valido = (anclas.length > 0 || platoOk) && !excluido;
    if (valido) continue;
    const carne = otras.find((i) => normalizarCategoria(i.categoria) === "Carnes");
    if (carne) {
      const v = vacio();
      for (const k of NUTRIENTES) v[k] = carne[k] + d[k];
      const unida = crearIngrediente(carne.id, carne.nombre, carne.gramos + d.gramos, v, carne.categoria);
      out = out.filter((i) => i.id !== d.id).map((i) => (i.id === carne.id ? { ...unida, ...(carne.editado_manual ? { editado_manual: true } : {}) } : i));
    } else {
      out = out.map((i) => (i.id === d.id ? (({ descartable: _x, ...rest }) => rest)(i) : i));
    }
  }
  return out;
}
