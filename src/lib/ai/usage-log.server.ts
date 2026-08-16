// Server-only AI usage / cost ledger.
//
// Every OpenRouter call (success or failure) is recorded so administrators can
// see real token consumption, real cost and real failure rates. Costs come
// from OpenRouter's own usage accounting whenever it is returned, so nothing
// here is a guess. No API key or credential is ever stored.

export interface AiUsageRecord {
  userId: string | null;
  conversationId?: string | null;
  provider: string;
  model: string;
  taskType: string;
  subject?: string | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens?: number;
  estimatedCost: number;
  latencyMs: number;
  /** Time the request waited for a worker slot before dispatch. */
  queueMs?: number;
  /** Failover/retry attempts before the answer resolved. */
  retryCount?: number;
  /** True when the answer came from the shared cache instead of a provider. */
  cacheHit?: boolean;
  /** Request tracing id, shared with the structured gateway logs. */
  correlationId?: string | null;
  status: "success" | "error";
  errorMessage?: string | null;
}


/** OpenAI-compatible usage block, plus OpenRouter's cost extension. */
export interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  total_cost?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

export function readUsage(data: Record<string, unknown>): RawUsage | undefined {
  const u = (data as { usage?: RawUsage }).usage;
  return u && typeof u === "object" ? u : undefined;
}

/**
 * Persist one AI request. Never throws — metering must not break tutoring.
 */
export async function logAiRequest(rec: AiUsageRecord): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_request_log" as never).insert({
      user_id: rec.userId,
      conversation_id: rec.conversationId ?? null,
      provider: rec.provider,
      model: rec.model,
      task_type: rec.taskType,
      subject: rec.subject ?? null,
      input_tokens: Math.max(0, Math.round(rec.inputTokens)),
      output_tokens: Math.max(0, Math.round(rec.outputTokens)),
      reasoning_tokens: Math.max(0, Math.round(rec.reasoningTokens)),
      cached_tokens: Math.max(0, Math.round(rec.cachedTokens ?? 0)),
      estimated_cost: Number(rec.estimatedCost.toFixed(8)),
      latency_ms: Math.max(0, Math.round(rec.latencyMs)),
      status: rec.status,
      // Truncated, sanitised message — never a stack trace or a secret.
      error_message: rec.errorMessage ? rec.errorMessage.slice(0, 300) : null,
    } as never);
    if (error) console.error("[ai-usage-log] insert failed:", error.message);
  } catch (err) {
    console.error("[ai-usage-log] unavailable:", err instanceof Error ? err.message : err);
  }
}
