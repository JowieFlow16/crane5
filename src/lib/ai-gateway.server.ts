// Server-only helper for Lovable AI Gateway (Google Gemini under the hood).
// Filename ends with .server.ts so it is never bundled to the client.
// Default chat model tuned for speed: gemini-3-flash-preview.

/** Fast default chat/text model used across the tutor, quizzes and revision. */
export const FAST_TEXT_MODEL = "google/gemini-3-flash-preview";
/** Fast, high-quality image model (Nano Banana 2) for on-demand illustrations. */
export const IMAGE_MODEL = "google/gemini-3.1-flash-image";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callAI(opts: {
  messages: ChatMessage[];
  model?: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model ?? FAST_TEXT_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.6,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("CREDITS");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
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

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
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

