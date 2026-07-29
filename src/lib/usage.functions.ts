import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


type Sb = { from: (t: string) => any };

async function assertAdmin(supabase: unknown, userId: string) {
  const { data } = await (supabase as Sb)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** The signed-in user's own AI allowance for today. */
export const getMyAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAiUsageSnapshot } = await import("./ai-usage.server");
    return getAiUsageSnapshot(context.userId as string);
  });

/** All configurable plans/tiers (admin only). */
export const listAiPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_plans" as never)
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as {
      id: string;
      name: string;
      daily_requests: number;
      daily_images: number;
      unlimited: boolean;
      sort_order: number;
    }[];
  });

/** Change a plan's daily limits without touching code (admin only). */
export const updateAiPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        daily_requests: z.number().int().min(0).max(100000),
        daily_images: z.number().int().min(0).max(100000),
        unlimited: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_plans" as never)
      .update({
        daily_requests: data.daily_requests,
        daily_images: data.daily_images,
        unlimited: data.unlimited,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Assign a plan (or unlimited access) to a specific user (admin only). */
export const setUserAiPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        planId: z.string().min(1),
        unlimited: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", data.email)
      .maybeSingle();
    if (!prof) throw new Error("No account found with that email.");

    const { error } = await supabaseAdmin.from("user_ai_plans" as never).upsert(
      {
        user_id: prof.id,
        plan_id: data.planId,
        unlimited: data.unlimited,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, name: prof.full_name ?? prof.email };
  });

/** Highest AI consumers today, with their plan (admin only). */
export const listAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("ai_usage" as never)
      .select("*")
      .order("requests_today", { ascending: false })
      .limit(25);

    const usage = (rows ?? []) as unknown as {
      user_id: string;
      requests_today: number;
      successful_requests: number;
      failed_requests: number;
      images_today: number;
      last_request_at: string | null;
      last_reset_date: string;
    }[];
    if (usage.length === 0) return [];

    const ids = usage.map((u) => u.user_id);
    const [{ data: profs }, { data: plans }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids),
      supabaseAdmin.from("user_ai_plans" as never).select("user_id, plan_id, unlimited").in("user_id", ids),
    ]);
    const planRows = (plans ?? []) as unknown as {
      user_id: string;
      plan_id: string;
      unlimited: boolean;
    }[];

    return usage.map((u) => {
      const p = (profs ?? []).find((x) => x.id === u.user_id);
      const pl = planRows.find((x) => x.user_id === u.user_id);
      return {
        ...u,
        name: p?.full_name ?? p?.email ?? "User",
        email: p?.email ?? "",
        plan: pl?.plan_id ?? "free",
        unlimited: pl?.unlimited ?? false,
      };
    });
  });
