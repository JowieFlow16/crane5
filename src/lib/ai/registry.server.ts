// Server-only provider registry + gateway configuration.
//
// Adding a new provider requires ONLY:
//   1. add an entry to PROVIDERS below (endpoint + key env + models)
//   2. add the API key as a secret / environment variable
// Nothing else in the application changes.
//
// Everything here is overridable through environment variables, so provider
// priority, models, timeouts, cooldowns, queueing and caching can be tuned in
// production without a code change.

export type Capability =
  | "text"
  | "vision"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "tts"
  | "stt"
  | "embedding";

export interface ProviderDef {
  id: string;
  label: string;
  /** Env var that holds the secret API key (never leaves the server). */
  keyEnv: string;
  /** Env var that can override the base URL. */
  baseUrlEnv: string;
  defaultBaseUrl: string;
  /** Static extra headers. */
  headers?: () => Record<string, string>;
  /** Ordered candidate models per capability. */
  models: Partial<Record<Capability, string[]>>;
  /**
   * How this provider exposes image generation:
   *  - "chat"   → /chat/completions with modalities: ["image","text"]
   *  - "images" → /images/generations
   */
  imageApi?: "chat" | "images";
}

const OPENAI_STYLE_HEADERS = (title = "Omicron AI") => () => ({
  "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://lovable.dev",
  "X-Title": process.env.OPENROUTER_APP_NAME ?? title,
});

/**
 * Every provider speaks the OpenAI-compatible API surface
 * (/chat/completions, /images/generations, /embeddings, /audio/*).
 */
export const PROVIDERS: ProviderDef[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    baseUrlEnv: "OPENROUTER_BASE_URL",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    headers: OPENAI_STYLE_HEADERS(),
    imageApi: "chat",
    models: {
      text: [
        "google/gemma-4-31b-it:free",
        "openai/gpt-oss-20b:free",
        "inclusionai/ling-3.0-flash:free",
      ],
      code: ["openai/gpt-oss-20b:free", "google/gemma-4-31b-it:free"],
      vision: ["google/gemma-4-31b-it:free"],
      image: ["google/gemini-2.5-flash-image", "google/gemini-2.0-flash-exp:free"],
      embedding: ["openai/text-embedding-3-small"],
    },
  },
  {
    id: "requesty",
    label: "Requesty",
    keyEnv: "REQUESTY_API_KEY",
    baseUrlEnv: "REQUESTY_BASE_URL",
    defaultBaseUrl: "https://router.requesty.ai/v1",
    imageApi: "chat",
    models: {
      text: ["google/gemini-2.5-flash", "openai/gpt-4o-mini"],
      code: ["openai/gpt-4o-mini"],
      vision: ["google/gemini-2.5-flash"],
      embedding: ["openai/text-embedding-3-small"],
    },
  },
  {
    id: "aimlapi",
    label: "AIMLAPI",
    keyEnv: "AIMLAPI_API_KEY",
    baseUrlEnv: "AIMLAPI_BASE_URL",
    defaultBaseUrl: "https://api.aimlapi.com/v1",
    imageApi: "images",
    models: {
      text: ["gpt-4o-mini", "google/gemini-2.0-flash"],
      code: ["gpt-4o-mini"],
      vision: ["gpt-4o-mini"],
      image: ["flux/schnell", "dall-e-3"],
      video: ["kling-video/v1/standard/text-to-video"],
      audio: ["stable-audio"],
      tts: ["#g1_aura-asteria-en"],
      stt: ["whisper-large"],
      embedding: ["text-embedding-3-small"],
    },
  },
  {
    id: "ofox",
    label: "OFOX",
    keyEnv: "OFOX_API_KEY",
    baseUrlEnv: "OFOX_BASE_URL",
    defaultBaseUrl: "https://api.ofox.ai/v1",
    imageApi: "chat",
    models: {
      text: ["gpt-4o-mini"],
      code: ["gpt-4o-mini"],
      vision: ["gpt-4o-mini"],
    },
  },
  {
    id: "haimaker",
    label: "HaiMaker",
    keyEnv: "HAIMAKER_API_KEY",
    baseUrlEnv: "HAIMAKER_BASE_URL",
    defaultBaseUrl: "https://api.haimaker.com/v1",
    imageApi: "images",
    models: {
      text: ["gpt-4o-mini"],
      image: ["flux-schnell"],
    },
  },
  {
    id: "allmodels",
    label: "AllModels",
    keyEnv: "ALLMODELS_API_KEY",
    baseUrlEnv: "ALLMODELS_BASE_URL",
    defaultBaseUrl: "https://api.allmodels.ai/v1",
    imageApi: "chat",
    models: {
      text: ["gpt-4o-mini"],
      code: ["gpt-4o-mini"],
      image: ["flux-schnell"],
    },
  },
  {
    id: "autorouter",
    label: "Auto Router",
    keyEnv: "AUTO_ROUTER_API_KEY",
    baseUrlEnv: "AUTO_ROUTER_BASE_URL",
    defaultBaseUrl: "https://api.autorouter.ai/v1",
    imageApi: "chat",
    models: {
      text: ["auto"],
      code: ["auto"],
      vision: ["auto"],
    },
  },
  // Lovable AI Gateway stays registered as a first-class provider: it needs no
  // user-supplied key and keeps the app working out of the box.
  {
    id: "lovable",
    label: "Lovable AI",
    keyEnv: "LOVABLE_API_KEY",
    baseUrlEnv: "LOVABLE_BASE_URL",
    defaultBaseUrl: "https://ai.gateway.lovable.dev/v1",
    imageApi: "chat",
    models: {
      text: ["google/gemini-3.6-flash", "google/gemini-3.1-flash-lite", "openai/gpt-5.4-mini"],
      code: ["openai/gpt-5.4-mini", "google/gemini-3.6-flash"],
      vision: ["google/gemini-3.6-flash"],
      image: ["google/gemini-3.1-flash-image", "google/gemini-2.5-flash-image"],
      embedding: ["openai/text-embedding-3-small"],
    },
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providerBaseUrl(p: ProviderDef): string {
  return (process.env[p.baseUrlEnv] ?? p.defaultBaseUrl).replace(/\/$/, "");
}

/**
 * Every API key configured for a provider, in rotation order.
 *
 * A provider can hold several keys so the gateway keeps serving other users
 * when one key hits its quota or rate limit:
 *   OPENROUTER_API_KEY="key1,key2"        (comma-separated)
 *   OPENROUTER_API_KEY_2 ... _5           (numbered extras)
 *   OPENROUTER_API_KEYS="key6,key7"       (bulk list)
 */
export function providerKeys(p: ProviderDef): string[] {
  const names = [
    p.keyEnv,
    `${p.keyEnv}S`,
    `${p.keyEnv}_2`,
    `${p.keyEnv}_3`,
    `${p.keyEnv}_4`,
    `${p.keyEnv}_5`,
  ];
  const out: string[] = [];
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const key = part.trim();
      if (key && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

export function providerKey(p: ProviderDef): string | undefined {
  return providerKeys(p)[0];
}


/** Models for a capability, with per-provider env override (e.g. AI_MODELS_OPENROUTER_TEXT). */
export function providerModels(p: ProviderDef, cap: Capability): string[] {
  const envName = `AI_MODELS_${p.id.toUpperCase()}_${cap.toUpperCase()}`;
  const override = envList(envName);
  if (override) return override;
  return p.models[cap] ?? [];
}

function envList(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function envNum(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

// ---------------------------------------------------------------------------
// Gateway configuration (all env-overridable)
// ---------------------------------------------------------------------------

const DEFAULT_PRIORITY = [
  "openrouter",
  "requesty",
  "aimlapi",
  "ofox",
  "haimaker",
  "allmodels",
  "autorouter",
  "lovable",
];

/** Capability-specific preferred provider order (provider specialisation). */
const DEFAULT_PREFERENCES: Partial<Record<Capability, string[]>> = {
  text: ["openrouter", "requesty", "ofox"],
  code: ["openrouter", "aimlapi", "requesty"],
  vision: ["openrouter", "requesty", "lovable"],
  image: ["aimlapi", "haimaker", "lovable", "openrouter"],
  video: ["aimlapi"],
  audio: ["aimlapi"],
  tts: ["aimlapi"],
  stt: ["aimlapi"],
  embedding: ["openrouter", "aimlapi", "lovable"],
};

export interface GatewayConfig {
  priority: string[];
  disabled: string[];
  preferences: Partial<Record<Capability, string[]>>;
  requestTimeoutMs: number;
  hedgeAfterMs: number;
  maxProviderAttempts: number;
  cooldownMs: number;
  failureThreshold: number;
  maxConcurrency: number;
  maxQueue: number;
  cacheTtlMs: number;
  cacheMaxEntries: number;
}

export function getGatewayConfig(): GatewayConfig {
  const preferences: Partial<Record<Capability, string[]>> = { ...DEFAULT_PREFERENCES };
  (Object.keys(DEFAULT_PREFERENCES) as Capability[]).forEach((cap) => {
    const override = envList(`AI_PREFERRED_${cap.toUpperCase()}`);
    if (override) preferences[cap] = override;
  });

  return {
    priority: envList("AI_PROVIDER_PRIORITY") ?? DEFAULT_PRIORITY,
    disabled: envList("AI_DISABLED_PROVIDERS") ?? [],
    preferences,
    requestTimeoutMs: envNum("AI_TIMEOUT_MS", 15_000),
    hedgeAfterMs: envNum("AI_HEDGE_AFTER_MS", 3_500),
    maxProviderAttempts: envNum("AI_MAX_PROVIDER_ATTEMPTS", 4),
    cooldownMs: envNum("AI_COOLDOWN_MS", 60_000),
    failureThreshold: envNum("AI_FAILURE_THRESHOLD", 3),
    maxConcurrency: envNum("AI_MAX_CONCURRENCY", 8),
    maxQueue: envNum("AI_MAX_QUEUE", 100),
    cacheTtlMs: envNum("AI_CACHE_TTL_MS", 30 * 60_000),
    cacheMaxEntries: envNum("AI_CACHE_MAX_ENTRIES", 300),
  };
}

/**
 * Providers that can serve a capability right now: configured key, not
 * disabled, and at least one candidate model. Ordered by capability
 * preference first, then global priority.
 */
export function candidateProviders(cap: Capability): ProviderDef[] {
  const cfg = getGatewayConfig();
  const order = [...(cfg.preferences[cap] ?? []), ...cfg.priority];
  const seen = new Set<string>();
  const out: ProviderDef[] = [];
  for (const id of order) {
    if (seen.has(id) || cfg.disabled.includes(id)) continue;
    seen.add(id);
    const p = getProvider(id);
    if (!p || !providerKey(p) || providerModels(p, cap).length === 0) continue;
    out.push(p);
  }
  return out;
}
