/**
 * The only way the engine talks to a language model: a local Ollama server.
 *
 *   OLLAMA_URL    default http://127.0.0.1:11434
 *   OLLAMA_MODEL  default llama3.2:latest   (one model everywhere; the aftermath writer used to ask
 *                                            for llama3:latest, which isn't installed)
 *   STORY_LLM=off  no model calls at all (tests, or playing fully offline): callers use their
 *                  procedural fallbacks
 *
 * Gemini is gone: nothing here sends world data off this machine.
 * Every call returns null on any failure (Ollama not running, timeout, bad output), and every caller
 * has a procedural fallback, so a missing model never breaks a tick or a request.
 */

export const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";

export function llmDisabled(): boolean {
  return String(process.env.STORY_LLM || "").toLowerCase() === "off";
}

export interface GenerateOptions {
  system?: string;
  /** Ask Ollama to return JSON only. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** A local model on CPU can take a while for a few hundred tokens. */
  timeoutMs?: number;
}

let warnedDown = false;

/** Plain-text completion, or null. */
export async function ollamaGenerate(prompt: string, opts: GenerateOptions = {}): Promise<string | null> {
  if (llmDisabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.json ? { format: "json" } : {}),
        stream: false,
        options: { temperature: opts.temperature ?? 0.7, num_predict: opts.maxTokens ?? 300 },
      }),
    });
    if (!res.ok) {
      console.warn(`[llm] Ollama answered ${res.status} for model ${OLLAMA_MODEL}${res.status === 404 ? " (is it pulled? run: ollama pull " + OLLAMA_MODEL + ")" : ""}`);
      return null;
    }
    warnedDown = false;
    const data: any = await res.json();
    const text = String(data.response || "").trim();
    return text.length ? text : null;
  } catch (err: any) {
    if (!warnedDown) {
      console.warn(`[llm] Ollama not reachable at ${OLLAMA_URL} (${err?.name === "AbortError" ? "timed out" : err?.message}); using procedural fallbacks.`);
      warnedDown = true;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON completion parsed to an object, or null (also when the model returns something unparseable). */
export async function ollamaJson<T = any>(prompt: string, opts: GenerateOptions = {}): Promise<T | null> {
  const text = await ollamaGenerate(prompt, { ...opts, json: true });
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    return null;
  }
}
