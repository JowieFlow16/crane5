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

/**
 * Generate an image with the Lovable AI Gateway (Gemini image model).
 * Returns a data URL (data:image/png;base64,...) or throws.
 */
export async function generateImageAI(prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

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

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("CREDITS");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI image error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices?: {
      message?: { images?: { image_url?: { url?: string } }[] };
    }[];
  };
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("No image returned");
  return url;
}
