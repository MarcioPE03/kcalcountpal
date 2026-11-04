import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OFF_FIELDS, codigoValido, normalizarCodigo, parseProducto, productoDesdePropio, type FilaProductoPropio, type ParseOFF } from "./off";

export type BuscarProductoRespuesta =
  | ParseOFF
  | { ok: false; motivo: "no_encontrado" | "codigo_invalido" | "red"; nombre: null };

export const buscarProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ codigo: z.string().max(20) }).parse(input))
  .handler(async ({ data, context }): Promise<BuscarProductoRespuesta> => {
    const crudo = data.codigo.replace(/\s/g, "");
    if (!codigoValido(crudo)) return { ok: false, motivo: "codigo_invalido", nombre: null };
    const codigo = normalizarCodigo(crudo);
    // The user's own products always win over Open Food Facts.
    const { data: propio } = await context.supabase.from("productos_propios").select("*").eq("codigo", codigo).maybeSingle();
    if (propio) return { ok: true, producto: productoDesdePropio(propio as unknown as FilaProductoPropio) };
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=${OFF_FIELDS}`,
        {
          headers: { "User-Agent": "KcalCountPal/1.0 (lovable.app)" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.status === 404) return { ok: false, motivo: "no_encontrado", nombre: null };
      if (!res.ok) return { ok: false, motivo: "red", nombre: null };
      const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
      if (json.status !== 1 || !json.product) return { ok: false, motivo: "no_encontrado", nombre: null };
      return parseProducto(codigo, json.product);
    } catch (e) {
      console.error("OFF error", e);
      return { ok: false, motivo: "red", nombre: null };
    }
  });
