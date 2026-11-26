// Capa de IA de Balance: un adaptador por proveedor detrás de una interfaz mínima.
// Pura (el `fetch` y la espera se inyectan para poder probarla). Nunca registra lo que se envía ni lo que se recibe.

/** Error al llamar a la IA. `retryable`: tiene sentido esperar y volver a probar (5xx, 429, red, tiempo agotado). */
export class AiError extends Error {
  constructor(public status: number, public retryable: boolean, message: string) {
    super(message);
  }
}

/** Mensaje único que ve el usuario cuando la IA falla (tras el reintento). */
export const AI_UNAVAILABLE = "Error, inténtalo más tarde.";

/** Una parte de la petición: texto o imagen en base64. */
export type AiPart = { text: string } | { image: string; mime: string };

export interface AiRequest {
  parts: AiPart[];
  /** Esquema JSON de la respuesta (formato de Gemini: tipos en mayúsculas). */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface AiProvider {
  /** Devuelve el JSON que ha generado el modelo, ya interpretado. Lanza `AiError`. */
  generate(req: AiRequest): Promise<unknown>;
}

export interface RetryOptions {
  /** Espera entre el primer intento y el segundo (por defecto, 5 s). */
  waitMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Ejecuta `fn`; si falla con un error que se arregla esperando, espera 5 s y lo intenta UNA vez más.
 * Si el segundo intento también falla, lanza el error. Los errores que no se arreglan esperando
 * (petición o clave mal) se lanzan al momento.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof AiError) || !e.retryable) throw e;
    await sleep(opts.waitMs ?? 5000);
    return await fn();
  }
}

// ───────────────────────── Gemini ─────────────────────────

export interface GeminiOptions {
  apiKey: string;
  /** Modelos por orden de preferencia: si uno no existe (404), se prueba el siguiente. */
  models: string[];
  fetch?: typeof fetch;
  /** Tiempo máximo de cada llamada. */
  timeoutMs?: number;
}

/** Modelos por defecto (con nivel gratuito y visión). Se pueden cambiar con el secreto GEMINI_MODEL, separados por comas. */
export const DEFAULT_GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];

export function geminiModels(env: string | undefined): string[] {
  const list = (env ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9.\-]+$/i.test(s));
  return list.length > 0 ? list : DEFAULT_GEMINI_MODELS;
}

export function gemini(opts: GeminiOptions): AiProvider {
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;

  async function call(model: string, req: AiRequest): Promise<unknown> {
    const body = {
      contents: [{
        parts: req.parts.map((p) => "text" in p ? { text: p.text } : { inline_data: { mime_type: p.mime, data: p.image } }),
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: req.schema,
        maxOutputTokens: req.maxTokens ?? 400,
        temperature: 0,
      },
    };
    let res: Response;
    try {
      res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Red caída o tiempo agotado.
      throw new AiError(0, true, "gemini: sin respuesta");
    }
    if (res.status === 404) throw new AiError(404, false, "gemini: modelo no disponible");
    if (res.status === 429 || res.status >= 500) throw new AiError(res.status, true, `gemini: ${res.status}`);
    if (!res.ok) throw new AiError(res.status, false, `gemini: ${res.status}`);
    const data = await res.json().catch(() => null) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new AiError(502, true, "gemini: respuesta vacía");
    try {
      return JSON.parse(text);
    } catch {
      throw new AiError(502, true, "gemini: respuesta no válida");
    }
  }

  return {
    async generate(req) {
      let last: AiError | null = null;
      for (const model of opts.models) {
        try {
          return await call(model, req);
        } catch (e) {
          // Un modelo que no existe no se arregla esperando: se pasa al siguiente.
          if (e instanceof AiError && e.status === 404) {
            last = e;
            continue;
          }
          throw e;
        }
      }
      throw last ?? new AiError(404, false, "gemini: sin modelos");
    },
  };
}
