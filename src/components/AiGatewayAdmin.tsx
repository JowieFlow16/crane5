import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGatewayStats } from "@/lib/ai-gateway.functions";
import { Activity, Gauge, Layers, RefreshCw, Server, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

/** Admin analytics for the multi-provider AI gateway. */
export function AiGatewayAdmin() {
  const fetchStats = useServerFn(getGatewayStats);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["gateway-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 20_000,
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Server className="h-4 w-4 text-primary" /> AI Gateway
        </h2>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading gateway health…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Current provider" value={data.currentProvider ?? "—"} />
            <Stat label="Requests" value={data.requests} />
            <Stat label="Success rate" value={`${data.successRate}%`} />
            <Stat label="Failure rate" value={`${data.failureRate}%`} />
            <Stat label="Avg response" value={`${data.avgResponseMs} ms`} />
            <Stat label="Cache hit rate" value={`${data.cacheHitRate}%`} />
            <Stat label="Queue size" value={data.queueSize} />
            <Stat label="In flight" value={data.activeRequests} />
            <Stat label="Retries" value={data.retries} />
            <Stat label="Provider switches" value={data.switches} />
            <Stat label="Images" value={data.byCapability.image ?? 0} />
            <Stat label="Video / audio" value={(data.byCapability.video ?? 0) + (data.byCapability.audio ?? 0)} />
          </div>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Fallback chain:{" "}
              <span className="font-mono text-foreground">
                {data.fallbackChain.join(" → ") || "none configured"}
              </span>
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {data.providers.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      !p.configured
                        ? "bg-muted-foreground/40"
                        : p.available
                          ? "bg-success"
                          : "bg-destructive"
                    }`}
                  />
                  {p.label}
                  {!p.configured && (
                    <span className="text-muted-foreground">(no key)</span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" /> {p.score}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {p.avgLatencyMs}ms
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" /> {p.uptime === null ? "—" : `${p.uptime}%`}
                  </span>
                  <span>
                    {p.success}✓ / {p.failure}✗
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
