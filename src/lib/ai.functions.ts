import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RespuestaIA, procesarRespuesta, type AnalisisRespuesta } from "./analisis";
import { MAX_ACLARACION, MAX_INGREDIENTES_CORRECCION, RespuestaCorreccionIA, aplicarCorreccion } from "./correccion";
import type { Ingrediente } from "./nutri";
import { AI_GATEWAY_URL, AI_MODEL, TRANSCRIBE_MODEL } from "./ai-model";
import { ESTADO_CATEGORIA, ESTADO_CORRECCION, ESTADO_CORRECCION_EN_CURSO, ESTADO_CORRECCION_FALLIDA, ESTADO_ETIQUETA_FALLIDA, LIMITE_CORRECCIONES_DEFECTO, LIMITE_INTENTOS_CORRECCION, correccionEnCurso, LIMITE_ANALISIS_DEFECTO, LIMITE_CATEGORIAS_DEFECTO, contarCupos, limiteAlcanzado } from "./limits";
import { normalizarCodigo, normalizarEtiqueta, type ProductoOFF } from "./off";
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
   - Mate, café, gaseosa, jugo: Bebidas (el azúcar agregado: Dulces y snacks).

11. GRASA VISIBLE / PIEL (lista cerrada; ante la duda NO separar):
   - Separá en una fila aparte con descartable=true SOLO en:
     (a) cortes vacunos o de cerdo con grasa visible: bife ancho, asado, costillar, vacío, bondiola, panceta, chuleta. Nombre: "Grasa visible del <corte> (descartable)", categoria "Carnes".
     (b) pollo con piel: pata muslo, muslo, alitas, pollo entero al horno. Nombre: "Piel del pollo", categoria "Carnes".
   - NUNCA separes grasa en lácteos, verduras, frutas, pastas, arroz, panificados, salsas, ensaladas, guisos, milanesas (incluida milanesa de pollo), cortes magros (pechuga sin piel, lomo, peceto, nalga, cuadril) ni preparaciones mixtas donde la grasa no se distingue.
   - Solo si la grasa o la piel se ve en la foto o la descripción la menciona. Si el usuario dice que la sacó o no la comió, no la incluyas.
   - La fila de carne magra NO incluye la grasa/piel separada (sin doble conteo); conserva su grasa intramuscular.
   - En todas las demás filas descartable=false.`;

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

// ---------- Nutrition label reading ----------

const PROMPT_ETIQUETA = `Leés tablas de información nutricional de envases argentinos (rótulo nutricional del Código Alimentario Argentino).
Términos habituales: "Valor energético" (kcal y/o kJ), "Hidratos de carbono" o "Carbohidratos", "Proteínas", "Grasas totales", "Grasas saturadas", "Grasas trans", "Fibra alimentaria", "Sodio" (en mg).
Reglas:
1. Si la imagen NO es una tabla nutricional legible, devolvé es_etiqueta=false y todos los valores en null.
2. Si hay columna "por 100 g" (o 100 ml) y otra "por porción", usá SIEMPRE la de 100 g y poné columna="100g". Si solo hay por porción, columna="porcion".
3. porcion_cantidad y porcion_unidad: el tamaño de la porción tal como figura ("30 g" → 30, "g"; "200 ml" → 200, "ml"; "1 unidad" sin gramos → 1, "unidad"). Si dice "1 unidad (25 g)", usá 25 g. Si no figura, null.
4. Preferí kcal sobre kJ: si hay kcal, poné kcal y kj null. Solo si no hay kcal poné kj.
5. azucares: azúcares TOTALES (no "añadidos"). Si no figura, null.
6. sodio_mg en mg. Si solo figura sal, poné sal_g (gramos) y sodio_mg null.
7. "0", "0 g", "no contiene" y "No aporta cantidades significativas de …" se leen como 0 para los nutrientes nombrados.
8. Si un nutriente no aparece en la tabla, devolvé null (NUNCA 0).
9. Ignorá los % VD (valores diarios) y los octógonos de advertencia ("EXCESO EN …"); solo leé cantidades.
10. Productos en polvo o para preparar: tomá los valores "tal como se vende". Si solo hay valores del producto preparado, usalos y poné solo_preparado=true.
11. nombre: nombre del producto si se ve en la foto, si no null.`;

const n = z.number().nullable();
const LecturaSchema = z.object({
  es_etiqueta: z.boolean(),
  nombre: z.string().nullable(),
  columna: z.enum(["100g", "porcion"]).nullable(),
  porcion_cantidad: n,
  porcion_unidad: z.enum(["g", "ml", "unidad"]).nullable(),
  solo_preparado: z.boolean(),
  kcal: n, kj: n, proteinas: n, carbohidratos: n, grasas: n, grasas_saturadas: n, fibra: n, azucares: n, sodio_mg: n, sal_g: n,
});

const EtiquetaInput = z.object({
  imagen: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(1_500_000),
  codigo: z.string().regex(/^\d{8,13}$/),
  nombre: z.string().max(200).nullable(),
  fecha_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type LeerEtiquetaRespuesta =
  | { ok: true; producto: ProductoOFF }
  | { ok: false; mensaje: string };

export const leerEtiqueta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EtiquetaInput.parse(input))
  .handler(async ({ data, context }): Promise<LeerEtiquetaRespuesta> => {
    const { supabase, userId } = context;
    const hoyUtc = new Date().toISOString().slice(0, 10);
    const fecha = [sumarDias(hoyUtc, -1), hoyUtc, sumarDias(hoyUtc, 1)].includes(data.fecha_local) ? data.fecha_local : hoyUtc;
    const { data: perfil } = await supabase.from("profiles").select("limite_analisis_diario").eq("id", userId).maybeSingle();
    const limite = perfil?.limite_analisis_diario ?? LIMITE_ANALISIS_DEFECTO;
    const { data: filas } = await supabase.from("analisis_ia").select("estado").eq("user_id", userId).eq("fecha_local", fecha);
    if (limiteAlcanzado(contarCupos((filas ?? []).map((f) => f.estado)).analisis, limite)) {
      return { ok: false, mensaje: `Llegaste a ${limite} análisis con IA hoy. Podés cargar el producto a mano.` };
    }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, mensaje: "La IA no está configurada." };
    // Failed readings are logged with an estado that never counts against the quota.
    const registrar = (estado: string) => supabase.from("analisis_ia").insert({ user_id: userId, fecha_local: fecha, estado });
    const codigo = normalizarCodigo(data.codigo);
    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText, Output } = await import("ai");
      const provider = createOpenAI({
        baseURL: AI_GATEWAY_URL,
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const result = streamText({
        model: provider.responses(AI_MODEL),
        instructions: PROMPT_ETIQUETA,
        messages: [{ role: "user", content: [
          { type: "text", text: "Leé la tabla nutricional de esta foto." },
          { type: "image", image: new URL(data.imagen) },
        ] }],
        output: Output.object({ schema: LecturaSchema }),
        maxRetries: 0,
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      let lectura;
      try {
        lectura = LecturaSchema.parse(await result.output);
      } catch (e) {
        if ((e as { statusCode?: number })?.statusCode) throw e;
        console.error("etiqueta parse error", e);
        await registrar(ESTADO_ETIQUETA_FALLIDA);
        return { ok: false, mensaje: "No pudimos leer la etiqueta. Probá con otra foto más nítida." };
      }
      if (!lectura.es_etiqueta) {
        await registrar(ESTADO_ETIQUETA_FALLIDA);
        return { ok: false, mensaje: "La foto no parece una tabla nutricional. Encuadrá solo la tabla, con buena luz." };
      }
      const r = normalizarEtiqueta(codigo, lectura, data.nombre);
      if (!r.ok) {
        await registrar(ESTADO_ETIQUETA_FALLIDA);
        return {
          ok: false,
          mensaje: r.motivo === "invalido"
            ? "Los valores leídos no son coherentes. Probá otra foto o cargalo a mano."
            : "No pudimos leer las calorías de la etiqueta. Probá otra foto o cargalo a mano.",
        };
      }
      await registrar("ok");
      return { ok: true, producto: r.producto };
    } catch (e) {
      await registrar(ESTADO_ETIQUETA_FALLIDA);
      const res = errorDeGateway(e);
      return { ok: false, mensaje: res.ok ? "" : res.mensaje.replace("la comida", "el producto") };
    }
  });

// ---------- Corregir con IA ----------

const PROMPT_CORRECCION = `Sos un nutricionista argentino. Recibís la lista ACTUAL de ingredientes de una comida (cada fila con su id) y una aclaración del usuario. A veces también la foto.

Reglas:
1. La aclaración del usuario tiene prioridad absoluta.
2. Modificá SOLO lo que la aclaración indica. Devolvé TODAS las filas recibidas, cada una con su mismo id y una accion:
   - "sin_cambios": la fila no se toca (copiá sus valores tal cual).
   - "modificada": cambiaste gramos, valores, nombre o categoría. Devolvé los valores nuevos completos.
   - "eliminada": el usuario indica que no la comió o hay que quitarla.
   - "nueva": fila agregada (usá id "nueva-1", "nueva-2", ...).
3. Las filas con editado_manual=true NO se tocan salvo que la aclaración las mencione explícitamente.
4. Si la aclaración dice que sacó grasa, piel o una parte y esa parte está incluida dentro de una fila (no hay fila aparte), devolvé esa fila como "modificada" con menos gramos y menos grasa/kcal. Nunca la dejes como "sin_cambios" en ese caso.
5. Valores por fila para los gramos indicados: calorias, proteinas, carbohidratos, grasas, grasas_saturadas, fibra, azucares (g) y sodio_mg (mg). Coherentes con 4P+4C+9G. Nunca negativos.
6. categoria de la lista cerrada: Carnes, Pescados y mariscos, Lácteos y huevos, Verduras, Frutas, Cereales y panificados, Legumbres, Frutos secos y semillas, Dulces y snacks, Bebidas, Aceites y grasas, Otros.
7. descartable=true solo en filas de grasa visible de cortes vacunos/de cerdo (bife ancho, asado, costillar, vacío, bondiola, panceta, chuleta) o "Piel del pollo" (pata muslo, muslo, alitas, pollo entero al horno). Nunca en milanesas ni cortes magros. Conservá el valor que trae cada fila sin cambios.
8. Si la aclaración es ambigua y no podés saber qué cambiar, devolvé todas las filas como "sin_cambios", cambios vacío y una pregunta breve en "pregunta". Si no, pregunta=null.
9. "cambios": lista breve en español rioplatense explicando cada cambio con su efecto, ej: "Quité 40 g de grasa visible del bife: -360 kcal".`;

const IngEntrada = z.object({
  id: z.string().min(1).max(80),
  nombre: z.string().max(160),
  categoria: z.string().max(60).optional(),
  gramos: z.number().min(0).max(10000),
  calorias: z.number().min(0), proteinas: z.number().min(0), carbohidratos: z.number().min(0), grasas: z.number().min(0),
  grasas_saturadas: z.number().min(0), fibra: z.number().min(0), azucares: z.number().min(0), sodio_mg: z.number().min(0),
  por_gramo: z.record(z.string(), z.number()).optional(),
  editado_manual: z.boolean().optional(),
  descartable: z.boolean().optional(),
});

const CorregirInput = z.object({
  ingredientes: z.array(IngEntrada).min(1).max(MAX_INGREDIENTES_CORRECCION),
  nombre_plato: z.string().max(160),
  aclaracion: z.string().trim().min(1).max(MAX_ACLARACION),
  imagen: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(3_000_000).nullable(),
  fecha_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CorreccionRespuesta =
  | { ok: true; ingredientes: Ingrediente[]; cambios: string[]; pregunta: string | null; usados: number; limite: number }
  | { ok: false; codigo: "limite" | "en_curso" | "creditos" | "rate" | "error"; mensaje: string };

export const corregirComida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CorregirInput.parse(input))
  .handler(async ({ data, context }): Promise<CorreccionRespuesta> => {
    const { supabase, userId } = context;
    const hoyUtc = new Date().toISOString().slice(0, 10);
    const fecha = [sumarDias(hoyUtc, -1), hoyUtc, sumarDias(hoyUtc, 1)].includes(data.fecha_local) ? data.fecha_local : hoyUtc;
    const limite = LIMITE_CORRECCIONES_DEFECTO;

    const { data: filas } = await supabase.from("analisis_ia").select("estado, created_at").eq("user_id", userId).eq("fecha_local", fecha);
    const cupos = contarCupos((filas ?? []).map((f) => f.estado));
    if (cupos.correcciones >= limite) {
      return { ok: false, codigo: "limite", mensaje: `Llegaste a ${limite} correcciones con IA hoy. Mañana se renueva; podés editar los ingredientes a mano.` };
    }
    if (cupos.intentosCorreccion >= LIMITE_INTENTOS_CORRECCION) {
      return { ok: false, codigo: "limite", mensaje: "Hiciste demasiados intentos de corrección hoy. Mañana se renueva; podés editar los ingredientes a mano." };
    }
    if (correccionEnCurso(filas ?? [], Date.now())) {
      return { ok: false, codigo: "en_curso", mensaje: "Ya hay una corrección en curso. Esperá a que termine." };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, codigo: "error", mensaje: "La IA no está configurada." };

    const registrar = (estado: string) => supabase.from("analisis_ia").insert({ user_id: userId, fecha_local: fecha, estado });
    await registrar(ESTADO_CORRECCION_EN_CURSO);

    const antes = data.ingredientes.map((i) => {
      const por_gramo = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, grasas_saturadas: 0, fibra: 0, azucares: 0, sodio_mg: 0 };
      for (const k of Object.keys(por_gramo) as (keyof typeof por_gramo)[]) {
        const p = i.por_gramo?.[k];
        por_gramo[k] = typeof p === "number" && Number.isFinite(p) ? p : i.gramos > 0 ? i[k] / i.gramos : 0;
      }
      return { ...i, por_gramo } as Ingrediente;
    });

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText, Output } = await import("ai");
      const provider = createOpenAI({
        baseURL: AI_GATEWAY_URL,
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const lista = antes.map(({ id, nombre, categoria, gramos, calorias, proteinas, carbohidratos, grasas, grasas_saturadas, fibra, azucares, sodio_mg, editado_manual, descartable }) => ({
        id, nombre, categoria: categoria ?? "Otros", gramos, calorias, proteinas, carbohidratos, grasas, grasas_saturadas, fibra, azucares, sodio_mg,
        editado_manual: !!editado_manual, descartable: !!descartable,
      }));
      const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
        { type: "text", text: `Plato: ${data.nombre_plato || "Comida"}\nIngredientes actuales (JSON):\n${JSON.stringify(lista)}\n\nAclaración del usuario (tiene prioridad): ${data.aclaracion}` },
      ];
      if (data.imagen) content.push({ type: "image", image: new URL(data.imagen) });

      const result = streamText({
        model: provider.responses(AI_MODEL),
        instructions: PROMPT_CORRECCION,
        messages: [{ role: "user", content }],
        output: Output.object({ schema: RespuestaCorreccionIA }),
        maxRetries: 0,
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
        },
      });

      let parsed;
      try {
        parsed = RespuestaCorreccionIA.parse(await result.output);
      } catch (e) {
        if ((e as { statusCode?: number })?.statusCode) throw e;
        console.error("Corrección: respuesta ilegible", e);
        await registrar(ESTADO_CORRECCION_FALLIDA);
        return { ok: false, codigo: "error", mensaje: "La IA devolvió una respuesta que no pudimos leer. Reintentá." };
      }

      let n = 0;
      const r = aplicarCorreccion(antes, parsed, data.aclaracion, data.nombre_plato, () => `c-${Date.now().toString(36)}-${++n}`);
      if (r.pregunta) {
        await registrar(ESTADO_CORRECCION_FALLIDA);
        return { ok: true, ingredientes: antes, cambios: [], pregunta: r.pregunta, usados: cupos.correcciones, limite };
      }
      await registrar(ESTADO_CORRECCION);
      return { ok: true, ingredientes: r.ingredientes, cambios: r.cambios, pregunta: null, usados: cupos.correcciones + 1, limite };
    } catch (e) {
      await registrar(ESTADO_CORRECCION_FALLIDA);
      const err = errorDeGateway(e);
      if (err.ok) return { ok: false, codigo: "error", mensaje: "No pudimos corregir. Reintentá." };
      const codigo = err.codigo === "creditos" || err.codigo === "rate" ? err.codigo : "error";
      return { ok: false, codigo, mensaje: codigo === "error" ? "No pudimos corregir la comida. Reintentá." : err.mensaje };
    }
  });
