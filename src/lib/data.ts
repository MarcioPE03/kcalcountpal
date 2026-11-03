import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { NUTRIENTES, sumar, type Ingrediente, type Nutrientes } from "./nutri";

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
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      const vistos = new Set<string>();
      return data.filter((c) => {
        const k = c.nombre.trim().toLowerCase();
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      }).slice(0, 15);
    },
  });

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

export async function urlFoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("fotos-comidas").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function subirFoto(blob: Blob): Promise<string> {
  const id = await uid();
  const path = `${id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("fotos-comidas")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export type NuevaComida = Omit<TablesInsert<"comidas">, "user_id">;

export async function crearComida(c: NuevaComida) {
  const id = await uid();
  const { data, error } = await supabase.from("comidas").insert({ ...c, user_id: id }).select().single();
  if (error) throw error;
  return data;
}

/** Deletes a meal and its photo, unless another (copied) meal still uses it. */
export async function borrarComida(c: Comida) {
  const { error } = await supabase.from("comidas").delete().eq("id", c.id);
  if (error) throw error;
  if (c.foto_path) {
    const { count } = await supabase
      .from("comidas")
      .select("id", { count: "exact", head: true })
      .eq("foto_path", c.foto_path);
    if (!count) await supabase.storage.from("fotos-comidas").remove([c.foto_path]);
  }
}

export function copiaDe(c: Comida, fecha: string, momento?: string): NuevaComida {
  return {
    fecha,
    momento: momento ?? c.momento,
    nombre: c.nombre,
    origen: "copia",
    descripcion: c.descripcion,
    foto_path: c.foto_path,
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
  const arr = Array.isArray(c.ingredientes) ? (c.ingredientes as unknown as Ingrediente[]) : [];
  return arr.filter((i) => i && typeof i === "object" && "por_gramo" in i).map((i) => {
    const out = { ...i };
    for (const k of NUTRIENTES) out[k] = Number(out[k]) || 0;
    return out;
  });
}
