// Server-only AI facade. Call signatures are unchanged for every existing
// caller; behind them sits the multi-provider gateway (routing, failover,
// health, queueing, caching). Filename ends with .server.ts so it is never
// bundled to the client.

import {
  chat,
  embed,
  generateAudio,
  generateImage,
  generateVideo,
  speechToText,
  textToSpeech,
  type ChatMessage,
  type ChatOptions,
  type ContentPart,
} from "./ai/gateway.server";
import { candidateProviders, providerModels } from "./ai/registry.server";

export type { ChatMessage, ChatOptions, ContentPart };

/** First model the gateway would try for plain text (informational). */
export const FAST_TEXT_MODEL = (() => {
  const p = candidateProviders("text")[0];
  return p ? providerModels(p, "text")[0] : "auto";
})();

/** First image model the gateway would try (informational). */
export const IMAGE_MODEL = (() => {
  const p = candidateProviders("image")[0];
  return p ? providerModels(p, "image")[0] : "auto";
})();

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
 * Generate an image. Routes to the image-specialised providers and falls over
 * automatically. Returns a URL or data URL, or throws IMAGE_UNAVAILABLE.
 */
export async function generateImageAI(prompt: string): Promise<string> {
  try {
    return await generateImage(prompt);
  } catch (err) {
    console.error("[ai-image] all image providers failed:", err);
    throw new Error("IMAGE_UNAVAILABLE");
  }
}

// Additional multi-modal capabilities, all through the same gateway.
export const generateVideoAI = generateVideo;
export const generateAudioAI = generateAudio;
export const textToSpeechAI = textToSpeech;
export const speechToTextAI = speechToText;
export const embedAI = embed;
