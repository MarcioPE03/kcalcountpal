import type { z } from "zod";
import { GEMINI_BASE_URL } from "./ai-model";

export const MENSAJE_ERROR_IA = "Ocurrió un error con la IA. Intentá nuevamente en unos minutos.";

export class GeminiError extends Error {
  constructor(public motivo: string) {
    super(motivo);
  }
}

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } };

export const texto = (t: string): Parte => ({ text: t });
/** Accepts a data URL (data:mime;base64,...) or raw base64 + mime. */
export function binario(dataUrlOrB64: string, mime?: string): Parte {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrlOrB64);
  return { inline_data: { mime_type: m ? m[1]! : mime ?? "application/octet-stream", data: m ? m[2]! : dataUrlOrB64 } };
}

function limpiarSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(limpiarSchema);
  if (s && typeof s === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (k !== "$schema") o[k] = limpiarSchema(v);
    return o;
  }
  return s;
}

/** One generateContent call, no retries, thinking disabled. Throws GeminiError with a log reason. */
export async function llamarGemini(opts: { model: string; system?: string; partes: Parte[]; schema?: z.ZodTypeAny }): Promise<string> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new GeminiError("FALTA_GEMINI_API_KEY");
  const generationConfig: Record<string, unknown> = { thinkingConfig: { thinkingBudget: 0 } };
  if (opts.schema) {
    const { zodSchema } = await import("ai");
    generationConfig["responseMimeType"] = "application/json";
    generationConfig["responseJsonSchema"] = limpiarSchema(await zodSchema(opts.schema).jsonSchema);
  }
  const body: Record<string, unknown> = { contents: [{ role: "user", parts: opts.partes }], generationConfig };
  if (opts.system) body["systemInstruction"] = { parts: [{ text: opts.system }] };

  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE_URL}/models/${opts.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new GeminiError(`RED: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 429 || txt.includes("RESOURCE_EXHAUSTED")) throw new GeminiError("LIMITE_GEMINI");
    throw new GeminiError(`HTTP_${res.status}: ${txt.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) throw new GeminiError(`BLOQUEADO: ${json.promptFeedback.blockReason}`);
  const c = json.candidates?.[0];
  const out = (c?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!out) throw new GeminiError(`SIN_TEXTO: ${c?.finishReason ?? "desconocido"}`);
  return out;
}

/** Calls Gemini with a JSON schema and parses the result; parse failures throw ParseError. */
export class ParseError extends Error {}
export async function llamarGeminiJSON<T extends z.ZodTypeAny>(opts: { model: string; system?: string; partes: Parte[]; schema: T }): Promise<z.infer<T>> {
  const raw = await llamarGemini(opts);
  try {
    return opts.schema.parse(JSON.parse(raw));
  } catch (e) {
    throw new ParseError((e as Error).message);
  }
}

export function logErrorIA(contexto: string, e: unknown) {
  const motivo = e instanceof GeminiError ? e.motivo : (e as Error)?.message ?? String(e);
  console.error(`[IA] ${contexto}: ${motivo}`);
}
