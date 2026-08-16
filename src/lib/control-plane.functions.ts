import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: {
  supabase: { from: (t: string) => never };
  userId: string;
}): Promise<void> {
  const { data } = await (
    context.supabase.from("user_roles") as unknown as {
      select: (c: string) => {
        eq: (
          a: string,
          b: string,
        ) => { eq: (a: string, b: string) => { limit: (n: number) => Promise<{ data: unknown[] }> } };
      };
    }
  )
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

/** Everything the admin control room needs about the AI control plane. */
export const getControlPlane = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { readControlPlane } = await import("./ai/control-plane-admin.server");
    return readControlPlane();
  });

const ProviderPatch = z.object({
  id: z.string().min(1).max(40),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(999).optional(),
});

/** Enable/disable a provider or change its routing priority. */
export const updateProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProviderPatch.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { patchProvider } = await import("./ai/control-plane-admin.server");
    return patchProvider(data, context.userId);
  });

const FlagPatch = z.object({ key: z.string().min(1).max(60), enabled: z.boolean() });

export const updateFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FlagPatch.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { patchFlag } = await import("./ai/control-plane-admin.server");
    return patchFlag(data.key, data.enabled, context.userId);
  });

const PolicyPatch = z.object({ id: z.string().min(1).max(40) });

/** Switch the platform operating mode (normal / high demand / … / maintenance). */
export const activatePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PolicyPatch.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { setActivePolicy } = await import("./ai/control-plane-admin.server");
    return setActivePolicy(data.id, context.userId);
  });

const BudgetPatch = z.object({
  dailyLimit: z.number().min(0).max(100_000),
  monthlyLimit: z.number().min(0).max(1_000_000),
});

export const updateBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BudgetPatch.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { patchBudget } = await import("./ai/control-plane-admin.server");
    return patchBudget(data.dailyLimit, data.monthlyLimit, context.userId);
  });

const AlertPatch = z.object({ id: z.string().uuid() });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AlertPatch.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { closeAlert } = await import("./ai/control-plane-admin.server");
    return closeAlert(data.id, context.userId);
  });

/** Process one batch of queued AI jobs immediately. */
export const drainQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { drainQueueOnce } = await import("./ai/control-plane-admin.server");
    return drainQueueOnce(context.userId);
  });
