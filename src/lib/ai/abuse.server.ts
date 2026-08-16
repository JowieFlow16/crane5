// Server-only abuse protection for paid AI traffic.
//
// This is NOT a free-tier throttle: normal students never see it. It exists to
// stop request flooding, runaway loops and duplicate submissions from burning
// real OpenRouter money.

import { LIMITS } from "./models.server";

const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = Number(process.env["AI_MAX_PER_MINUTE"] ?? 25);
const MAX_PER_10S = Number(process.env["AI_MAX_PER_10S"] ?? 8);
const DUPLICATE_WINDOW_MS = 6_000;

interface Bucket {
  hits: number[];
  lastFingerprint: string | null;
  lastAt: number;
}

const buckets = new Map<string, Bucket>();

export class AbuseError extends Error {
  readonly code = "AI_TOO_FAST";
  constructor(message: string) {
    super(message);
    this.name = "AbuseError";
  }
}

function bucket(userId: string): Bucket {
  let b = buckets.get(userId);
  if (!b) {
    b = { hits: [], lastFingerprint: null, lastAt: 0 };
    buckets.set(userId, b);
  }
  return b;
}

/** Cheap non-cryptographic fingerprint used only for duplicate detection. */
function fingerprint(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Throws AbuseError when a single account is hammering the AI. Also collapses
 * accidental duplicate submissions of the identical prompt.
 */
export function guardAiRequest(userId: string, payload = ""): void {
  const now = Date.now();
  const b = bucket(userId);
  b.hits = b.hits.filter((t) => now - t < WINDOW_MS);

  const last10s = b.hits.filter((t) => now - t < 10_000).length;
  if (last10s >= MAX_PER_10S || b.hits.length >= MAX_PER_MINUTE) {
    throw new AbuseError("You're sending questions very quickly — please wait a moment, then ask.");
  }

  if (payload) {
    const fp = fingerprint(payload);
    if (b.lastFingerprint === fp && now - b.lastAt < DUPLICATE_WINDOW_MS) {
      throw new AbuseError("That looks like the same question again — give me a second to answer.");
    }
    b.lastFingerprint = fp;
  }

  b.hits.push(now);
  b.lastAt = now;

  // Keep the map from growing without bound on a long-lived instance.
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (now - v.lastAt > 10 * WINDOW_MS) buckets.delete(k);
    }
  }
}

/** Reject absurd prompt sizes before spending a single token. */
export function validateUserMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("EMPTY_PROMPT");
  return trimmed.length > LIMITS.maxUserMessageChars
    ? trimmed.slice(0, LIMITS.maxUserMessageChars)
    : trimmed;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Conversation-memory management: keep the most recent turns verbatim and
 * compress anything older into a compact summary line, so context stays useful
 * while token cost stays bounded.
 */
export function trimConversation(messages: HistoryMessage[]): HistoryMessage[] {
  const recent = messages.slice(-LIMITS.maxHistoryMessages);
  const older = messages.slice(0, Math.max(0, messages.length - LIMITS.maxHistoryMessages));

  const out: HistoryMessage[] = [];
  if (older.length) {
    const topics = older
      .filter((m) => m.role === "user")
      .map((m) => m.content.replace(/\s+/g, " ").slice(0, 120))
      .slice(-8);
    out.push({
      role: "user",
      content: `[Earlier in this lesson we covered: ${topics.join("; ")}]`,
    });
  }

  let budget = LIMITS.maxHistoryChars;
  const kept: HistoryMessage[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const content = m.content.length > 4_000 ? `${m.content.slice(0, 4_000)}…` : m.content;
    budget -= content.length;
    if (budget < 0 && kept.length > 0) break;
    kept.unshift({ role: m.role, content });
  }

  return [...out, ...kept];
}
