// Server-only, provider-agnostic chat client with automatic model selection,
// retries and failover. All providers speak the OpenAI-compatible chat API.

import {
  getFallbackProviderId,
  getProviderConfig,
  getProviderId,
  type ProviderConfig,
  type ProviderId,
} from "./config.server";

/** A multimodal content part (text, image or document) for a chat message. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  messages: ChatMessage[];
  /** Explicit model override; skips automatic selection. */
  model?: string;
  json?: boolean;
  temperature?: number;
}

// Speed first: fail fast and move to the next model instead of waiting out a
// slow provider. One retry only for the very first model.
const MAX_ATTEMPTS_PER_MODEL = 1;
const REQUEST_TIMEOUT_MS = 18_000;

/** Errors that mean: try the same model again, then the next model. */
function isTransient(status: number) {
  return status === 429 || status === 408 || status === 500 || status >= 502;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(
  cfg: ProviderConfig,
  key: string,
  model: string,
  opts: ChatOptions,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...cfg.headers,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.6,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`${cfg.id}/${model} error ${res.status}: ${text.slice(0, 400)}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string; code?: number };
    };
    if (data.error) {
      const err = new Error(`${cfg.id}/${model} error: ${data.error.message ?? "unknown"}`);
      (err as { status?: number }).status = data.error.code ?? 503;
      throw err;
    }
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) {
      const err = new Error(`${cfg.id}/${model} returned an empty response`);
      (err as { status?: number }).status = 503;
      throw err;
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function runProvider(
  id: ProviderId,
  opts: ChatOptions,
  errors: string[],
): Promise<string | undefined> {
  const cfg = getProviderConfig(id);
  const key = process.env[cfg.keyEnv];
  if (!key) {
    errors.push(`${cfg.id}: missing ${cfg.keyEnv}`);
    return undefined;
  }

  const models = opts.model ? [opts.model] : cfg.models;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const started = Date.now();
        const content = await callModel(cfg, key, model, opts);
        console.log(`[ai] ${cfg.id} · ${model} · ${Date.now() - started}ms · attempt ${attempt}`);
        return content;
      } catch (error) {
        const status = (error as { status?: number }).status;
        const aborted = error instanceof Error && error.name === "AbortError";
        const message = aborted ? `${cfg.id}/${model} timed out` : String(error);
        errors.push(message);
        console.warn(`[ai] attempt ${attempt} failed — ${message}`);

        const retryable = aborted || status === undefined || isTransient(status);
        if (!retryable) break; // hard error (400/401/403/404) — move to next model
        if (attempt < MAX_ATTEMPTS_PER_MODEL) await sleep(200 * attempt);
      }
    }
  }
  return undefined;
}

/**
 * Send a chat request. Tries each configured model in priority order with
 * retries, then falls back to the secondary provider. Throws only when
 * everything has failed.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  const errors: string[] = [];
  const primary = getProviderId();

  const result = await runProvider(primary, opts, errors);
  if (result !== undefined) return result;

  const fallback = getFallbackProviderId(primary);
  if (fallback) {
    // Provider-specific model ids don't transfer — let the fallback pick its own.
    const fallbackResult = await runProvider(fallback, { ...opts, model: undefined }, errors);
    if (fallbackResult !== undefined) return fallbackResult;
  }

  console.error(`[ai] all providers/models failed:\n${errors.join("\n")}`);
  if (errors.some((e) => e.includes(" 429"))) throw new Error("RATE_LIMIT");
  if (errors.some((e) => e.includes(" 402"))) throw new Error("CREDITS");
  throw new Error("AI_UNAVAILABLE");
}
