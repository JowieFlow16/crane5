import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only snapshot of the multi-provider AI gateway. */
export const getGatewayStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .limit(1);
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const { buildGatewayStats } = await import("./ai/analytics.server");
    return buildGatewayStats();
  });

/** Admin-only AI cost + usage observability (last 30 days). */
export const getAiObservability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .limit(1);
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("ai_cost_overview" as never);
    if (error) throw new Error(error.message);

    const { AI_MODELS } = await import("./ai/models.server");
    return {
      models: AI_MODELS,
      overview: data as unknown as {
        requests_today: number;
        requests_week: number;
        requests_total: number;
        input_tokens: number;
        output_tokens: number;
        reasoning_tokens: number;
        cost: number;
        cost_today: number;
        avg_latency_ms: number;
        error_rate: number;
        by_model: { model: string; requests: number; cost: number }[];
        by_task: { task_type: string; requests: number }[];
        by_subject: { subject: string; requests: number }[];
        top_users: { user_id: string; name: string; requests: number; cost: number }[];
        recent_failures: {
          model: string;
          task_type: string;
          error_message: string | null;
          created_at: string;
        }[];
      },
    };
  });
