import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiObservability } from "@/lib/ai-gateway.functions";
import { Activity, Coins, Cpu, RefreshCw, Timer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

function money(n: number) {
  return `$${(n ?? 0).toFixed(4)}`;
}

function Tile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Bars({
  rows,
}: {
  rows: { label: string; value: number; extra?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {r.value}
              {r.extra ? ` · ${r.extra}` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
    </div>
  );
}

/** Admin-only observability for Crane5's paid AI usage and cost. */
export function AiObservabilityAdmin() {
  const fetchStats = useServerFn(getAiObservability);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-observability"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  const o = data?.overview;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4 text-primary" /> AI usage &amp; cost
          <span className="text-xs font-normal text-muted-foreground">last 30 days</span>
        </h2>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading || !o ? (
        <p className="text-sm text-muted-foreground">Loading AI usage…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Requests today" value={o.requests_today} icon={<Activity className="h-3 w-3" />} />
            <Tile label="This week" value={o.requests_week} />
            <Tile label="All time" value={o.requests_total} />
            <Tile label="Error rate" value={`${o.error_rate}%`} icon={<TriangleAlert className="h-3 w-3" />} />
            <Tile label="Spend today" value={money(Number(o.cost_today))} icon={<Coins className="h-3 w-3" />} />
            <Tile label="Spend 30d" value={money(Number(o.cost))} />
            <Tile label="Avg latency" value={`${o.avg_latency_ms} ms`} icon={<Timer className="h-3 w-3" />} />
            <Tile
              label="Tokens (in/out)"
              value={`${o.input_tokens.toLocaleString()} / ${o.output_tokens.toLocaleString()}`}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">By model</p>
              <Bars
                rows={o.by_model.map((m) => ({
                  label: m.model,
                  value: m.requests,
                  extra: money(Number(m.cost)),
                }))}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">By task type</p>
              <Bars rows={o.by_task.map((t) => ({ label: t.task_type, value: t.requests }))} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">By subject</p>
              <Bars rows={o.by_subject.map((s) => ({ label: s.subject, value: s.requests }))} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Heaviest learners</p>
              <Bars
                rows={o.top_users.map((u) => ({
                  label: u.name,
                  value: u.requests,
                  extra: money(Number(u.cost)),
                }))}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Configured models</p>
            <ul className="space-y-1 font-mono text-xs">
              <li>primary · {data.models.primary}</li>
              <li>secondary · {data.models.secondary}</li>
              <li>escalation · {data.models.premium}</li>
              <li>vision · {data.models.vision}</li>
            </ul>
          </div>

          {o.recent_failures.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Recent failures</p>
              {o.recent_failures.map((f, i) => (
                <p key={i} className="truncate text-xs text-destructive">
                  {f.model} · {f.task_type} · {f.error_message ?? "unknown error"}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
