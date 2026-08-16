/** Turns an AI server-function error into a message we can show the user. */
export function aiErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const quota = msg.indexOf("QUOTA_EXCEEDED:");
  if (quota !== -1) return msg.slice(quota + "QUOTA_EXCEEDED:".length).trim();
  if (msg.includes("AI_TOO_FAST") || msg.includes("same question again"))
    return "You're going a bit fast — give me a couple of seconds, then try again.";
  if (msg.includes("EMPTY_PROMPT")) return "Type your question first, then send it.";
  if (msg.includes("RATE_LIMIT")) return "The AI is busy right now — please try again in a moment.";

  if (msg.includes("IMAGE_UNAVAILABLE"))
    return "Image generation is temporarily unavailable — everything else still works.";
  if (msg.includes("CREDITS"))
    return "AI service is temporarily unavailable. Please try again later.";

  return fallback;
}
