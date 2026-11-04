import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RespuestaIA, procesarRespuesta, type AnalisisRespuesta } from "./analisis";
import { AI_GATEWAY_URL, AI_MODEL, TRANSCRIBE_MODEL } from "./ai-model";
import { ESTADO_CATEGORIA, LIMITE_ANALISIS_DEFECTO, LIMITE_CATEGORIAS_DEFECTO, contarCupos, limiteAlcanzado } from "./limits";
import { CATEGORIAS, normalizarCategoria, sumarDias } from "./nutri";

const PROMPT = `Sos un nutricionista argentino experto en estimar porciones y valores nutricionales a partir de fotos y descripciones.
Conocés muy bien la comida argentina y sus preparaciones típicas: milanesa (frita o al horno, napolitana), empanadas (carne, jamón y queso, humita, pollo), asado (vacío, tira, chorizo, morcilla, provoleta), facturas (medialunas de manteca y de grasa, vigilantes, bolas de fraile), mate (amargo o con azúcar), dulce de leche, alfajores, locro, guiso de lentejas, ñoquis, tartas, pizza de molde y fugazzeta, choripán, sándwich de miga, etc.

Reglas:
1. Si el usuario da una descripción, TIENE PRIORIDAD sobre lo que ves en la foto (cantidades, ingredientes, método de cocción).
2. Desglosá el plato en ingredientes con gramos estimados.
3. Incluí SIEMPRE como ingredientes separados y editables lo que no se ve pero es probable: aceite de cocción, manteca, aderezos (mayonesa, aceite de oliva, sal), azúcar en infusiones, pan rallado, etc. Usá cantidades realistas para una preparación casera argentina.
4. Para cada ingrediente estimá: calorias (kcal), proteinas (g), carbohidratos (g), grasas (g), grasas_saturadas (g), fibra (g), azucares (g), sodio_mg (mg). Las calorías deben ser coherentes con 4*proteínas + 4*carbohidratos + 9*grasas.
5. confianza: "alta" si la porción es clara o el usuario dio gramos; "media" si hay que suponer bastante; "baja" si la foto es confusa o la descripción vaga.
6. kcal_min y kcal_max: rango plausible del total según la confianza (más angosto si es alta).
7. nombre_plato corto en español rioplatense (ej: "Milanesa con puré").
8. Si la imagen NO muestra comida ni bebida (o no se puede identificar) y no hay descripción útil, devolvé es_comida=false, motivo_rechazo con una frase breve, e ingredientes vacío.
9. nota: una frase breve opcional con supuestos importantes (o null).
10. categoria de CADA ingrediente, exactamente una de esta lista cerrada: Carnes, Pescados y mariscos, Lácteos y huevos, Verduras, Frutas, Cereales y panificados, Legumbres, Frutos secos y semillas, Dulces y snacks, Bebidas, Aceites y grasas, Otros.
   Clasificá por ingrediente, no por plato. Ejemplos argentinos:
   - Milanesa: carne (Carnes) + pan rallado (Cereales y panificados) + huevo (Lácteos y huevos) + aceite (Aceites y grasas).
   - Empanada: masa (Cereales y panificados) + relleno de carne (Carnes).
   - Dulce de leche, alfajores, facturas, medialunas: Dulces y snacks.
   - Mate, café, gaseosa, jugo: Bebidas (el azúcar agregado: Dulces y snacks).`;

function errorDeGateway(e: unknown): AnalisisRespuesta {
  const status =
    (e as { statusCode?: number })?.statusCode ??
    (e as { cause?: { statusCode?: number } })?.cause?.statusCode;
  console.error("AI error", status, e);
  if (status === 402)
    return { ok: false, codigo: "creditos", mensaje: "El servicio de IA no tiene créditos disponibles en este momento. Probá más tarde o cargá la comida a mano." };
  if (status === 429)
    return { ok: false, codigo: "rate", mensaje: "Hay muchas consultas en este momento. Esperá unos segundos y reintentá." };
  if (status === 403)
    return { ok: false, codigo: "error", mensaje: "El servicio de IA no está disponible ahora. Podés cargar la comida a mano." };
  return { ok: false, codigo: "error", mensaje: "No pudimos analizar la comida. Reintentá o cargala a mano." };
}

const AnalizarInput = z.object({
  imagen: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/)
    .max(3_000_000)
    .nullable(),
  descripcion: z.string().max(1000).nullable(),
  fecha_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const analizarComida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalizarInput.parse(input))
  .handler(async ({ data, context }): Promise<AnalisisRespuesta> => {
    const { supabase, userId } = context;
    const descripcion = data.descripcion?.trim() || null;
    if (!data.imagen && !descripcion) {
      return { ok: false, codigo: "invalido", mensaje: "Sacá una foto o describí la comida." };
    }

    // Validate client local date is within ±1 day of server UTC date.
    const hoyUtc = new Date().toISOString().slice(0, 10);
    const fecha = [sumarDias(hoyUtc, -1), hoyUtc, sumarDias(hoyUtc, 1)].includes(data.fecha_local)
      ? data.fecha_local
      : hoyUtc;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("limite_analisis_diario")
      .eq("id", userId)
      .maybeSingle();
    const limite = perfil?.limite_analisis_diario ?? LIMITE_ANALISIS_DEFECTO;
    const { data: filas } = await supabase
      .from("analisis_ia")
      .select("estado")
      .eq("user_id", userId)
      .eq("fecha_local", fecha);
    // Category classifications have their own quota and never consume this one.
    const usados = contarCupos((filas ?? []).map((f) => f.estado)).analisis;
    if (limiteAlcanzado(usados, limite)) {
      return {
        ok: false,
        codigo: "limite",
        mensaje: `Llegaste a ${limite} análisis con IA hoy. Mañana se renueva; mientras tanto podés cargar comidas a mano o repetir recientes.`,
      };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, codigo: "error", mensaje: "La IA no está configurada." };

    const registrar = (estado: string) =>
      supabase.from("analisis_ia").insert({ user_id: userId, fecha_local: fecha, estado });

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText, Output } = await import("ai");
      const provider = createOpenAI({
        baseURL: AI_GATEWAY_URL,
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });

      const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [];
      content.push({
        type: "text",
        text: descripcion
          ? `Descripción del usuario (tiene prioridad): ${descripcion}`
          : "El usuario no dio descripción; estimá solo con la imagen.",
      });
      if (data.imagen) content.push({ type: "image", image: new URL(data.imagen) });

      const result = streamText({
        model: provider.responses(AI_MODEL),
        instructions: PROMPT,
        messages: [{ role: "user", content }],
        output: Output.object({ schema: RespuestaIA }),
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      let parsed;
      try {
        parsed = RespuestaIA.parse(await result.output);
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status) throw e;
        console.error("AI parse error", e);
        await registrar("error");
        return { ok: false, codigo: "error", mensaje: "La IA devolvió una respuesta que no pudimos leer. Reintentá." };
      }

      if (!parsed.es_comida || parsed.ingredientes.length === 0) {
        await registrar("no_comida");
        return {
          ok: false,
          codigo: "no_comida",
          mensaje:
            parsed.motivo_rechazo ||
            "No reconocimos comida en la foto. Probá con otra foto, agregá una descripción o cargala a mano.",
        };
      }

      await registrar("ok");
      return { ok: true, resultado: procesarRespuesta(parsed), usados: usados + 1, limite };
    } catch (e) {
      return errorDeGateway(e);
    }
  });

const TranscribirInput = z.object({
  audio: z.string().max(8_000_000),
  mime: z.string().regex(/^audio\//),
});

export const transcribirAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranscribirInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; texto: string } | { ok: false; mensaje: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, mensaje: "La transcripción no está configurada." };
    try {
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      if (!bytes.length) return { ok: false, mensaje: "No se grabó audio." };
      const ext = data.mime.includes("webm") ? "webm" : data.mime.includes("mp4") ? "m4a" : data.mime.includes("ogg") ? "ogg" : "wav";
      const mime = data.mime.split(";")[0] ?? "audio/webm";
      const form = new FormData();
      form.append("model", TRANSCRIBE_MODEL);
      form.append("file", new File([bytes], `audio.${ext}`, { type: mime }));
      form.append("response_format", "json");
      form.append("language", "es");
      const res = await fetch(`${AI_GATEWAY_URL}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        console.error("transcribe error", res.status, await res.text());
        return { ok: false, mensaje: res.status === 402 ? "Sin créditos de IA para transcribir." : "No pudimos transcribir el audio. Escribilo a mano." };
      }
      const json = (await res.json()) as { text?: string };
      return { ok: true, texto: (json.text ?? "").trim() };
    } catch (e) {
      console.error(e);
      return { ok: false, mensaje: "No pudimos transcribir el audio. Escribilo a mano." };
    }
  });

const ClasificarInput = z.object({
  nombre: z.string().min(1).max(200),
  fecha_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Classifies a product name into one of the closed categories. Never throws: falls back to "Otros". */
export const clasificarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClasificarInput.parse(input))
  .handler(async ({ data, context }): Promise<{ categoria: string; ok: boolean }> => {
    const { supabase, userId } = context;
    const fallback = { categoria: "Otros", ok: false };
    try {
      const hoyUtc = new Date().toISOString().slice(0, 10);
      const fecha = [sumarDias(hoyUtc, -1), hoyUtc, sumarDias(hoyUtc, 1)].includes(data.fecha_local) ? data.fecha_local : hoyUtc;
      const { data: perfil } = await supabase.from("profiles").select("limite_categorias_diario").eq("id", userId).maybeSingle();
      const limite = perfil?.limite_categorias_diario ?? LIMITE_CATEGORIAS_DEFECTO;
      const { data: filas } = await supabase.from("analisis_ia").select("estado").eq("user_id", userId).eq("fecha_local", fecha);
      if (limiteAlcanzado(contarCupos((filas ?? []).map((f) => f.estado)).categorias, limite)) return fallback;

      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) return fallback;
      await supabase.from("analisis_ia").insert({ user_id: userId, fecha_local: fecha, estado: ESTADO_CATEGORIA });

      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText, Output } = await import("ai");
      const provider = createOpenAI({
        baseURL: AI_GATEWAY_URL,
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const result = streamText({
        model: provider.responses(AI_MODEL),
        instructions: `Clasificá el producto alimenticio en exactamente una categoría de esta lista: ${CATEGORIAS.join(", ")}. Si no estás seguro, usá "Otros".`,
        messages: [{ role: "user", content: `Producto: ${data.nombre}` }],
        output: Output.object({ schema: z.object({ categoria: z.enum(CATEGORIAS) }) }),
        maxRetries: 0,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
      });
      const out = await result.output;
      return { categoria: normalizarCategoria(out.categoria), ok: true };
    } catch (e) {
      console.error("clasificar error", e);
      return fallback;
    }
  });
