import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  activatePolicy,
  getControlPlane,
  resolveAlert,
  updateFeatureFlag,
  updateProvider,
} from "@/lib/control-plane.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Database, Server, SlidersHorizontal } from "lucide-react";

type Row = Record<string, unknown>;

const str = (r: Row, k: string) => (r[k] == null ? "" : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);
const bool = (r: Row, k: string) => r[k] === true;

function providerStatus(h: Row | undefined) {
  if (!h) return { label: "Unproven", tone: "text-muted-foreground bg-muted" };
  const disabledUntil = h["disabled_until"] ? new Date(String(h["disabled_until"])).getTime() : 0;
  if (disabledUntil > Date.now()) return { label: "Cooling down", tone: "text-destructive bg-destructive/10" };
  const total = num(h, "success") + num(h, "failure");
  const rate = total ? num(h, "success") / total : 1;
  if (rate < 0.6) return { label: "Degraded", tone: "text-amber-600 bg-amber-500/15" };
  return { label: "Healthy", tone: "text-success bg-success/15" };
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

/** Admin-only control room for providers, operating mode, flags and alerts. */
export function AiControlPlaneAdmin() {
  const qc = useQueryClient();
  const fetchPlane = useServerFn(getControlPlane);
  const patchProvider = useServerFn(updateProvider);
  const patchFlag = useServerFn(updateFeatureFlag);
  const setPolicy = useServerFn(activatePolicy);
  const closeAlert = useServerFn(resolveAlert);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-control-plane"],
    queryFn: () => fetchPlane(),
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ai-control-plane"] });
  const fail = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : "Could not save that change");

  const providerMutation = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => patchProvider({ data: input }),
    onSuccess: () => {
      toast.success("Provider updated");
      invalidate();
    },
    onError: fail,
  });

  const flagMutation = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) => patchFlag({ data: input }),
    onSuccess: () => {
      toast.success("Feature updated");
      invalidate();
    },
    onError: fail,
  });

  const policyMutation = useMutation({
    mutationFn: (id: string) => setPolicy({ data: { id } }),
    onSuccess: () => {
      toast.success("Operating mode changed");
      invalidate();
    },
    onError: fail,
  });

  const alertMutation = useMutation({
    mutationFn: (id: string) => closeAlert({ data: { id } }),
    onSuccess: invalidate,
    onError: fail,
  });

  if (isLoading || !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="text-sm text-muted-foreground">Loading AI control plane…</p>
      </section>
    );
  }

  const health = new Map(data.health.map((h) => [str(h as Row, "provider_id"), h as Row]));
  const openAlerts = data.alerts.filter((a) => !bool(a as Row, "resolved"));
  const budget = (data.budgets[0] ?? {}) as Row;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-primary" /> AI control plane
        <span className="text-xs font-normal text-muted-foreground">live, shared by all servers</span>
      </h2>

      <Section title="Operating mode" icon={<SlidersHorizontal className="h-3 w-3" />}>
        <div className="flex flex-wrap gap-1.5">
          {data.policies.map((raw) => {
            const p = raw as Row;
            const id = str(p, "id");
            const active = bool(p, "active");
            return (
              <Button
                key={id}
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={policyMutation.isPending}
                onClick={() => !active && policyMutation.mutate(id)}
              >
                {str(p, "name")}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Daily budget ${num(budget, "daily_limit").toFixed(2)} · monthly $
          {num(budget, "monthly_limit").toFixed(2)}
        </p>
      </Section>

      <Section title="Providers" icon={<Server className="h-3 w-3" />}>
        <div className="space-y-1.5">
          {data.providers
            .map((p) => p as Row)
            .sort((a, b) => num(a, "priority") - num(b, "priority"))
            .map((p) => {
              const id = str(p, "id");
              const status = providerStatus(health.get(id));
              const h = health.get(id);
              return (
                <div key={id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {str(p, "label")}{" "}
                      <span className="text-muted-foreground">#{num(p, "priority")}</span>
                    </p>
                    <p className="truncate text-muted-foreground">
                      <span className={`rounded-full px-1.5 py-0.5 ${status.tone}`}>
                        {status.label}
                      </span>
                      {h ? ` · ${num(h, "avg_latency_ms")} ms · ${num(h, "success")}✓ / ${num(h, "failure")}✗` : ""}
                    </p>
                  </div>
                  <Switch
                    checked={bool(p, "enabled")}
                    disabled={providerMutation.isPending}
                    onCheckedChange={(enabled) => providerMutation.mutate({ id, enabled })}
                  />
                </div>
              );
            })}
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Platform budget" icon={<Wallet className="h-3 w-3" />}>
          <p className="text-lg font-semibold">
            ${data.budget.spentToday.toFixed(4)}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              / ${data.budget.dailyLimit.toFixed(2)} today
            </span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${data.budget.exhausted ? "bg-destructive" : data.budget.degrade ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(data.budget.dayPercent, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This month ${data.budget.spentMonth.toFixed(4)} of $
            {data.budget.monthlyLimit.toFixed(2)} ({data.budget.monthPercent}%)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.budget.exhausted
              ? "Budget spent — new AI requests are refused."
              : data.budget.degrade
                ? "Cost-saving routing active (cheapest acceptable model)."
                : "Normal cost-aware routing."}
          </p>
        </Section>

        <Section title="Job queue" icon={<ListOrdered className="h-3 w-3" />}>
          <p className="text-lg font-semibold">{data.queue.pending.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            waiting · {data.queue.running} running · {data.queue.dead} dead-letter
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oldest wait {Math.round(data.queue.oldestPendingMs / 1000)}s · {data.queue.done} done
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={drainMutation.isPending}
            onClick={() => drainMutation.mutate()}
          >
            {drainMutation.isPending ? "Processing…" : "Process queue now"}
          </Button>
        </Section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Feature flags" icon={<SlidersHorizontal className="h-3 w-3" />}>
          <div className="space-y-1.5">
            {data.flags.map((raw) => {
              const f = raw as Row;
              const key = str(f, "key");
              return (
                <div key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{str(f, "label")}</span>
                  <Switch
                    checked={bool(f, "enabled")}
                    disabled={flagMutation.isPending}
                    onCheckedChange={(enabled) => flagMutation.mutate({ key, enabled })}
                  />
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Shared answer cache" icon={<Database className="h-3 w-3" />}>
          <p className="text-lg font-semibold">{data.cache.entries.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            cached answers · {data.cache.hits.toLocaleString()} reuses saved from providers
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Parked keys: {data.keys.filter((k) => (k as Row)["parked_until"] != null).length} of{" "}
            {data.keys.length}
          </p>
        </Section>
      </div>

      <Section title="Alerts" icon={<BellRing className="h-3 w-3" />}>
        {openAlerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open alerts.</p>
        ) : (
          <div className="space-y-1.5">
            {openAlerts.map((raw) => {
              const a = raw as Row;
              const id = str(a, "id");
              return (
                <div key={id} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      {str(a, "title")}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {str(a, "component")} · {str(a, "recommended_action")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={alertMutation.isPending}
                    onClick={() => alertMutation.mutate(id)}
                  >
                    Resolve
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </section>
  );
}
