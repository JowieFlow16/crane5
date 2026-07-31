// Server-only AI facade. Behaviour and call signatures are unchanged for callers;
// text generation now routes through the provider layer (OpenRouter by default,
// with automatic model selection, retries and failover).
// Filename ends with .server.ts so it is never bundled to the client.

import { chat, type ChatMessage, type ChatOptions, type ContentPart } from "./ai/client.server";
import { getProviderConfig } from "./ai/config.server";

export type { ChatMessage, ContentPart };

/** First model in the active provider's priority list (informational). */
export const FAST_TEXT_MODEL = getProviderConfig().models[0];
/** Image model (image generation stays on the Lovable AI Gateway). */
export const IMAGE_MODEL = "google/gemini-3.1-flash-image";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function callAI(opts: ChatOptions): Promise<string> {
  return chat(opts);
}

export function parseJsonResponse<T>(raw: string): T {
  // Models occasionally wrap JSON in code fences — strip them defensively.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/** Extract a data/image URL from an OpenAI-compatible chat image response. */
function pickImageUrl(data: unknown): string | undefined {
  const d = data as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
  };
  return d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
}

/** Image generation via OpenRouter (used when the Lovable gateway is unavailable). */
async function generateImageOpenRouter(prompt: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("IMAGE_UNAVAILABLE");

  const models = [
    process.env.AI_IMAGE_MODEL,
    "google/gemini-2.5-flash-image",
    "google/gemini-2.0-flash-exp:free",
  ].filter(Boolean) as string[];

  let lastError = "";
  for (const model of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://lovable.dev",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Omicron AI",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      lastError = `${model}: ${res.status}`;
      console.warn("[ai-image] openrouter failed", lastError);
      continue;
    }

    const url = pickImageUrl(await res.json());
    if (url) return url;
    lastError = `${model}: no image returned`;
  }

  console.error("[ai-image] all image providers failed:", lastError);
  throw new Error("IMAGE_UNAVAILABLE");
}


/**
 * Generate an image. Tries the Lovable AI Gateway first and automatically
 * falls back to OpenRouter when credits are exhausted or the gateway errors.
 * Returns a data URL (data:image/png;base64,...) or throws.
 */
export async function generateImageAI(prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return generateImageOpenRouter(prompt);

  try {
    const res = await fetch(LOVABLE_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) throw new Error(`AI image error ${res.status}`);

    const url = pickImageUrl(await res.json());
    if (!url) throw new Error("No image returned");
    return url;
  } catch (err) {
    console.error("[ai-image] Lovable gateway failed, falling back to OpenRouter:", err);
    return generateImageOpenRouter(prompt);
  }
}

