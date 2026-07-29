// Server-only per-user AI quota enforcement.
// Every AI-consuming server function reserves one unit of the caller's own
// daily allowance before doing any work. Quotas are per user_id, so one
// account can never block another. Counters live in the database and are
// mutated exclusively through SECURITY DEFINER routines callable only by the
// service role — users cannot edit their own usage.

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  constructor(
    message: string,
    readonly info: QuotaInfo,
  ) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export interface QuotaInfo {
  allowed: boolean;
  kind: "request" | "image";
  used: number;
  limit: number;
  unlimited: boolean;
  plan: string;
  resets_at: string;
}

function friendlyMessage(info: QuotaInfo) {
  const when = new Date(info.resets_at);
  const time = when.toLocaleString("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
  const what = info.kind === "image" ? "image generations" : "AI requests";
  return `QUOTA_EXCEEDED: You've used all ${info.limit} of your daily ${what} on the ${info.plan} plan. Your allowance resets at ${time} (EAT). Everything else in Omicron AI keeps working in the meantime.`;
}

/**
 * Reserve one unit of quota for this user. Throws QuotaExceededError when the
 * user's own daily allowance is spent. Returns a finish() callback that records
 * whether the request ultimately succeeded.
 */
export async function reserveAiQuota(
  userId: string,
  kind: "request" | "image" = "request",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin.rpc("consume_ai_quota" as never, {
    p_user_id: userId,
    p_kind: kind,
  } as never);

  if (error) {
    // Never hard-fail the product on a metering hiccup.
    console.error("[ai-usage] consume_ai_quota failed:", error.message);
    return { info: null as QuotaInfo | null, finish: async () => {} };
  }

  const info = data as unknown as QuotaInfo;
  if (info && info.allowed === false) {
    throw new QuotaExceededError(friendlyMessage(info), info);
  }

  return {
    info,
    finish: async (success: boolean) => {
      const { error: e } = await supabaseAdmin.rpc("record_ai_result" as never, {
        p_user_id: userId,
        p_success: success,
      } as never);
      if (e) console.error("[ai-usage] record_ai_result failed:", e.message);
    },
  };
}

/** Run an AI operation inside the caller's own quota. */
export async function withAiQuota<T>(
  userId: string,
  kind: "request" | "image",
  run: () => Promise<T>,
): Promise<T> {
  const { finish } = await reserveAiQuota(userId, kind);
  try {
    const result = await run();
    await finish(true);
    return result;
  } catch (err) {
    await finish(false);
    throw err;
  }
}

export async function getAiUsageSnapshot(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("ai_usage_snapshot" as never, {
    p_user_id: userId,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as {
    plan: string;
    plan_id: string;
    unlimited: boolean;
    request_limit: number;
    image_limit: number;
    requests_today: number;
    images_today: number;
    successful_requests: number;
    failed_requests: number;
    last_request_at: string | null;
    last_reset_date: string;
    resets_at: string;
  };
}
