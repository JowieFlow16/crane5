// Server-only durable AI control plane.
//
// Workers are stateless and horizontally replicated, so anything a single
// worker learns (provider is down, key is out of credits, this answer is
// cacheable) must be shared. This module is the one place that reads and
// writes that shared state.
//
// Design rules:
//  * every read is served from a short-lived in-process snapshot, so the hot
//    path never waits on the database;
//  * every write is fire-and-forget — metering or health bookkeeping must
//    never break tutoring;
//  * the in-code registry stays the fallback, so a missing/empty control
//    plane degrades to today's behaviour instead of disabling the tutor.

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

let adminPromise: Promise<Admin> | null = null;

async function admin(): Promise<Admin> {
  if (!adminPromise) {
    adminPromise = import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
  }
  return adminPromise;
}

function warn(scope: string, err: unknown) {
  console.warn(`[control-plane] ${scope}:`, err instanceof Error ? err.message : err);
}

// ---------------------------------------------------------------------------
// Correlation ids — one per AI request, threaded through logs and the ledger
// ---------------------------------------------------------------------------

export function newCorrelationId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `c5-${Date.now().toString(36)}-${rand}`;
}

// ---------------------------------------------------------------------------
// Provider configuration + operating policy snapshot
// ---------------------------------------------------------------------------

export interface ProviderConfigRow {
  id: string;
  enabled: boolean;
  priority: number;
  maxConcurrency: number | null;
  costProfile: string;
}

export interface ActivePolicy {
  id: string;
  name: string;
  preferCheap: boolean;
  allowPremium: boolean;
  maxConcurrency: number | null;
  quotaMultiplier: number;
  blocksNewRequests: boolean;
}

export interface DurableHealthRow {
  providerId: string;
  success: number;
  failure: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  disabledUntil: number | null;
  lastError: string | null;
}

export interface DurableKeyRow {
  providerId: string;
  index: number;
  parkedUntil: number | null;
  reason: string | null;
  uses: number;
}

interface Snapshot {
  loadedAt: number;
  providers: Map<string, ProviderConfigRow>;
  policy: ActivePolicy | null;
  flags: Map<string, boolean>;
  health: DurableHealthRow[];
  keys: DurableKeyRow[];
}

const EMPTY: Snapshot = {
  loadedAt: 0,
  providers: new Map(),
  policy: null,
  flags: new Map(),
  health: [],
  keys: [],
};

const SNAPSHOT_TTL_MS = Number(process.env["AI_CONTROL_PLANE_TTL_MS"] ?? 15_000);

let snapshot: Snapshot = EMPTY;
let refreshing: Promise<void> | null = null;

/** Non-blocking refresh; safe to call on every request. */
export function refreshControlPlane(): void {
  if (refreshing) return;
  if (Date.now() - snapshot.loadedAt < SNAPSHOT_TTL_MS) return;
  refreshing = loadSnapshot()
    .catch((err) => warn("refresh", err))
    .finally(() => {
      refreshing = null;
    });
}

/** Blocking refresh — used by admin views that need current numbers. */
export async function ensureControlPlane(): Promise<void> {
  if (Date.now() - snapshot.loadedAt < SNAPSHOT_TTL_MS) return;
  if (refreshing) return refreshing;
  refreshing = loadSnapshot()
    .catch((err) => warn("ensure", err))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function loadSnapshot(): Promise<void> {
  const db = await admin();
  const [providers, policies, flags, health, keys] = await Promise.all([
    db.from("ai_providers_config" as never).select("*"),
    db.from("ai_policies" as never).select("*").eq("active", true).limit(1),
    db.from("feature_flags" as never).select("*"),
    db.from("provider_health" as never).select("*"),
    db.from("ai_key_state" as never).select("*"),
  ]);

  const next: Snapshot = {
    loadedAt: Date.now(),
    providers: new Map(),
    policy: null,
    flags: new Map(),
    health: [],
    keys: [],
  };

  for (const row of (providers.data ?? []) as Record<string, unknown>[]) {
    next.providers.set(String(row["id"]), {
      id: String(row["id"]),
      enabled: row["enabled"] !== false,
      priority: Number(row["priority"] ?? 100),
      maxConcurrency: row["max_concurrency"] == null ? null : Number(row["max_concurrency"]),
      costProfile: String(row["cost_profile"] ?? "standard"),
    });
  }

  const p = ((policies.data ?? []) as Record<string, unknown>[])[0];
  if (p) {
    next.policy = {
      id: String(p["id"]),
      name: String(p["name"]),
      preferCheap: p["prefer_cheap"] === true,
      allowPremium: p["allow_premium"] !== false,
      maxConcurrency: p["max_concurrency"] == null ? null : Number(p["max_concurrency"]),
      quotaMultiplier: Number(p["quota_multiplier"] ?? 1),
      blocksNewRequests: p["blocks_new_requests"] === true,
    };
  }

  for (const row of (flags.data ?? []) as Record<string, unknown>[]) {
    next.flags.set(String(row["key"]), row["enabled"] === true);
  }

  const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : null);

  next.health = ((health.data ?? []) as Record<string, unknown>[]).map((row) => ({
    providerId: String(row["provider_id"]),
    success: Number(row["success"] ?? 0),
    failure: Number(row["failure"] ?? 0),
    consecutiveFailures: Number(row["consecutive_failures"] ?? 0),
    avgLatencyMs: Number(row["avg_latency_ms"] ?? 0),
    disabledUntil: ms(row["disabled_until"]),
    lastError: row["last_error"] == null ? null : String(row["last_error"]),
  }));

  next.keys = ((keys.data ?? []) as Record<string, unknown>[]).map((row) => ({
    providerId: String(row["provider_id"]),
    index: Number(row["key_index"] ?? 0),
    parkedUntil: ms(row["parked_until"]),
    reason: row["reason"] == null ? null : String(row["reason"]),
    uses: Number(row["uses"] ?? 0),
  }));

  snapshot = next;
}

/** Provider override, or undefined when the control plane has nothing to say. */
export function providerOverride(id: string): ProviderConfigRow | undefined {
  return snapshot.providers.get(id);
}

export function hasProviderConfig(): boolean {
  return snapshot.providers.size > 0;
}

export function activePolicy(): ActivePolicy | null {
  return snapshot.policy;
}

export function isFeatureEnabled(key: string, fallback = true): boolean {
  const v = snapshot.flags.get(key);
  return v === undefined ? fallback : v;
}

export function durableHealth(): DurableHealthRow[] {
  return snapshot.health;
}

export function durableKeys(): DurableKeyRow[] {
  return snapshot.keys;
}

// ---------------------------------------------------------------------------
// Write-through persistence (fire-and-forget)
// ---------------------------------------------------------------------------

export function persistHealth(row: DurableHealthRow): void {
  void (async () => {
    try {
      const db = await admin();
      await db.from("provider_health" as never).upsert(
        {
          provider_id: row.providerId,
          success: row.success,
          failure: row.failure,
          consecutive_failures: row.consecutiveFailures,
          avg_latency_ms: Math.round(row.avgLatencyMs),
          last_error: row.lastError ? row.lastError.slice(0, 300) : null,
          disabled_until: row.disabledUntil ? new Date(row.disabledUntil).toISOString() : null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "provider_id" } as never,
      );
    } catch (err) {
      warn("persistHealth", err);
    }
  })();
}

export function persistKeyState(row: DurableKeyRow): void {
  void (async () => {
    try {
      const db = await admin();
      await db.from("ai_key_state" as never).upsert(
        {
          provider_id: row.providerId,
          key_index: row.index,
          parked_until: row.parkedUntil ? new Date(row.parkedUntil).toISOString() : null,
          reason: row.reason,
          uses: row.uses,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "provider_id,key_index" } as never,
      );
    } catch (err) {
      warn("persistKeyState", err);
    }
  })();
}

// ---------------------------------------------------------------------------
// Durable, curriculum-aware answer cache
//
// Keyed by normalised question + subject + level — NEVER by student, so a
// personalised conversation can never leak between learners.
// ---------------------------------------------------------------------------

export interface CacheLookupMeta {
  capability?: string;
  subject?: string | null;
  classLevel?: string | null;
  promptPreview?: string | null;
}

export async function durableCacheGet<T>(id: string): Promise<T | undefined> {
  if (!isFeatureEnabled("durable_cache", true)) return undefined;
  try {
    const db = await admin();
    const { data } = await db
      .from("ai_cache_entries" as never)
      .select("value, expires_at, hits")
      .eq("id", id)
      .maybeSingle();
    const row = data as { value?: unknown; expires_at?: string; hits?: number } | null;
    if (!row?.expires_at) return undefined;
    if (new Date(row.expires_at).getTime() < Date.now()) return undefined;
    void db
      .from("ai_cache_entries" as never)
      .update({
        hits: (row.hits ?? 0) + 1,
        last_hit_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    return row.value as T;
  } catch (err) {
    warn("cacheGet", err);
    return undefined;
  }
}

export function durableCacheSet(id: string, value: unknown, ttlMs: number, meta: CacheLookupMeta) {
  if (!isFeatureEnabled("durable_cache", true)) return;
  void (async () => {
    try {
      const db = await admin();
      await db.from("ai_cache_entries" as never).upsert(
        {
          id,
          capability: meta.capability ?? "text",
          subject: meta.subject ?? null,
          class_level: meta.classLevel ?? null,
          prompt_preview: meta.promptPreview ? meta.promptPreview.slice(0, 200) : null,
          value: value as never,
          expires_at: new Date(Date.now() + ttlMs).toISOString(),
        } as never,
        { onConflict: "id" } as never,
      );
    } catch (err) {
      warn("cacheSet", err);
    }
  })();
}

// ---------------------------------------------------------------------------
// Alerts, metrics, audit
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical";

export function raiseAlert(alert: {
  severity: AlertSeverity;
  component: string;
  title: string;
  description?: string;
  recommendedAction?: string;
  dedupeKey?: string;
}): void {
  void (async () => {
    try {
      const db = await admin();
      await db.from("system_alerts" as never).upsert(
        {
          severity: alert.severity,
          component: alert.component,
          title: alert.title,
          description: alert.description ?? null,
          recommended_action: alert.recommendedAction ?? null,
          dedupe_key: alert.dedupeKey ?? null,
        } as never,
        { onConflict: "dedupe_key", ignoreDuplicates: true } as never,
      );
    } catch (err) {
      warn("raiseAlert", err);
    }
  })();
}

export function recordMetric(name: string, value: number, meta: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const db = await admin();
      await db
        .from("system_metrics" as never)
        .insert({ name, value, meta: meta as never } as never);
    } catch (err) {
      warn("recordMetric", err);
    }
  })();
}

export async function writeAudit(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("audit_logs" as never).insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: (entry.meta ?? {}) as never,
    } as never);
  } catch (err) {
    warn("writeAudit", err);
  }
}
