// Server-only provider health tracking, gateway metrics, response cache and
// request queue.
//
// Every worker keeps a fast in-process copy of this state and mirrors it to the
// durable control plane, so a circuit breaker or parked key learned by one
// worker is respected by all of them.

import { getGatewayConfig } from "./registry.server";
import {
  durableHealth,
  durableKeys,
  persistHealth,
  persistKeyState,
} from "./control-plane.server";


export interface ProviderHealth {
  id: string;
  success: number;
  failure: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  disabledUntil: number | null;
}

const health = new Map<string, ProviderHealth>();

function ensure(id: string): ProviderHealth {
  let h = health.get(id);
  if (!h) {
    // Seed from the shared control plane so a fresh worker inherits what the
    // rest of the fleet already knows about this provider.
    const shared = durableHealth().find((r) => r.providerId === id);
    h = {
      id,
      success: shared?.success ?? 0,
      failure: shared?.failure ?? 0,
      consecutiveFailures: shared?.consecutiveFailures ?? 0,
      avgLatencyMs: shared?.avgLatencyMs ?? 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: shared?.lastError ?? null,
      disabledUntil: shared?.disabledUntil ?? null,
    };
    health.set(id, h);
  }
  return h;
}

function share(h: ProviderHealth) {
  persistHealth({
    providerId: h.id,
    success: h.success,
    failure: h.failure,
    consecutiveFailures: h.consecutiveFailures,
    avgLatencyMs: h.avgLatencyMs,
    disabledUntil: h.disabledUntil,
    lastError: h.lastError,
  });
}

export function recordSuccess(id: string, latencyMs: number) {
  const h = ensure(id);
  h.success += 1;
  h.consecutiveFailures = 0;
  h.disabledUntil = null;
  h.lastSuccessAt = Date.now();
  h.avgLatencyMs = h.avgLatencyMs ? Math.round(h.avgLatencyMs * 0.7 + latencyMs * 0.3) : latencyMs;
  share(h);
}

export function recordFailure(id: string, reason: string) {
  const cfg = getGatewayConfig();
  const h = ensure(id);
  h.failure += 1;
  h.consecutiveFailures += 1;
  h.lastFailureAt = Date.now();
  h.lastError = reason.slice(0, 300);
  if (h.consecutiveFailures >= cfg.failureThreshold) {
    // Exponential-ish cooldown, capped at 10 minutes.
    const factor = Math.min(2 ** (h.consecutiveFailures - cfg.failureThreshold), 10);
    h.disabledUntil = Date.now() + Math.min(cfg.cooldownMs * factor, 600_000);
  }
  share(h);
}


export function isAvailable(id: string): boolean {
  const h = health.get(id);
  if (!h?.disabledUntil) return true;
  if (Date.now() >= h.disabledUntil) {
    // Cooldown elapsed — give it another chance.
    h.disabledUntil = null;
    h.consecutiveFailures = 0;
    return true;
  }
  return false;
}

/** 0–100. Blends success rate, recent failures and latency. */
export function healthScore(id: string): number {
  const h = health.get(id);
  if (!h || h.success + h.failure === 0) return 75; // unproven but hopeful
  const total = h.success + h.failure;
  const rate = h.success / total;
  const latencyPenalty = Math.min(h.avgLatencyMs / 20_000, 1) * 20;
  const recentPenalty = Math.min(h.consecutiveFailures, 5) * 8;
  const disabled = isAvailable(id) ? 0 : 40;
  return Math.max(0, Math.round(rate * 100 - latencyPenalty - recentPenalty - disabled));
}

export function getHealthSnapshot() {
  return [...health.values()].map((h) => ({
    ...h,
    score: healthScore(h.id),
    available: isAvailable(h.id),
    uptime: h.success + h.failure ? Math.round((h.success / (h.success + h.failure)) * 100) : null,
  }));
}

// ---------------------------------------------------------------------------
// Per-key rotation state
//
// Providers can hold several API keys. When one key hits its rate limit or
// burns through its credits it is parked for a cooldown and the gateway keeps
// serving every other user on the next key — one user's quota never blocks
// the rest of the app.
// ---------------------------------------------------------------------------

export type KeyFailureKind = "rate_limit" | "quota" | "invalid";

interface KeyState {
  providerId: string;
  index: number;
  parkedUntil: number | null;
  reason: KeyFailureKind | null;
  uses: number;
}

const keys = new Map<string, KeyState>();
const keyId = (providerId: string, index: number) => `${providerId}#${index}`;

function ensureKey(providerId: string, index: number): KeyState {
  const id = keyId(providerId, index);
  let s = keys.get(id);
  if (!s) {
    // Inherit shared parking so a cold worker does not immediately retry a key
    // another worker already found rate limited or out of credits.
    const shared = durableKeys().find((r) => r.providerId === providerId && r.index === index);
    s = {
      providerId,
      index,
      parkedUntil: shared?.parkedUntil ?? null,
      reason: (shared?.reason as KeyFailureKind | null) ?? null,
      uses: shared?.uses ?? 0,
    };
    keys.set(id, s);
  }
  return s;
}

function shareKey(s: KeyState) {
  persistKeyState({
    providerId: s.providerId,
    index: s.index,
    parkedUntil: s.parkedUntil,
    reason: s.reason,
    uses: s.uses,
  });
}

export function isKeyAvailable(providerId: string, index: number): boolean {
  const s = keys.get(keyId(providerId, index));
  if (!s?.parkedUntil) return true;
  if (Date.now() >= s.parkedUntil) {
    s.parkedUntil = null;
    s.reason = null;
    shareKey(s);
    return true;
  }
  return false;
}

export function noteKeyUse(providerId: string, index: number) {
  const s = ensureKey(providerId, index);
  s.uses += 1;
  // Use counters only spread load, so mirroring every tenth call is plenty and
  // keeps the hot path off the database.
  if (s.uses % 10 === 0) shareKey(s);
}

/** Park a key that is out of quota / rate limited / invalid. */
export function parkKey(
  providerId: string,
  index: number,
  kind: KeyFailureKind,
  cooldownMs: number,
) {
  const s = ensureKey(providerId, index);
  s.parkedUntil = Date.now() + cooldownMs;
  s.reason = kind;
  metrics.keyRotations += 1;
  shareKey(s);
}


/** Key indexes to try for a provider, least-recently-loaded first. */
export function orderKeys(providerId: string, total: number): number[] {
  const all = Array.from({ length: total }, (_, i) => i);
  const usable = all.filter((i) => isKeyAvailable(providerId, i));
  // Spread load across healthy keys so no single key carries every user.
  const pool = usable.length ? usable : all;
  return pool.sort((a, b) => ensureKey(providerId, a).uses - ensureKey(providerId, b).uses);
}

export function getKeySnapshot() {
  return [...keys.values()].map((s) => ({
    provider: s.providerId,
    index: s.index,
    uses: s.uses,
    reason: s.reason,
    available: isKeyAvailable(s.providerId, s.index),
    parkedUntil: s.parkedUntil,
  }));
}

// ---------------------------------------------------------------------------
// Gateway-wide metrics
// ---------------------------------------------------------------------------

export interface GatewayMetrics {
  startedAt: number;
  requests: number;
  succeeded: number;
  failed: number;
  retries: number;
  switches: number;
  keyRotations: number;

  cacheHits: number;
  cacheMisses: number;
  queued: number;
  totalLatencyMs: number;
  byCapability: Record<string, number>;
  lastProvider: string | null;
}

export const metrics: GatewayMetrics = {
  startedAt: Date.now(),
  requests: 0,
  succeeded: 0,
  failed: 0,
  retries: 0,
  switches: 0,
  keyRotations: 0,

  cacheHits: 0,
  cacheMisses: 0,
  queued: 0,
  totalLatencyMs: 0,
  byCapability: {},
  lastProvider: null,
};

export function noteCapability(cap: string) {
  metrics.byCapability[cap] = (metrics.byCapability[cap] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Response cache — opt-in only, never used for personalised conversations
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) {
    metrics.cacheMisses += 1;
    return undefined;
  }
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    metrics.cacheMisses += 1;
    return undefined;
  }
  metrics.cacheHits += 1;
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown) {
  const cfg = getGatewayConfig();
  if (cache.size >= cfg.cacheMaxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + cfg.cacheTtlMs });
}

export function cacheSize() {
  return cache.size;
}

/** Stable, non-cryptographic hash used for cache keys. */
export function hashKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Concurrency limiter / request queue
// ---------------------------------------------------------------------------

let active = 0;
const waiters: (() => void)[] = [];

export function queueSize() {
  return waiters.length;
}
export function activeRequests() {
  return active;
}

export async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  const cfg = getGatewayConfig();
  if (active >= cfg.maxConcurrency) {
    if (waiters.length >= cfg.maxQueue) throw new Error("AI_BUSY");
    metrics.queued += 1;
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await run();
  } finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}
