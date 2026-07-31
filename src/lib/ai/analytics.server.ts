// Server-only gateway analytics aggregation (no keys are ever exposed).

import {
  activeRequests,
  cacheSize,
  getHealthSnapshot,
  metrics,
  queueSize,
} from "./health.server";
import {
  candidateProviders,
  getGatewayConfig,
  PROVIDERS,
  providerKey,
  type Capability,
} from "./registry.server";

export interface GatewayStats {
  currentProvider: string | null;
  fallbackChain: string[];
  requests: number;
  succeeded: number;
  failed: number;
  successRate: number;
  failureRate: number;
  avgResponseMs: number;
  retries: number;
  switches: number;
  cacheHits: number;
  cacheHitRate: number;
  cacheEntries: number;
  queueSize: number;
  activeRequests: number;
  uptimeMinutes: number;
  byCapability: Record<string, number>;
  providers: {
    id: string;
    label: string;
    configured: boolean;
    enabled: boolean;
    score: number;
    available: boolean;
    success: number;
    failure: number;
    uptime: number | null;
    avgLatencyMs: number;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
    lastError: string | null;
    disabledUntil: number | null;
  }[];
  config: {
    priority: string[];
    disabled: string[];
    preferences: Partial<Record<Capability, string[]>>;
    requestTimeoutMs: number;
    cooldownMs: number;
    maxConcurrency: number;
    maxQueue: number;
    cacheTtlMs: number;
  };
}

export function buildGatewayStats(): GatewayStats {
  const cfg = getGatewayConfig();
  const healthById = new Map(getHealthSnapshot().map((h) => [h.id, h]));
  const total = metrics.succeeded + metrics.failed;
  const cacheTotal = metrics.cacheHits + metrics.cacheMisses;

  return {
    currentProvider: metrics.lastProvider,
    fallbackChain: candidateProviders("text").map((p) => p.id),
    requests: metrics.requests,
    succeeded: metrics.succeeded,
    failed: metrics.failed,
    successRate: total ? Math.round((metrics.succeeded / total) * 100) : 100,
    failureRate: total ? Math.round((metrics.failed / total) * 100) : 0,
    avgResponseMs: metrics.succeeded
      ? Math.round(metrics.totalLatencyMs / metrics.succeeded)
      : 0,
    retries: metrics.retries,
    switches: metrics.switches,
    cacheHits: metrics.cacheHits,
    cacheHitRate: cacheTotal ? Math.round((metrics.cacheHits / cacheTotal) * 100) : 0,
    cacheEntries: cacheSize(),
    queueSize: queueSize(),
    activeRequests: activeRequests(),
    uptimeMinutes: Math.round((Date.now() - metrics.startedAt) / 60_000),
    byCapability: metrics.byCapability,
    providers: PROVIDERS.map((p) => {
      const h = healthById.get(p.id);
      return {
        id: p.id,
        label: p.label,
        configured: Boolean(providerKey(p)),
        enabled: !cfg.disabled.includes(p.id),
        score: h?.score ?? 75,
        available: h?.available ?? true,
        success: h?.success ?? 0,
        failure: h?.failure ?? 0,
        uptime: h?.uptime ?? null,
        avgLatencyMs: h?.avgLatencyMs ?? 0,
        lastSuccessAt: h?.lastSuccessAt ?? null,
        lastFailureAt: h?.lastFailureAt ?? null,
        lastError: h?.lastError ?? null,
        disabledUntil: h?.disabledUntil ?? null,
      };
    }),
    config: {
      priority: cfg.priority,
      disabled: cfg.disabled,
      preferences: cfg.preferences,
      requestTimeoutMs: cfg.requestTimeoutMs,
      cooldownMs: cfg.cooldownMs,
      maxConcurrency: cfg.maxConcurrency,
      maxQueue: cfg.maxQueue,
      cacheTtlMs: cfg.cacheTtlMs,
    },
  };
}
