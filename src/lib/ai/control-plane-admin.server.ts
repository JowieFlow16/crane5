// Server-only admin operations on the AI control plane.
//
// Reads are aggregated for the admin control room; writes are audited and
// invalidate the in-process snapshot so the change takes effect immediately.

import { ensureControlPlane, writeAudit } from "./control-plane.server";
import { buildGatewayStats } from "./analytics.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Row = Record<string, Json>;

const q = (client: Awaited<ReturnType<typeof db>>, table: string) =>
  client.from(table as never) as unknown as {
    select: (cols: string) => Promise<{ data: Row[] | null }> & {
      eq: (c: string, v: unknown) => Promise<{ data: Row[] | null }>;
      order: (c: string, o?: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: Row[] | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
      neq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

export interface ControlPlaneView {
  providers: Row[];
  health: Row[];
  keys: Row[];
  policies: Row[];
  flags: Row[];
  budgets: Row[];
  alerts: Row[];
  cache: { entries: number; hits: number };
  gateway: ReturnType<typeof buildGatewayStats>;
}

export async function readControlPlane(): Promise<ControlPlaneView> {
  const client = await db();
  const [providers, health, keys, policies, flags, budgets, alerts, cache] = await Promise.all([
    q(client, "ai_providers_config").select("*"),
    q(client, "provider_health").select("*"),
    q(client, "ai_key_state").select("*"),
    q(client, "ai_policies").select("*"),
    q(client, "feature_flags").select("*"),
    q(client, "ai_budgets").select("*"),
    q(client, "system_alerts").select("*").order("created_at", { ascending: false }).limit(25),
    q(client, "ai_cache_entries").select("hits"),
  ]);

  const cacheRows = cache.data ?? [];
  return {
    providers: providers.data ?? [],
    health: health.data ?? [],
    keys: keys.data ?? [],
    policies: policies.data ?? [],
    flags: flags.data ?? [],
    budgets: budgets.data ?? [],
    alerts: alerts.data ?? [],
    cache: {
      entries: cacheRows.length,
      hits: cacheRows.reduce((sum, r) => sum + Number(r["hits"] ?? 0), 0),
    },
    gateway: buildGatewayStats(),
  };
}

export async function patchProvider(
  patch: { id: string; enabled?: boolean; priority?: number },
  actorId: string,
) {
  const client = await db();
  const values: Record<string, unknown> = {};
  if (patch.enabled !== undefined) values["enabled"] = patch.enabled;
  if (patch.priority !== undefined) values["priority"] = patch.priority;
  if (Object.keys(values).length === 0) return { ok: true };

  const { error } = await q(client, "ai_providers_config").update(values).eq("id", patch.id);
  if (error) throw new Error(error.message);
  await writeAudit({ actorId, action: "provider.update", target: patch.id, meta: values });
  await refresh();
  return { ok: true };
}

export async function patchFlag(key: string, enabled: boolean, actorId: string) {
  const client = await db();
  const { error } = await q(client, "feature_flags").update({ enabled }).eq("key", key);
  if (error) throw new Error(error.message);
  await writeAudit({ actorId, action: "feature_flag.update", target: key, meta: { enabled } });
  await refresh();
  return { ok: true };
}

export async function setActivePolicy(id: string, actorId: string) {
  const client = await db();
  const off = await q(client, "ai_policies").update({ active: false }).neq("id", id);
  if (off.error) throw new Error(off.error.message);
  const on = await q(client, "ai_policies").update({ active: true }).eq("id", id);
  if (on.error) throw new Error(on.error.message);
  await writeAudit({ actorId, action: "policy.activate", target: id });
  await refresh();
  return { ok: true };
}

export async function patchBudget(dailyLimit: number, monthlyLimit: number, actorId: string) {
  const client = await db();
  const { error } = await q(client, "ai_budgets")
    .update({ daily_limit: dailyLimit, monthly_limit: monthlyLimit })
    .eq("id", "platform");
  if (error) throw new Error(error.message);
  await writeAudit({
    actorId,
    action: "budget.update",
    target: "platform",
    meta: { dailyLimit, monthlyLimit },
  });
  await refresh();
  return { ok: true };
}

export async function closeAlert(id: string, actorId: string) {
  const client = await db();
  const { error } = await q(client, "system_alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({ actorId, action: "alert.resolve", target: id });
  return { ok: true };
}

/** Force the next request to pick up the change instead of waiting for the TTL. */
async function refresh() {
  await ensureControlPlane();
}
