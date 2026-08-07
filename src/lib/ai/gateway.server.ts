// Server-only unified AI gateway core.
//
// Callers state WHAT they want (capability + payload); the gateway decides
// which provider and model serves it, retries and fails over automatically,
// tracks health, queues under load and caches where explicitly allowed.

import {
  candidateProviders,
  getGatewayConfig,
  providerBaseUrl,
  providerKeys,
  providerModels,
  type Capability,
  type ProviderDef,
} from "./registry.server";
import {
  cacheGet,
  cacheSet,
  hashKey,
  healthScore,
  isAvailable,
  metrics,
  noteCapability,
  noteKeyUse,
  orderKeys,
  parkKey,
  recordFailure,
  recordSuccess,
  withSlot,
  type KeyFailureKind,
} from "./health.server";

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
  /** Explicit model override; skips automatic model selection. */
  model?: string;
  json?: boolean;
  temperature?: number;
  /** Capability hint used for provider specialisation. Defaults to "text". */
  capability?: Capability;
  /**
   * Opt-in caching for non-personalised, repeatable content (explanations,
   * summaries, revision material). Never set this for conversations.
   */
  cacheKey?: string;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 522, 524]);

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status && RETRYABLE_STATUS.has(status)) return true;
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return (
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("connection") ||
    msg.includes("capacity") ||
    msg.includes("rate limit") ||
    msg.includes("unavailable") ||
    msg.includes("empty response")
  );
}

function log(event: string, fields: Record<string, unknown>) {
  // Never log keys or payloads — only routing metadata.
  console.log(`[ai-gateway] ${event}`, JSON.stringify(fields));
}

/**
 * Classify a per-key failure so the key (not the whole provider) can be
 * parked. Returns null when the failure is not key-specific.
 */
function keyFailureKind(err: unknown): KeyFailureKind | null {
  const status = (err as { status?: number })?.status;
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate_limit";
  }
  if (
    status === 402 ||
    msg.includes("insufficient") ||
    msg.includes("quota") ||
    msg.includes("credit") ||
    msg.includes("billing") ||
    msg.includes("payment required")
  ) {
    return "quota";
  }
  if (
    status === 401 ||
    status === 403 ||
    msg.includes("invalid api key") ||
    msg.includes("unauthorized")
  ) {
    return "invalid";
  }
  return null;
}

function keyCooldownMs(kind: KeyFailureKind): number {
  const cfg = getGatewayConfig();
  if (kind === "rate_limit") return cfg.keyRateLimitCooldownMs;
  if (kind === "quota") return cfg.keyQuotaCooldownMs;
  return cfg.keyInvalidCooldownMs;
}

async function request(
  p: ProviderDef,
  path: string,
  body: unknown,
  key: string,
): Promise<Record<string, unknown>> {
  const cfg = getGatewayConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
  try {
    const res = await fetch(`${providerBaseUrl(p)}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...(p.headers?.() ?? {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Object.assign(new Error(`${p.id} ${res.status}: ${text.slice(0, 300)}`), {
        status: res.status,
      });
    }

    const data = (await res.json()) as Record<string, unknown> & {
      error?: { message?: string; code?: number };
    };
    if (data.error) {
      throw Object.assign(new Error(`${p.id}: ${data.error.message ?? "unknown error"}`), {
        status: data.error.code ?? 503,
      });
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error(`${p.id} timed out`), { status: 504 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Providers for a capability, healthiest-first (not round-robin). */
function selectProviders(cap: Capability): ProviderDef[] {
  const candidates = candidateProviders(cap).filter((p) => isAvailable(p.id));
  const ranked = candidates
    .map((p, index) => ({ p, index, score: healthScore(p.id) }))
    // Preference order is the tie-breaker; score dominates.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.p);
  // If everything is cooling down, still try the configured order rather than fail.
  return ranked.length ? ranked : candidateProviders(cap);
}

interface ExecuteOptions<T> {
  capability: Capability;
  /** Build the request for a given provider + model. */
  build: (p: ProviderDef, model: string) => { path: string; body: unknown };
  /** Extract the result; return undefined to treat the response as a failure. */
  extract: (data: Record<string, unknown>, p: ProviderDef) => T | undefined;
  modelOverride?: string;
  cacheKey?: string;
}

/**
 * Core routing loop: healthiest provider first, every candidate model,
 * automatic failover on retryable errors, full metrics + logging.
 */
export async function execute<T>(opts: ExecuteOptions<T>): Promise<T> {
  const { capability } = opts;

  if (opts.cacheKey) {
    const cached = cacheGet<T>(opts.cacheKey);
    if (cached !== undefined) {
      log("cache-hit", { capability });
      return cached;
    }
  }

  return withSlot(async () => {
    const cfg = getGatewayConfig();
    const providers = selectProviders(capability).slice(0, cfg.maxProviderAttempts);
    if (providers.length === 0) throw new Error("AI_UNAVAILABLE");

    metrics.requests += 1;
    noteCapability(capability);

    const errors: string[] = [];
    let attempts = 0;
    const startedAll = Date.now();

    for (const p of providers) {
      const models = opts.modelOverride ? [opts.modelOverride] : providerModels(p, capability);
      const allKeys = providerKeys(p);
      let providerExhausted = false;

      for (const model of models) {
        if (providerExhausted) break;
        // Rotate through this provider's keys: a key that is rate limited or
        // out of credits is parked and the next key serves the request, so one
        // user's usage never blocks everyone else.
        const keyOrder = orderKeys(p.id, allKeys.length).slice(0, cfg.maxKeyAttempts);
        let modelFatal = false;

        for (const keyIndex of keyOrder) {
          const key = allKeys[keyIndex];
          if (!key) continue;
          attempts += 1;
          if (attempts > 1) metrics.retries += 1;
          const started = Date.now();
          try {
            const { path, body } = opts.build(p, model);
            noteKeyUse(p.id, keyIndex);
            const data = await request(p, path, body, key);
            const value = opts.extract(data, p);
            if (value === undefined) throw new Error(`${p.id}/${model} returned an empty response`);

            const latency = Date.now() - started;
            recordSuccess(p.id, latency);
            metrics.succeeded += 1;
            metrics.totalLatencyMs += Date.now() - startedAll;
            metrics.lastProvider = p.id;
            log("resolved", { capability, provider: p.id, model, keyIndex, latency, attempts });
            if (opts.cacheKey) cacheSet(opts.cacheKey, value);
            return value;
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            const kind = keyFailureKind(err);
            errors.push(reason);
            log("failed", {
              capability,
              provider: p.id,
              model,
              keyIndex,
              attempts,
              keyFailure: kind,
              retryable: isRetryable(err),
              reason: reason.slice(0, 200),
            });

            if (kind) {
              // Key-level problem: park this key and try the next one.
              parkKey(p.id, keyIndex, kind, keyCooldownMs(kind));
              continue;
            }

            recordFailure(p.id, reason);
            if (!isRetryable(err)) {
              // Bad request for this provider — no other key or model helps.
              modelFatal = true;
              providerExhausted = true;
            }
            break;
          }
        }

        if (modelFatal) break;
      }
      metrics.switches += 1;
    }

    metrics.failed += 1;
    log("exhausted", { capability, attempts, providers: providers.map((p) => p.id) });
    if (errors.some((e) => e.includes(" 429"))) throw new Error("RATE_LIMIT");
    if (errors.some((e) => e.includes(" 402"))) throw new Error("CREDITS");
    throw new Error("AI_UNAVAILABLE");
  });
}

// ---------------------------------------------------------------------------
// Unified capability API
// ---------------------------------------------------------------------------

function hasNonText(messages: ChatMessage[]) {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((part) => part.type !== "text"),
  );
}

export async function chat(opts: ChatOptions): Promise<string> {
  const capability: Capability = opts.capability ?? (hasNonText(opts.messages) ? "vision" : "text");

  return execute<string>({
    capability,
    modelOverride: opts.model,
    cacheKey: opts.cacheKey ? `chat:${hashKey(opts.cacheKey)}` : undefined,
    build: (_p, model) => ({
      path: "/chat/completions",
      body: {
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.6,
        ...(model.startsWith("openai/gpt-5") ? { reasoning_effort: "none" } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      },
    }),
    extract: (data) => {
      const d = data as { choices?: { message?: { content?: string } }[] };
      const content = d.choices?.[0]?.message?.content ?? "";
      return content.trim() ? content : undefined;
    },
  });
}

function pickImage(data: Record<string, unknown>): string | undefined {
  const d = data as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    data?: { url?: string; b64_json?: string }[];
    images?: { url?: string }[];
  };
  const chatUrl = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (chatUrl) return chatUrl;
  const first = d.data?.[0];
  if (first?.url) return first.url;
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  return d.images?.[0]?.url;
}

export async function generateImage(prompt: string, cacheKey?: string): Promise<string> {
  return execute<string>({
    capability: "image",
    cacheKey: cacheKey ? `image:${hashKey(cacheKey)}` : undefined,
    build: (p, model) =>
      p.imageApi === "images"
        ? { path: "/images/generations", body: { model, prompt, n: 1 } }
        : {
            path: "/chat/completions",
            body: {
              model,
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            },
          },
    extract: (data) => pickImage(data),
  });
}

export async function generateVideo(prompt: string): Promise<string> {
  return execute<string>({
    capability: "video",
    build: (_p, model) => ({ path: "/video/generations", body: { model, prompt } }),
    extract: (data) => {
      const d = data as { data?: { url?: string }[]; video?: { url?: string }; url?: string };
      return d.data?.[0]?.url ?? d.video?.url ?? d.url;
    },
  });
}

export async function generateAudio(prompt: string): Promise<string> {
  return execute<string>({
    capability: "audio",
    build: (_p, model) => ({ path: "/audio/generations", body: { model, prompt } }),
    extract: (data) => {
      const d = data as { data?: { url?: string }[]; audio?: { url?: string }; url?: string };
      return d.data?.[0]?.url ?? d.audio?.url ?? d.url;
    },
  });
}

export async function textToSpeech(text: string, voice = "alloy"): Promise<string> {
  return execute<string>({
    capability: "tts",
    build: (_p, model) => ({ path: "/audio/speech", body: { model, input: text, voice } }),
    extract: (data) => {
      const d = data as { url?: string; audio?: string; data?: { url?: string }[] };
      return d.url ?? d.audio ?? d.data?.[0]?.url;
    },
  });
}

export async function speechToText(audioDataUrl: string): Promise<string> {
  return execute<string>({
    capability: "stt",
    build: (_p, model) => ({
      path: "/audio/transcriptions",
      body: { model, file: audioDataUrl, response_format: "json" },
    }),
    extract: (data) => {
      const d = data as { text?: string };
      return d.text?.trim() ? d.text : undefined;
    },
  });
}

export async function embed(input: string | string[]): Promise<number[][]> {
  const key = Array.isArray(input) ? input.join("␟") : input;
  return execute<number[][]>({
    capability: "embedding",
    cacheKey: `embed:${hashKey(key)}`,
    build: (_p, model) => ({ path: "/embeddings", body: { model, input } }),
    extract: (data) => {
      const d = data as { data?: { embedding?: number[] }[] };
      const vectors = (d.data ?? []).map((x) => x.embedding ?? []).filter((v) => v.length > 0);
      return vectors.length ? vectors : undefined;
    },
  });
}
