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
