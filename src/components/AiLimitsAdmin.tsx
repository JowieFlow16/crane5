import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, Save, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  listAiPlans,
  listAiUsage,
  setUserAiPlan,
  updateAiPlan,
} from "@/lib/usage.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** Admin panel: configure per-user AI limits and inspect today's usage. */
export function AiLimitsAdmin() {
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listAiPlans);
  const fetchUsage = useServerFn(listAiUsage);
  const savePlan = useServerFn(updateAiPlan);
  const assignPlan = useServerFn(setUserAiPlan);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["ai-plans"],
    queryFn: () => fetchPlans(),
  });
  const { data: usage } = useQuery({
    queryKey: ["ai-usage-admin"],
    queryFn: () => fetchUsage(),
  });

  const [draft, setDraft] = useState<Record<string, { r: number; i: number; u: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("standard");
  const [unlimited, setUnlimited] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const valueFor = (p: { id: string; daily_requests: number; daily_images: number; unlimited: boolean }) =>
    draft[p.id] ?? { r: p.daily_requests, i: p.daily_images, u: p.unlimited };

  const save = async (id: string) => {
    const v = draft[id];
    if (!v) return;
    setSavingId(id);
    try {
      await savePlan({ data: { id, daily_requests: v.r, daily_images: v.i, unlimited: v.u } });
      toast.success("Limits updated.");
      setDraft((d) => {
        const { [id]: _drop, ...rest } = d;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ["ai-plans"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update limits.");
    } finally {
      setSavingId(null);
    }
  };

  const assign = async () => {
    if (!email.trim()) return toast.error("Enter the user's email.");
    setAssigning(true);
    try {
      const res = await assignPlan({ data: { email: email.trim(), planId, unlimited } });
      toast.success(`${res.name} is now on the ${planId} plan.`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["ai-usage-admin"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't assign the plan.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex min-w-0 items-center gap-2">
        <Gauge className="h-5 w-5 shrink-0 text-primary" />
        <h2 className="truncate font-display text-lg font-bold sm:text-xl">AI usage limits</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every account has its own daily allowance — one learner running out never affects anyone
        else. Change the numbers below at any time; no code changes needed.
      </p>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {(plans ?? []).map((p) => {
            const v = valueFor(p);
            const dirty = !!draft[p.id];
            return (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-background/60 p-3 sm:p-4"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <p className="truncate font-semibold">{p.name}</p>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Unlimited</span>
                    <Switch
                      checked={v.u}
                      onCheckedChange={(u) => setDraft((d) => ({ ...d, [p.id]: { ...v, u } }))}
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-muted-foreground">
                    AI requests / day
                    <Input
                      type="number"
                      min={0}
                      disabled={v.u}
                      value={v.r}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [p.id]: { ...v, r: Number(e.target.value) } }))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Images / day
                    <Input
                      type="number"
                      min={0}
                      disabled={v.u}
                      value={v.i}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [p.id]: { ...v, i: Number(e.target.value) } }))
                      }
                      className="mt-1"
                    />
                  </label>
                </div>
                {dirty && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={savingId === p.id}
                    onClick={() => save(p.id)}
                  >
                    {savingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign a plan / grant unlimited access */}
      <div className="mt-6 rounded-xl border border-border bg-background/60 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="font-semibold">Assign a plan to a user</h3>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="learner@example.com"
            type="email"
          />
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button onClick={assign} disabled={assigning}>
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Assign
          </Button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={unlimited} onCheckedChange={setUnlimited} />
          Grant this account unlimited AI usage
        </label>
      </div>

      {/* Today's usage */}
      {(usage ?? []).length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">Today's usage</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">User</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Requests</th>
                  <th className="py-2">OK</th>
                  <th className="py-2">Failed</th>
                  <th className="py-2">Images</th>
                </tr>
              </thead>
              <tbody>
                {(usage ?? []).map((u) => (
                  <tr key={u.user_id} className="border-t border-border">
                    <td className="max-w-[180px] truncate py-2">{u.name}</td>
                    <td className="py-2 capitalize">{u.unlimited ? "unlimited" : u.plan}</td>
                    <td className="py-2">{u.requests_today}</td>
                    <td className="py-2">{u.successful_requests}</td>
                    <td className="py-2">{u.failed_requests}</td>
                    <td className="py-2">{u.images_today}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
