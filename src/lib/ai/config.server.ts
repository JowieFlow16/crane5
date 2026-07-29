// Server-only AI provider configuration.
// Switching providers is a config/env change only — no code changes required.

export type ProviderId = "openrouter" | "lovable" | "openai" | "anthropic" | "groq";

export interface ProviderConfig {
  id: ProviderId;
  /** OpenAI-compatible chat completions endpoint. */
  url: string;
  /** Env var holding the API key. */
  keyEnv: string;
  /** Ordered list of models to try (first available wins). */
  models: string[];
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
}

/** Fast OpenRouter free models, used only as a backup. */
const OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "inclusionai/ling-3.0-flash:free",
];

/** Fast, high-quality models on the Lovable AI Gateway (primary provider). */
const LOVABLE_MODELS = ["google/gemini-3.6-flash", "openai/gpt-5.4-mini"];



function envList(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

/**
 * Which provider to use. Defaults to the Lovable AI Gateway — it is by far the
 * fastest and most reliable path (free OpenRouter models queue heavily), and it
 * stays as the primary unless AI_PROVIDER explicitly says otherwise.
 */
export function getProviderId(): ProviderId {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase() as ProviderId | undefined;
  if (configured) return configured;
  return process.env.LOVABLE_API_KEY ? "lovable" : "openrouter";
}


export function getProviderConfig(id: ProviderId = getProviderId()): ProviderConfig {
  switch (id) {
    case "openrouter":
      return {
        id,
        url: "https://openrouter.ai/api/v1/chat/completions",
        keyEnv: "OPENROUTER_API_KEY",
        // AI_MODELS lets paid/other models be enabled later without code changes.
        models: envList("AI_MODELS") ?? OPENROUTER_FREE_MODELS,
        headers: {
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://lovable.dev",
          "X-Title": process.env.OPENROUTER_APP_NAME ?? "Omicron AI",
        },
      };
    case "openai":
      return {
        id,
        url: "https://api.openai.com/v1/chat/completions",
        keyEnv: "OPENAI_API_KEY",
        models: envList("AI_MODELS") ?? ["gpt-4o-mini"],
      };
    case "anthropic":
      return {
        id,
        url: "https://api.anthropic.com/v1/chat/completions",
        keyEnv: "ANTHROPIC_API_KEY",
        models: envList("AI_MODELS") ?? ["claude-3-5-haiku-latest"],
      };
    case "groq":
      return {
        id,
        url: "https://api.groq.com/openai/v1/chat/completions",
        keyEnv: "GROQ_API_KEY",
        models: envList("AI_MODELS") ?? ["llama-3.3-70b-versatile"],
      };
    case "lovable":
    default:
      return {
        id: "lovable",
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        keyEnv: "LOVABLE_API_KEY",
        models: envList("AI_MODELS") ?? LOVABLE_MODELS,
      };
  }
}

/** Fallback provider used when the primary provider has no key or every model fails. */
export function getFallbackProviderId(primary: ProviderId): ProviderId | undefined {
  const configured = process.env.AI_FALLBACK_PROVIDER?.trim().toLowerCase() as
    | ProviderId
    | undefined;
  if (configured) return configured === primary ? undefined : configured;
  if (primary !== "lovable" && process.env.LOVABLE_API_KEY) return "lovable";
  if (primary === "lovable" && process.env.OPENROUTER_API_KEY) return "openrouter";
  return undefined;

}
