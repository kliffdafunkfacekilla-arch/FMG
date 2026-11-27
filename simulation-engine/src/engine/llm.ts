/**
 * The only way the engine talks to a language model: a local Ollama server.
 *
 *   OLLAMA_URL    default http://127.0.0.1:11434
 *   OLLAMA_MODEL  default llama3.2:latest   (one model everywhere; the aftermath writer used to ask
 *                                            for llama3:latest, which isn't installed)
 *   STORY_LLM=off  no model calls at all (tests, or playing fully offline): callers use their
 *                  procedural fallbacks
 *   LLM_KEEP_ALIVE default 30m   how long Ollama keeps the model in memory after the last call.
 *                  Every call sends it, so it overrides the server's own OLLAMA_KEEP_ALIVE (which
 *                  this process inherits, hence the different name). "-1" = until unloaded.
 *
 * Model lifetime: a party session warms the model when it starts (warmModel) and unloads it when it
 * closes, as does the server on Ctrl+C and STOP.bat (unloadModel). LLM_KEEP_ALIVE is the backup that
 * frees the memory anyway if nothing says "done" (a crash, a closed browser tab, taskkill).
 *
 * Gemini is gone: nothing here sends world data off this machine.
 * Every call returns null on any failure (Ollama not running, timeout, bad output), and every caller
 * has a procedural fallback, so a missing model never breaks a tick or a request.
 */

export const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";

export function getOllamaUrl(): string {
  return (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || "llama3.2:latest";
}

export function llmDisabled(): boolean {
  return String(process.env.STORY_LLM || "").toLowerCase() === "off";
}

/** Ollama's keep_alive: a duration ("30m") or seconds; a bare number like "-1" is sent as a number. */
export function getKeepAlive(): string | number {
  const v = String(process.env.LLM_KEEP_ALIVE || "30m").trim();
  return /^-?\d+$/.test(v) ? Number(v) : v;
}

/** One request that only changes how long the model stays loaded (an empty prompt generates nothing). */
async function setModelResidency(keepAlive: string | number, timeoutMs: number): Promise<boolean> {
  if (llmDisabled()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getOllamaUrl()}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: getOllamaModel(), keep_alive: keepAlive }),
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Load the model now, so the first real prompt doesn't wait for it. Never throws. */
export function warmModel(): Promise<boolean> {
  return setModelResidency(getKeepAlive(), 120000);
}

/** Free the model's memory now (nothing else needs it). Never throws. */
export function unloadModel(): Promise<boolean> {
  return setModelResidency(0, 5000);
}

export class LlmError extends Error {
  public readonly stage: string;
  public readonly statusCode: number;

  constructor(stage: string, message: string, statusCode = 502) {
    super(message);
    this.name = "LlmError";
    this.stage = stage;
    this.statusCode = statusCode;
  }
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

/** Strict plain-text completion: throws LlmError with the exact failure reason instead of returning null. */
export async function ollamaGenerateStrict(
  prompt: string,
  opts: GenerateOptions & { stage?: string } = {}
): Promise<string> {
  const stage = opts.stage || "llm_generate";
  if (llmDisabled()) {
    throw new LlmError(stage, "LLM is disabled (STORY_LLM=off); refusing to fake AI output.", 503);
  }
  const url = getOllamaUrl();
  const model = getOllamaModel();
  const timeoutMs = opts.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.json ? { format: "json" } : {}),
        stream: false,
        keep_alive: getKeepAlive(),
        options: { temperature: opts.temperature ?? 0.7, num_predict: opts.maxTokens ?? 300 },
      }),
    });
    if (!res.ok) {
      let bodySnippet = "";
      try {
        bodySnippet = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 140);
      } catch {}
      throw new LlmError(
        stage,
        `Ollama HTTP ${res.status} for model '${model}' at ${url}${res.status === 404 ? ` (pull it with: ollama pull ${model})` : ""}${bodySnippet ? `: ${bodySnippet}` : ""}`,
        502
      );
    }
    warnedDown = false;
    const data: any = await res.json();
    const text = String(data.response || "").trim();
    if (process.env.LLM_LOG === "1") {
      // Ollama reports durations in nanoseconds; load_duration > 0 means this call (re)loaded the model.
      const ms = (ns: any) => Math.round(Number(ns || 0) / 1e6);
      const label = (opts.system || prompt).replace(/\s+/g, " ").slice(0, 60);
      console.log(
        `[llm] ${stage} | ${ms(data.total_duration)} ms total, load ${ms(data.load_duration)} ms | ` +
        `prompt ${data.prompt_eval_count ?? "?"} tok in ${ms(data.prompt_eval_duration)} ms, ` +
        `out ${data.eval_count ?? "?"}/${opts.maxTokens ?? 300} tok in ${ms(data.eval_duration)} ms` +
        `${opts.json ? " | json" : ""} | "${label}"`
      );
    }
    if (!text.length) {
      throw new LlmError(stage, `Ollama returned an empty response for model '${model}'`, 502);
    }
    return text;
  } catch (err: any) {
    if (err instanceof LlmError) throw err;
    const reason =
      err?.name === "AbortError"
        ? `Ollama timed out after ${timeoutMs}ms for model '${model}' at ${url}`
        : `Ollama unreachable at ${url}: ${err?.message || String(err)}`;
    throw new LlmError(stage, reason, 503);
  } finally {
    clearTimeout(timer);
  }
}

/** Plain-text completion, or null. */
export async function ollamaGenerate(prompt: string, opts: GenerateOptions = {}): Promise<string | null> {
  if (llmDisabled()) return null;
  try {
    return await ollamaGenerateStrict(prompt, { ...opts, stage: "llm_generate" });
  } catch (err: any) {
    if (!warnedDown) {
      console.warn(`[llm] ${err?.message || err}; using procedural fallbacks.`);
      warnedDown = true;
    }
    return null;
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
