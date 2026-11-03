// Pure nutrition, date and formatting logic (no browser/server deps).

export const NUTRIENTES = [
  "calorias",
  "proteinas",
  "carbohidratos",
  "grasas",
  "grasas_saturadas",
  "fibra",
  "azucares",
  "sodio_mg",
] as const;
export type NutrienteKey = (typeof NUTRIENTES)[number];
export type Nutrientes = Record<NutrienteKey, number>;

export const NUTRIENTE_LABEL: Record<NutrienteKey, string> = {
  calorias: "Calorías",
  proteinas: "Proteínas",
  carbohidratos: "Carbohidratos",
  grasas: "Grasas totales",
  grasas_saturadas: "Grasas saturadas",
  fibra: "Fibra",
  azucares: "Azúcares",
  sodio_mg: "Sodio",
};
export const NUTRIENTE_UNIDAD: Record<NutrienteKey, string> = {
  calorias: "kcal",
  proteinas: "g",
  carbohidratos: "g",
  grasas: "g",
  grasas_saturadas: "g",
  fibra: "g",
  azucares: "g",
  sodio_mg: "mg",
};

export const vacio = (): Nutrientes => ({
  calorias: 0,
  proteinas: 0,
  carbohidratos: 0,
  grasas: 0,
  grasas_saturadas: 0,
  fibra: 0,
  azucares: 0,
  sodio_mg: 0,
});

export type Confianza = "baja" | "media" | "alta";
export type Momento = "desayuno" | "almuerzo" | "merienda" | "cena" | "snack";
export const MOMENTOS: { key: Momento; label: string }[] = [
  { key: "desayuno", label: "Desayuno" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "merienda", label: "Merienda" },
  { key: "cena", label: "Cena" },
  { key: "snack", label: "Snacks" },
];

export type Ingrediente = Nutrientes & {
  id: string;
  nombre: string;
  gramos: number;
  /** Values per gram, used to rescale when grams change. */
  por_gramo: Nutrientes;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function crearIngrediente(
  id: string,
  nombre: string,
  gramos: number,
  valores: Nutrientes,
): Ingrediente {
  const por_gramo = vacio();
  for (const k of NUTRIENTES) por_gramo[k] = gramos > 0 ? valores[k] / gramos : 0;
  return { id, nombre, gramos, por_gramo, ...valores };
}

export function escalarIngrediente(ing: Ingrediente, gramos: number): Ingrediente {
  const g = Math.max(0, gramos);
  const out: Ingrediente = { ...ing, gramos: g };
  for (const k of NUTRIENTES) out[k] = r1(ing.por_gramo[k] * g);
  return out;
}

export function sumar(items: Partial<Nutrientes>[]): Nutrientes {
  const t = vacio();
  for (const it of items) for (const k of NUTRIENTES) t[k] += Number(it[k] ?? 0);
  for (const k of NUTRIENTES) t[k] = r1(t[k]);
  return t;
}

export const kcalDesdeMacros = (p: number, c: number, g: number) => 4 * p + 4 * c + 9 * g;

export function bajarConfianza(c: Confianza): Confianza {
  return c === "alta" ? "media" : "baja";
}

/** If kcal differ from 4P+4C+9G by more than tolerance, use macro kcal. */
export function validarAtwater(
  t: Nutrientes,
  tolerancia = 0.12,
): { calorias: number; corregido: boolean } {
  const m = kcalDesdeMacros(t.proteinas, t.carbohidratos, t.grasas);
  if (m <= 0) return { calorias: t.calorias, corregido: false };
  const diff = Math.abs(t.calorias - m) / m;
  if (diff > tolerancia) return { calorias: Math.round(m), corregido: true };
  return { calorias: t.calorias, corregido: false };
}

export function rangoPorConfianza(kcal: number, c: Confianza): [number, number] {
  const pct = c === "alta" ? 0.1 : c === "media" ? 0.18 : 0.3;
  return [Math.round(kcal * (1 - pct)), Math.round(kcal * (1 + pct))];
}

// ---------- Dates (always local, never UTC) ----------

export const ZONA_DEFECTO = "America/Argentina/Buenos_Aires";

export function zonaDispositivo(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_DEFECTO;
  } catch {
    return ZONA_DEFECTO;
  }
}

/** YYYY-MM-DD for an instant in the given time zone. */
export function fechaLocal(d: Date = new Date(), zona: string = zonaDispositivo()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function horaLocal(d: Date = new Date(), zona: string = zonaDispositivo()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", hourCycle: "h23" }).format(d);
  return Number(h);
}

export function sumarDias(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Monday of the week containing ymd. */
export function inicioSemana(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return sumarDias(ymd, dow === 0 ? -6 : 1 - dow);
}

export function momentoPorHora(h: number): Momento {
  if (h >= 5 && h < 11) return "desayuno";
  if (h >= 11 && h < 15) return "almuerzo";
  if (h >= 15 && h < 19) return "merienda";
  if (h >= 19 && h < 23) return "cena";
  return "snack";
}

// ---------- Formatting (es-AR) ----------

export function fmt(n: number, dec = 0): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: dec,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** "mar 3 nov" */
export function fmtFechaCorta(ymd: string): string {
  const dt = ymdToDate(ymd);
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" }).format(dt).replace(".", "");
  const mes = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" }).format(dt).replace(".", "");
  return `${dia} ${dt.getUTCDate()} ${mes}`;
}

/** "03/11/2026" */
export function fmtFechaNum(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDiaSemana(ymd: string): string {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
    .format(ymdToDate(ymd))
    .replace(".", "");
}

export function fmtRango(kcal: number, min?: number | null, max?: number | null): string {
  if (min == null || max == null) return `${fmt(kcal)} kcal`;
  return `~${fmt(kcal)} kcal (${fmt(min)}-${fmt(max)})`;
}

// ---------- Suggested goals ----------

export type DatosPerfil = {
  peso_kg: number;
  altura_cm: number;
  edad: number;
  sexo: "hombre" | "mujer";
  nivel_actividad: "sedentario" | "ligero" | "moderado" | "alto";
  objetivo: "bajar" | "mantener" | "subir";
};

const FACTOR_ACTIVIDAD = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 };
const AJUSTE_OBJETIVO = { bajar: 0.8, mantener: 1, subir: 1.1 };
export const PISO_KCAL = { hombre: 1500, mujer: 1200 };

export function metasSugeridas(p: DatosPerfil) {
  const bmr =
    10 * p.peso_kg + 6.25 * p.altura_cm - 5 * p.edad + (p.sexo === "hombre" ? 5 : -161);
  const tdee = bmr * FACTOR_ACTIVIDAD[p.nivel_actividad];
  let calorias = Math.round((tdee * AJUSTE_OBJETIVO[p.objetivo]) / 10) * 10;
  calorias = Math.max(calorias, PISO_KCAL[p.sexo]);
  const proteinas_g = Math.round(p.peso_kg * 1.6);
  const grasas_g = Math.round((calorias * 0.28) / 9);
  const carbohidratos_g = Math.max(0, Math.round((calorias - proteinas_g * 4 - grasas_g * 9) / 4));
  return { calorias, proteinas_g, carbohidratos_g, grasas_g };
}

export function caloriasRestantes(consumidas: number, limite: number) {
  const restante = Math.round(limite - consumidas);
  return { restante: Math.max(0, restante), excedido: restante < 0 ? -restante : 0 };
}
