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

/** Single list order: by moment (unknown/null last), then created_at ascending. */
export function ordenarComidas<T extends { momento: string | null; created_at: string }>(comidas: readonly T[]): T[] {
  const idx = (m: string | null) => {
    const i = MOMENTOS.findIndex((x) => x.key === m);
    return i === -1 ? MOMENTOS.length : i;
  };
  return [...comidas].sort((a, b) => idx(a.momento) - idx(b.momento) || a.created_at.localeCompare(b.created_at));
}

export type Ingrediente = Nutrientes & {
  id: string;
  nombre: string;
  gramos: number;
  /** Values per gram, used to rescale when grams change. */
  por_gramo: Nutrientes;
  categoria?: string;
  /** The user edited values by hand: never auto-corrected (Atwater) and protected from AI corrections. */
  editado_manual?: boolean;
  /** Visible fat / chicken skin the user may leave on the plate (closed list, see analisis.ts). */
  descartable?: boolean;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function crearIngrediente(
  id: string,
  nombre: string,
  gramos: number,
  valores: Nutrientes,
  categoria?: string,
): Ingrediente {
  const por_gramo = vacio();
  for (const k of NUTRIENTES) por_gramo[k] = gramos > 0 ? valores[k] / gramos : 0;
  return { id, nombre, gramos, por_gramo, ...valores, ...(categoria ? { categoria } : {}) };
}

/** Rescales by grams (full precision). Without a usable per-gram base (0 g rows), values stay and the base is rebuilt. */
export function escalarIngrediente(ing: Ingrediente, gramos: number): Ingrediente {
  const g = Number.isFinite(gramos) ? Math.max(0, gramos) : 0;
  if (g === ing.gramos) return ing;
  const sinBase = !(ing.gramos > 0) && NUTRIENTES.every((k) => !ing.por_gramo?.[k]);
  if (sinBase || g === 0) {
    const por_gramo = vacio();
    for (const k of NUTRIENTES) por_gramo[k] = g > 0 ? ing[k] / g : (ing.por_gramo?.[k] ?? 0);
    return { ...ing, gramos: g, por_gramo };
  }
  const out: Ingrediente = { ...ing, gramos: g, por_gramo: { ...ing.por_gramo } };
  for (const k of NUTRIENTES) out[k] = ing.por_gramo[k] * g;
  return out;
}

/** Applies hand-edited values: only the changed fields update their per-gram value. No change = same object. */
export function editarValoresIngrediente(ing: Ingrediente, cambios: Partial<Nutrientes>): Ingrediente {
  const keys = NUTRIENTES.filter((k) => cambios[k] != null && Number.isFinite(cambios[k]) && cambios[k] !== ing[k]);
  if (keys.length === 0) return ing;
  const out: Ingrediente = { ...ing, por_gramo: { ...ing.por_gramo }, editado_manual: true };
  for (const k of keys) {
    const v = Math.max(0, cambios[k] as number);
    out[k] = v;
    out.por_gramo[k] = ing.gramos > 0 ? v / ing.gramos : 0;
  }
  return out;
}

/** Soft warning only (never modifies): kcal far from 4P+4C+9G. */
export function avisoAtwater(v: Nutrientes, tolerancia = 0.12): boolean {
  const m = kcalDesdeMacros(v.proteinas, v.carbohidratos, v.grasas);
  if (m <= 0 && v.calorias <= 0) return false;
  return Math.abs(v.calorias - m) > Math.max(20, tolerancia * Math.max(m, v.calorias));
}

/** True when the row carries all 8 nutrient values (or a per-gram base). */
function filaCompleta(o: Record<string, unknown>): boolean {
  return (!!o["por_gramo"] && typeof o["por_gramo"] === "object") || NUTRIENTES.every((k) => o[k] != null && Number.isFinite(Number(o[k])));
}

/**
 * Reads stored ingredient JSON: stable unique ids, numeric values, per-gram base when missing.
 * Rows without the full nutrient set are dropped (those meals are edited with the totals form).
 */
export function normalizarIngredientes(json: unknown): Ingrediente[] {
  const arr = Array.isArray(json) ? json : [];
  const vistos = new Set<string>();
  const out: Ingrediente[] = [];
  arr.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const o = raw as Record<string, unknown>;
    if (!filaCompleta(o)) return;
    let id = typeof o["id"] === "string" && o["id"] ? (o["id"] as string) : `ing-${idx}`;
    while (vistos.has(id)) id = `${id}-${idx}`;
    vistos.add(id);
    const gramos = Math.max(0, Number(o["gramos"]) || 0);
    const v = vacio();
    for (const k of NUTRIENTES) v[k] = Math.max(0, Number(o[k]) || 0);
    const pgRaw = o["por_gramo"] as Record<string, unknown> | undefined;
    const por_gramo = vacio();
    for (const k of NUTRIENTES) {
      const p = Number(pgRaw?.[k]);
      por_gramo[k] = pgRaw && Number.isFinite(p) ? p : gramos > 0 ? v[k] / gramos : 0;
    }
    const ing: Ingrediente = { id, nombre: String(o["nombre"] ?? "Ingrediente"), gramos, por_gramo, ...v };
    if (typeof o["categoria"] === "string") ing.categoria = o["categoria"];
    if (o["editado_manual"] === true) ing.editado_manual = true;
    if (o["descartable"] === true) ing.descartable = true;
    out.push(ing);
  });
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
export function fechaLocal(d: Date = new Date(), zona: string = ZONA_DEFECTO): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function horaLocal(d: Date = new Date(), zona: string = ZONA_DEFECTO): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", hourCycle: "h23" }).format(d);
  return Number(h);
}

export function sumarDias(ymd: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Monday of the week containing ymd. */
export function inicioSemana(ymd: string): string {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
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

/** Day picked in a calendar (local Date at midnight) -> YYYY-MM-DD, no UTC shift. */
export function fechaDeCalendario(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** YYYY-MM-DD -> local Date at noon (for calendar selection). */
export function calendarioDeFecha(ymd: string): Date {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

// ---------- Formatting (es-AR) ----------

export function fmt(n: number, dec = 0): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: dec,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

const ymdToDate = (ymd: string) => {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
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

/** "Lunes 2 de noviembre" */
export function fmtFechaLarga(ymd: string): string {
  const dt = ymdToDate(ymd);
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(dt);
  const mes = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(dt);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${dt.getUTCDate()} de ${mes}`;
}

export function tituloLista(fecha: string, hoy: string): string {
  return fecha === hoy ? "Comidas de hoy" : fmtFechaLarga(fecha);
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

/**
 * Day balance with workouts. Remaining = limit − eaten + burned (burned only if the toggle is on).
 * Ring progress = eaten / (limit + burned) when on, eaten / limit when off; capped at 1, safe for 0.
 */
export function balanceDia({ consumidas, limite, quemadas, sumarQuemadas }: { consumidas: number; limite: number; quemadas: number; sumarQuemadas: boolean }) {
  const extra = sumarQuemadas ? Math.max(0, quemadas) : 0;
  const total = limite + extra;
  const { restante, excedido } = caloriasRestantes(consumidas, total);
  const progreso = total > 0 ? Math.min(Math.max(consumidas, 0) / total, 1) : consumidas > 0 ? 1 : 0;
  return { restante, excedido, progreso, leyenda: excedido > 0 ? "kcal de más" : "kcal restantes" };
}

export const QUEMADAS_MIN = 1;
export const QUEMADAS_MAX = 5000;
/** Burned kcal must be a number between 1 and 5000. Returns an error message or null. */
export function validarQuemadas(kcal: number | null | undefined): string | null {
  if (kcal == null || !Number.isFinite(kcal)) return "Ingresá las calorías quemadas.";
  if (kcal < QUEMADAS_MIN || kcal > QUEMADAS_MAX) return "Las calorías quemadas deben estar entre 1 y 5000.";
  return null;
}

// ---------- Categorías de alimentos ----------

export const CATEGORIAS = [
  "Carnes",
  "Pescados y mariscos",
  "Lácteos y huevos",
  "Verduras",
  "Frutas",
  "Cereales y panificados",
  "Legumbres",
  "Frutos secos y semillas",
  "Dulces y snacks",
  "Bebidas",
  "Aceites y grasas",
  "Otros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Any value outside the closed list becomes "Otros". */
export function normalizarCategoria(v: unknown): Categoria {
  if (typeof v !== "string") return "Otros";
  const k = sinTildes(v);
  return CATEGORIAS.find((c) => sinTildes(c) === k) ?? "Otros";
}

type ComidaParaStats = { fecha: string; momento: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; ingredientes: unknown };

/**
 * Splits each meal's registered kcal across its categories, proportional to ingredient kcal,
 * so the per-category total always equals the logged kcal.
 */
export function caloriasPorCategoria(comidas: Pick<ComidaParaStats, "calorias" | "ingredientes">[]): Record<Categoria, number> {
  const out = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<Categoria, number>;
  for (const c of comidas) {
    const total = Number(c.calorias) || 0;
    if (total <= 0) continue;
    const ings = Array.isArray(c.ingredientes) ? (c.ingredientes as { calorias?: unknown; categoria?: unknown }[]) : [];
    const parciales = new Map<Categoria, number>();
    let suma = 0;
    for (const i of ings) {
      const k = Math.max(0, Number(i?.calorias) || 0);
      if (k <= 0) continue;
      const cat = normalizarCategoria(i?.categoria);
      parciales.set(cat, (parciales.get(cat) ?? 0) + k);
      suma += k;
    }
    if (suma <= 0) {
      out.Otros += total;
      continue;
    }
    for (const [cat, k] of parciales) out[cat] += (total * k) / suma;
  }
  return out;
}

/** Top N slices; the rest grouped as "Otras". */
export function topCategorias(m: Record<string, number>, n = 5): { nombre: string; kcal: number; pct: number }[] {
  const total = Object.values(m).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  const orden = Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = orden.slice(0, n);
  const resto = orden.slice(n).reduce((s, [, v]) => s + v, 0);
  const filas = top.map(([nombre, kcal]) => ({ nombre, kcal }));
  if (resto > 0) filas.push({ nombre: "Otras", kcal: resto });
  return filas.map((f) => ({ ...f, pct: (f.kcal / total) * 100 }));
}

// ---------- Estadísticas ----------

export type Periodo = "semana" | "mes";

export function rangoPeriodo(tipo: Periodo, ref: string): { desde: string; hasta: string; dias: string[] } {
  let desde: string;
  let hasta: string;
  if (tipo === "semana") {
    desde = inicioSemana(ref);
    hasta = sumarDias(desde, 6);
  } else {
    desde = `${ref.slice(0, 7)}-01`;
    const [y = 1970, m = 1] = ref.split("-").map(Number);
    const ult = new Date(Date.UTC(y, m, 0)).getUTCDate();
    hasta = `${ref.slice(0, 7)}-${String(ult).padStart(2, "0")}`;
  }
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return { desde, hasta, dias };
}

export function moverPeriodo(tipo: Periodo, ref: string, dir: 1 | -1): string {
  if (tipo === "semana") return sumarDias(inicioSemana(ref), 7 * dir);
  const [y = 1970, m = 1] = ref.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Average over every day with at least one meal (today included). Empty days don't count as 0. */
export function promedioDiario(comidas: Pick<ComidaParaStats, "fecha" | "calorias">[]): { promedio: number; dias: number } {
  const porDia = new Map<string, number>();
  for (const c of comidas) porDia.set(c.fecha, (porDia.get(c.fecha) ?? 0) + (Number(c.calorias) || 0));
  const dias = porDia.size;
  if (!dias) return { promedio: 0, dias: 0 };
  let s = 0;
  for (const v of porDia.values()) s += v;
  return { promedio: s / dias, dias };
}

/** Macro kcal (4/4/9) scaled so the segments add up to the day's real kcal. */
export function macrosEscalados(t: { calorias: number; proteinas: number; carbohidratos: number; grasas: number }) {
  const p = 4 * t.proteinas;
  const c = 4 * t.carbohidratos;
  const g = 9 * t.grasas;
  const m = p + c + g;
  if (m <= 0 || t.calorias <= 0) return { proteinas: 0, carbohidratos: 0, grasas: 0 };
  const f = t.calorias / m;
  return { proteinas: p * f, carbohidratos: c * f, grasas: g * f };
}

// ---------- Peso ----------

export const PESO_MIN = 25;
export const PESO_MAX = 300;

export function validarPeso(kg: number, fecha: string, hoy: string): string | null {
  if (!Number.isFinite(kg) || kg < PESO_MIN || kg > PESO_MAX) return `Ingresá un peso entre ${PESO_MIN} y ${PESO_MAX} kg.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "Elegí una fecha válida.";
  if (fecha > hoy) return "La fecha no puede ser futura.";
  return null;
}

/** Days since epoch for a YYYY-MM-DD (for a true time axis). */
export function diaNumero(ymd: string): number {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function ymdDeDiaNumero(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function filtrarRangoPeso<T extends { fecha: string }>(regs: T[], rango: "1m" | "3m" | "todo", hoy: string): T[] {
  if (rango === "todo") return regs;
  const desde = sumarDias(hoy, rango === "1m" ? -30 : -91);
  return regs.filter((r) => r.fecha >= desde);
}

/** Last minus first, sorted by date. Negative = lost weight. */
export function diferenciaPeso(regs: { fecha: string; peso_kg: number }[]): number | null {
  if (regs.length < 2) return null;
  const o = [...regs].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return Math.round((o[o.length - 1]!.peso_kg - o[0]!.peso_kg) * 10) / 10;
}

export function fmtDiferencia(d: number): string {
  return `${d > 0 ? "+" : d < 0 ? "-" : ""}${fmt(Math.abs(d), 1)} kg`;
}

/** Y domain that doesn't start at 0: min/max of data and goal, with margin. */
export function dominioPeso(valores: number[], meta?: number | null): [number, number] {
  const vs = [...valores, ...(meta ? [meta] : [])].filter(Number.isFinite);
  if (!vs.length) return [0, 100];
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const margen = Math.max(1, (max - min) * 0.15);
  return [Math.floor(min - margen), Math.ceil(max + margen)];
}

// ---------- Macro percentages (one decimal, always summing exactly 100.0) ----------
export type MacroKey = "proteinas" | "carbohidratos" | "grasas";
export type PctMacros = Record<MacroKey, number>;
export const MACRO_KEYS: MacroKey[] = ["proteinas", "carbohidratos", "grasas"];
export const PCT_MIN = 5;
export const PCT_MAX = 70;
export const KCAL_META_MIN = 800;
export const KCAL_META_MAX = 6000;
export const KCAL_FACTOR: Record<MacroKey, number> = { proteinas: 4, carbohidratos: 4, grasas: 9 };
export const PRESETS_PCT: { nombre: string; pct: PctMacros }[] = [
  { nombre: "Equilibrada", pct: { carbohidratos: 50, proteinas: 20, grasas: 30 } },
  { nombre: "Alta en proteínas", pct: { carbohidratos: 40, proteinas: 35, grasas: 25 } },
  { nombre: "Moderada", pct: { carbohidratos: 40, proteinas: 40, grasas: 20 } },
];

const T_MIN = PCT_MIN * 10;
const T_MAX = PCT_MAX * 10;
const aDecimas = (n: number) => Math.round(n * 10);

/** Grams from kcal and an exact (one-decimal) percentage; only the final grams are rounded. */
export function gramosDesdePct(kcal: number, pct: PctMacros) {
  const g = (k: MacroKey) => Math.round((kcal * pct[k]) / 100 / KCAL_FACTOR[k]);
  return { proteinas_g: g("proteinas"), carbohidratos_g: g("carbohidratos"), grasas_g: g("grasas") };
}

export function kcalMacro(kcal: number, pct: number) {
  return Math.round((kcal * pct) / 100);
}

/** Splits `total` tenths between two macros proportionally to weights, by largest remainder, within [5,70]. */
function repartirDos(total: number, wa: number, wb: number): [number, number] {
  const suma = wa + wb;
  const exacta = suma > 0 ? (total * wa) / suma : total / 2;
  let a = Math.floor(exacta);
  if (exacta - a > 0.5 || (exacta - a === 0.5 && wa >= wb)) a += 1;
  a = Math.min(Math.max(a, Math.max(T_MIN, total - T_MAX)), Math.min(T_MAX, total - T_MIN));
  return [a, total - a];
}

/**
 * Sets one macro to `nuevo` (clamped 5–70) and lets the other two absorb the difference
 * proportionally to their values in `base` (snapshot taken when the drag started → no drift).
 */
export function redistribuirPct(base: PctMacros, key: MacroKey, nuevo: number): PctMacros {
  const otros = MACRO_KEYS.filter((k) => k !== key) as [MacroKey, MacroKey];
  const t = Math.min(Math.max(aDecimas(nuevo), T_MIN), T_MAX);
  const [a, b] = repartirDos(1000 - t, base[otros[0]], base[otros[1]]);
  return { ...base, [key]: t / 10, [otros[0]]: a / 10, [otros[1]]: b / 10 } as PctMacros;
}

/** Normalizes any positive weights to one-decimal percentages within 5–70 that sum exactly 100.0. */
export function normalizarPct(raw: PctMacros): PctMacros {
  const w = MACRO_KEYS.map((k) => Math.max(0, Number(raw[k]) || 0));
  const suma = w.reduce((s, x) => s + x, 0);
  const exactas = suma > 0 ? w.map((x) => (x * 1000) / suma) : [1000 / 3, 1000 / 3, 1000 / 3];
  const t = exactas.map(Math.floor);
  let resto = 1000 - t.reduce((s, x) => s + x, 0);
  const orden = exactas.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let j = 0; resto > 0; j++, resto--) t[orden[j % 3][1]] += 1;
  for (let iter = 0; iter < 6; iter++) {
    let diff = 0;
    for (let i = 0; i < 3; i++) {
      if (t[i] < T_MIN) { diff -= T_MIN - t[i]; t[i] = T_MIN; }
      if (t[i] > T_MAX) { diff += t[i] - T_MAX; t[i] = T_MAX; }
    }
    if (diff === 0) break;
    for (let i = 0; i < 3 && diff !== 0; i++) {
      const espacio = diff > 0 ? T_MAX - t[i] : t[i] - T_MIN;
      const mover = Math.min(espacio, Math.abs(diff));
      t[i] += diff > 0 ? mover : -mover;
      diff += diff > 0 ? -mover : mover;
    }
  }
  return { proteinas: t[0] / 10, carbohidratos: t[1] / 10, grasas: t[2] / 10 };
}

/** Percentages derived from gram goals (for goals saved before percentages existed). */
export function pctDesdeGramos(g: { proteinas_g: number; carbohidratos_g: number; grasas_g: number }): PctMacros {
  return normalizarPct({ proteinas: g.proteinas_g * 4, carbohidratos: g.carbohidratos_g * 4, grasas: g.grasas_g * 9 });
}

/** Typed grams → one-decimal percentage, clamped to 5–70 (`ajustado` tells the UI to warn). */
export function pctDesdeGramosInput(kcal: number, key: MacroKey, gramos: number) {
  if (!(kcal > 0) || !Number.isFinite(gramos)) return { pct: PCT_MIN, ajustado: true };
  const exacto = aDecimas(((gramos * KCAL_FACTOR[key]) / kcal) * 100) / 10;
  const pct = Math.min(Math.max(exacto, PCT_MIN), PCT_MAX);
  return { pct, ajustado: pct !== exacto };
}

/** − / + on the kcal goal: snap to the nearest multiple of 50, then step 50; clamped 800–6000. */
export function pasoKcal(actual: number, dir: 1 | -1) {
  const base = Math.round((Number.isFinite(actual) ? actual : 2000) / 50) * 50;
  return Math.min(Math.max(base + dir * 50, KCAL_META_MIN), KCAL_META_MAX);
}

export function kcalMetaValida(k: number) {
  return Number.isFinite(k) && k >= KCAL_META_MIN && k <= KCAL_META_MAX;
}

export function sumaPct(p: PctMacros) {
  return MACRO_KEYS.reduce((s, k) => s + aDecimas(p[k]), 0) / 10;
}

/** "32 %" when whole, "26,7 %" otherwise. */
export function formatPct(n: number) {
  const r = aDecimas(n) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1).replace(".", ",")} %`;
}

/** Percentages to use for a saved goal row: stored ones, or derived+normalized from grams. */
export function pctDeMetas(m: { pct_proteinas?: number | null; pct_carbohidratos?: number | null; pct_grasas?: number | null; proteinas_g: number; carbohidratos_g: number; grasas_g: number }) {
  if (m.pct_proteinas != null && m.pct_carbohidratos != null && m.pct_grasas != null) {
    return { pct: { proteinas: Number(m.pct_proteinas), carbohidratos: Number(m.pct_carbohidratos), grasas: Number(m.pct_grasas) }, derivado: false };
  }
  return { pct: pctDesdeGramos({ proteinas_g: Number(m.proteinas_g), carbohidratos_g: Number(m.carbohidratos_g), grasas_g: Number(m.grasas_g) }), derivado: true };
}

/** The only shape written for kcal+macros (adjust screen, onboarding, suggestions). */
export function filaMacros(kcal: number, pct: PctMacros) {
  return { calorias: Math.round(kcal), ...gramosDesdePct(kcal, pct), pct_proteinas: pct.proteinas, pct_carbohidratos: pct.carbohidratos, pct_grasas: pct.grasas };
}

export const CAMPOS_OTROS_LIMITES = ["grasas_saturadas_g", "fibra_g", "azucares_g", "sodio_mg"] as const;
/** The only shape written for optional limits (0 / empty = not used → null). */
export function filaOtrosLimites(v: Partial<Record<(typeof CAMPOS_OTROS_LIMITES)[number], number>>) {
  const o = {} as Record<(typeof CAMPOS_OTROS_LIMITES)[number], number | null>;
  for (const k of CAMPOS_OTROS_LIMITES) o[k] = v[k] && v[k]! > 0 ? Math.round(v[k]!) : null;
  return o;
}

/** Suggested goals expressed as kcal + percentages (grams recomputed so they match). */
export function metasSugeridasFila(p: DatosPerfil) {
  const s = metasSugeridas(p);
  return filaMacros(s.calorias, pctDesdeGramos(s));
}
