import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { NUTRIENTES, normalizarIngredientes, sumar, type Ingrediente, type Nutrientes } from "./nutri";
import { dedupRecientes, favoritoDesde, type FilaNueva, type ItemComida } from "./mis-comidas";
import { dedupRecientesEntrenamientos, favoritoEntrenamientoDesde, type ItemEnt } from "./mis-entrenamientos";

export type Comida = Tables<"comidas">;
export type Metas = Tables<"metas_diarias">;
export type Perfil = Tables<"profiles">;

export async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sin sesión");
  return data.user.id;
}

export const comidaANutrientes = (c: Comida): Nutrientes => ({
  calorias: Number(c.calorias),
  proteinas: Number(c.proteinas_g),
  carbohidratos: Number(c.carbohidratos_g),
  grasas: Number(c.grasas_g),
  grasas_saturadas: Number(c.grasas_saturadas_g),
  fibra: Number(c.fibra_g),
  azucares: Number(c.azucares_g),
  sodio_mg: Number(c.sodio_mg),
});

export const nutrientesAColumnas = (t: Nutrientes) => ({
  calorias: t.calorias,
  proteinas_g: t.proteinas,
  carbohidratos_g: t.carbohidratos,
  grasas_g: t.grasas,
  grasas_saturadas_g: t.grasas_saturadas,
  fibra_g: t.fibra,
  azucares_g: t.azucares,
  sodio_mg: t.sodio_mg,
});

export const totalDia = (cs: Comida[]) => sumar(cs.map(comidaANutrientes));

export const comidasDiaQuery = (fecha: string) =>
  queryOptions({
    queryKey: ["comidas", fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comidas")
        .select("*")
        .eq("fecha", fecha)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const comidasRangoQuery = (desde: string, hasta: string) =>
  queryOptions({
    queryKey: ["comidas-rango", desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comidas")
        .select("*")
        .gte("fecha", desde)
        .lte("fecha", hasta);
      if (error) throw error;
      return data;
    },
  });

export const fechasConComidasQuery = (desde: string, hasta: string) =>
  queryOptions({
    queryKey: ["comidas-fechas", desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase.from("comidas").select("fecha").gte("fecha", desde).lte("fecha", hasta);
      if (error) throw error;
      return [...new Set(data.map((r) => r.fecha))];
    },
  });

export const comidaQuery = (id: string) =>
  queryOptions({
    queryKey: ["comida", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("comidas").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const recientesQuery = () =>
  queryOptions({
    queryKey: ["recientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comidas")
        .select("*")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return dedupRecientes(data);
    },
  });

// ---------- Favoritos (copias independientes de comidas) ----------

export type Favorito = Tables<"favoritos">;

export const favoritosQuery = () =>
  queryOptions({
    queryKey: ["favoritos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("favoritos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

/** Upsert by key: marking twice never duplicates. */
export async function crearFavorito(item: ItemComida) {
  const user_id = await uid();
  const { error } = await supabase
    .from("favoritos")
    .upsert({ ...favoritoDesde(item), ingredientes: favoritoDesde(item).ingredientes as never, user_id }, { onConflict: "user_id,clave", ignoreDuplicates: true });
  if (error) throw error;
}

export async function borrarFavoritoPorClave(clave: string) {
  const { error } = await supabase.from("favoritos").delete().eq("clave", clave);
  if (error) throw error;
}

export async function renombrarFavorito(id: string, nombre: string) {
  const n = nombre.trim();
  if (!n) throw new Error("Nombre vacío");
  const { error } = await supabase.from("favoritos").update({ nombre: n, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function registrarVarias(filas: FilaNueva[]) {
  const user_id = await uid();
  const { error } = await supabase.from("comidas").insert(filas.map((f) => ({ ...f, ingredientes: f.ingredientes as never, user_id })));
  if (error) throw error;
  return filas.length;
}

export const metasQuery = () =>
  queryOptions({
    queryKey: ["metas"],
    queryFn: async () => {
      const id = await uid();
      const { data, error } = await supabase.from("metas_diarias").select("*").eq("user_id", id).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: creado, error: e2 } = await supabase
        .from("metas_diarias")
        .insert({ user_id: id })
        .select()
        .single();
      if (e2) throw e2;
      return creado;
    },
  });

export const perfilQuery = () =>
  queryOptions({
    queryKey: ["perfil"],
    queryFn: async () => {
      const id = await uid();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: creado, error: e2 } = await supabase.from("profiles").insert({ id }).select().single();
      if (e2) throw e2;
      return creado;
    },
  });

export type NuevaComida = Omit<TablesInsert<"comidas">, "user_id">;

export async function crearComida(c: NuevaComida) {
  const id = await uid();
  const { data, error } = await supabase.from("comidas").insert({ ...c, user_id: id }).select().single();
  if (error) throw error;
  return data;
}

export async function borrarComida(c: Comida) {
  const { error } = await supabase.from("comidas").delete().eq("id", c.id);
  if (error) throw error;
}

export function copiaDe(c: Comida, fecha: string, momento?: string): NuevaComida {
  return {
    fecha,
    momento: momento ?? c.momento,
    nombre: c.nombre,
    origen: "copia",
    descripcion: c.descripcion,
    confianza: c.confianza,
    kcal_min: c.kcal_min,
    kcal_max: c.kcal_max,
    ingredientes: c.ingredientes,
    calorias: c.calorias,
    proteinas_g: c.proteinas_g,
    carbohidratos_g: c.carbohidratos_g,
    grasas_g: c.grasas_g,
    grasas_saturadas_g: c.grasas_saturadas_g,
    fibra_g: c.fibra_g,
    azucares_g: c.azucares_g,
    sodio_mg: c.sodio_mg,
  };
}

export function leerIngredientes(c: Comida): Ingrediente[] {
  return normalizarIngredientes(c.ingredientes);
}

// ---------- Pesos (única fuente de verdad del peso) ----------

export type Peso = Tables<"pesos">;

export const pesosQuery = () =>
  queryOptions({
    queryKey: ["pesos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pesos").select("*").order("fecha");
      if (error) throw error;
      return data.map((p) => ({ ...p, peso_kg: Number(p.peso_kg) }));
    },
  });

/** Creates or updates the weight for that day. Never writes profiles.peso_kg. */
export async function guardarPeso(fecha: string, peso_kg: number) {
  const id = await uid();
  const { error } = await supabase
    .from("pesos")
    .upsert({ user_id: id, fecha, peso_kg, updated_at: new Date().toISOString() }, { onConflict: "user_id,fecha" });
  if (error) throw error;
}

export async function actualizarPeso(idReg: string, fecha: string, peso_kg: number) {
  const { error } = await supabase
    .from("pesos")
    .update({ fecha, peso_kg, updated_at: new Date().toISOString() })
    .eq("id", idReg);
  if (error) throw error;
}

export async function borrarPeso(idReg: string) {
  const { error } = await supabase.from("pesos").delete().eq("id", idReg);
  if (error) throw error;
}

export async function ultimoPeso(): Promise<number | null> {
  const { data } = await supabase.from("pesos").select("peso_kg").order("fecha", { ascending: false }).limit(1).maybeSingle();
  return data ? Number(data.peso_kg) : null;
}

export async function guardarPesoMeta(kg: number | null) {
  const id = await uid();
  const { error } = await supabase.from("profiles").update({ peso_meta_kg: kg }).eq("id", id);
  if (error) throw error;
}

// ---------- Entrenamientos ----------

export type Entrenamiento = Tables<"entrenamientos">;
export type NuevoEntrenamiento = { fecha: string; nombre: string; calorias_quemadas: number; duracion_min: number | null };

export const entrenamientosDiaQuery = (fecha: string) =>
  queryOptions({
    queryKey: ["entrenamientos", fecha],
    queryFn: async () => {
      const { data, error } = await supabase.from("entrenamientos").select("*").eq("fecha", fecha).order("created_at");
      if (error) throw error;
      return data.map((e) => ({ ...e, calorias_quemadas: Number(e.calorias_quemadas) }));
    },
  });

export const totalQuemadas = (es: { calorias_quemadas: number | string }[]) =>
  es.reduce((s, e) => s + Number(e.calorias_quemadas), 0);

export async function guardarEntrenamiento(e: NuevoEntrenamiento) {
  const user_id = await uid();
  const { error } = await supabase.from("entrenamientos").insert({ ...e, user_id });
  if (error) throw error;
}

export async function actualizarEntrenamiento(id: string, e: NuevoEntrenamiento) {
  const { error } = await supabase.from("entrenamientos").update({ ...e, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export const entrenamientosRecientesQuery = () =>
  queryOptions({
    queryKey: ["entrenamientos", "recientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entrenamientos").select("*")
        .order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return dedupRecientesEntrenamientos(data.map((e) => ({ ...e, calorias_quemadas: Number(e.calorias_quemadas) })));
    },
  });

export type FavoritoEntrenamiento = Tables<"favoritos_entrenamientos">;

export const favoritosEntrenamientosQuery = () =>
  queryOptions({
    queryKey: ["favoritos-entrenamientos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("favoritos_entrenamientos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((f) => ({ ...f, calorias_quemadas: Number(f.calorias_quemadas) }));
    },
  });

/** Upsert by (user, key): never duplicates. */
export async function guardarFavoritoEntrenamiento(e: ItemEnt) {
  const user_id = await uid();
  const { error } = await supabase.from("favoritos_entrenamientos")
    .upsert({ ...favoritoEntrenamientoDesde(e), user_id }, { onConflict: "user_id,clave" });
  if (error) throw error;
}

export async function quitarFavoritoEntrenamiento(clave: string) {
  const { error } = await supabase.from("favoritos_entrenamientos").delete().eq("clave", clave);
  if (error) throw error;
}

export async function renombrarFavoritoEntrenamiento(id: string, nombre: string) {
  const n = nombre.trim();
  if (!n) throw new Error("Nombre vacío");
  const { error } = await supabase.from("favoritos_entrenamientos").update({ nombre: n }).eq("id", id);
  if (error) throw error;
}

export async function guardarVariosEntrenamientos(filas: NuevoEntrenamiento[]) {
  const user_id = await uid();
  const { error } = await supabase.from("entrenamientos").insert(filas.map((f) => ({ ...f, user_id })));
  if (error) throw error;
  return filas.length;
}

export async function borrarEntrenamiento(id: string) {
  const { error } = await supabase.from("entrenamientos").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Mis productos (per-user barcode products, values per 100 g or per serving) ----------
export type ProductoPropio = Tables<"productos_propios">;
export type NuevoProductoPropio = Omit<TablesInsert<"productos_propios">, "user_id">;

export const productosPropiosQuery = () =>
  queryOptions({
    queryKey: ["productos-propios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos_propios").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export async function guardarProductoPropio(p: NuevoProductoPropio) {
  const user_id = await uid();
  const { error } = await supabase.from("productos_propios").upsert({ ...p, user_id }, { onConflict: "user_id,codigo" });
  if (error) throw error;
}

export async function borrarProductoPropio(codigo: string) {
  const { error } = await supabase.from("productos_propios").delete().eq("codigo", codigo);
  if (error) throw error;
}

/** Row to persist from a product with base values (per 100 g, or per serving when weight is unknown). */
export function filaProductoPropio(
  p: { codigo: string; nombre: string; marca?: string | null; por100: Nutrientes; porcion_g: number | null; porcion_ml: boolean; base?: "100g" | "porcion"; faltantesPrincipales?: string[] },
  categoria: string,
  origen: "etiqueta" | "manual" | "editado",
): NuevoProductoPropio {
  const falt = new Set(p.faltantesPrincipales ?? []);
  const v = (k: keyof Nutrientes) => (falt.has(k) ? null : p.por100[k]);
  return {
    codigo: p.codigo, nombre: p.nombre, marca: p.marca ?? null, categoria, origen, base: p.base ?? "100g",
    porcion_g: p.porcion_g, porcion_ml: p.porcion_ml,
    calorias: p.por100.calorias, proteinas: v("proteinas"), carbohidratos: v("carbohidratos"), grasas: v("grasas"),
    grasas_saturadas: p.por100.grasas_saturadas, fibra: p.por100.fibra, azucares: p.por100.azucares, sodio_mg: p.por100.sodio_mg,
  };
}

/** Single writer for kcal + macro grams + percentages (adjust screen, onboarding, suggestions). */
export async function guardarMetasMacros(kcal: number, pct: import("./nutri").PctMacros) {
  const { filaMacros } = await import("./nutri");
  const user_id = await uid();
  const fila = { ...filaMacros(kcal, pct), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("metas_diarias").update(fila).eq("user_id", user_id).select("user_id");
  if (error) throw error;
  if (!data?.length) {
    const { error: e2 } = await supabase.from("metas_diarias").insert({ user_id, ...fila });
    if (e2) throw e2;
  }
}

/** Writes only the 4 optional limits. */
export async function guardarOtrosLimites(v: Parameters<typeof import("./nutri").filaOtrosLimites>[0]) {
  const { filaOtrosLimites } = await import("./nutri");
  const user_id = await uid();
  const { error } = await supabase.from("metas_diarias").update({ ...filaOtrosLimites(v), updated_at: new Date().toISOString() }).eq("user_id", user_id);
  if (error) throw error;
}

export function invalidarMetas(qc: import("@tanstack/react-query").QueryClient) {
  for (const k of ["metas", "comidas", "entrenamientos", "pesos", "perfil"]) qc.invalidateQueries({ queryKey: [k] });
  qc.invalidateQueries();
}
