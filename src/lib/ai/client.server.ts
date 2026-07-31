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

// Speed first: fail fast and hedge onto the next model instead of waiting out
// a slow provider.
const REQUEST_TIMEOUT_MS = 15_000;


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
        // Skip hidden reasoning passes on models that support it — big latency win.
        ...(model.startsWith("openai/gpt-5") ? { reasoning_effort: "none" } : {}),
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

/**
 * Run one provider with "hedging": start the fastest model first and, if it
 * hasn't answered within HEDGE_AFTER_MS, fire the next model in parallel and
 * take whichever finishes first. This cuts tail latency dramatically without
 * changing the response quality of the primary model.
 */
const HEDGE_AFTER_MS = 3_500;

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
  const inFlight = new Set<Promise<string>>();
  let index = 0;

  const start = (model: string) => {
    const started = Date.now();
    const p = callModel(cfg, key, model, opts)
      .then((content) => {
        console.log(`[ai] ${cfg.id} · ${model} · ${Date.now() - started}ms`);
        return content;
      })
      .catch((error) => {
        const aborted = error instanceof Error && error.name === "AbortError";
        const message = aborted ? `${cfg.id}/${model} timed out` : String(error);
        errors.push(message);
        console.warn(`[ai] ${message}`);
        throw error;
      })
      .finally(() => {
        inFlight.delete(p);
      });
    inFlight.add(p);
    p.catch(() => {}); // never surface as an unhandled rejection
    return p;

  };

  type Outcome = { kind: "ok"; value: string } | { kind: "fail" } | { kind: "hedge" };
  const settle = (p: Promise<string>): Promise<Outcome> =>
    p.then((value) => ({ kind: "ok" as const, value })).catch(() => ({ kind: "fail" as const }));
  const hedge = (): Promise<Outcome> =>
    new Promise((r) => setTimeout(() => r({ kind: "hedge" }), HEDGE_AFTER_MS));

  start(models[index++]);

  while (inFlight.size > 0) {
    const racers: Promise<Outcome>[] = [...inFlight].map(settle);
    if (index < models.length) racers.push(hedge());

    const outcome = await Promise.race(racers);
    if (outcome.kind === "ok") return outcome.value;
    if (outcome.kind === "hedge" || index < models.length) {
      if (index < models.length) start(models[index++]);
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
