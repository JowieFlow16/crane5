// Server-only platform budget service.
//
// Per-student quotas already stop one learner consuming everyone's allowance.
// This layer protects the PLATFORM: a nationwide traffic spike must not blow
// the daily or monthly AI spend. Spend is read from the real cost ledger
// (`ai_request_log`), cached briefly so the hot path never waits on it.

import { raiseAlert } from "./control-plane.server";

export interface BudgetState {
  dailyLimit: number;
  monthlyLimit: number;
  enforce: boolean;
  thresholds: number[];
  spentToday: number;
  spentMonth: number;
  dayPercent: number;
  monthPercent: number;
  /** Hard stop: new paid requests are refused. */
  exhausted: boolean;
  /** Soft stop: keep serving, but on the cheapest acceptable model. */
  degrade: boolean;
}

const TTL_MS = Number(process.env["AI_BUDGET_TTL_MS"] ?? 30_000);
const DEGRADE_AT = 80; // percent of a limit where cost-aware routing kicks in

const FALLBACK: BudgetState = {
  dailyLimit: 0,
  monthlyLimit: 0,
  enforce: false,
  thresholds: [50, 70, 80, 90, 100],
  spentToday: 0,
  spentMonth: 0,
  dayPercent: 0,
  monthPercent: 0,
  exhausted: false,
  degrade: false,
};

let cached: BudgetState = FALLBACK;
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function pct(spent: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.round((spent / limit) * 100);
}

function sumCost(rows: { estimated_cost?: number | string | null }[] | null): number {
  return (rows ?? []).reduce((total, r) => total + Number(r.estimated_cost ?? 0), 0);
}

async function load(): Promise<void> {
  const db = await admin();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [budget, day, month] = await Promise.all([
    db.from("ai_budgets" as never).select("*").eq("id", "platform").maybeSingle(),
    db
      .from("ai_request_log" as never)
      .select("estimated_cost")
      .gte("created_at", dayStart.toISOString()),
    db
      .from("ai_request_log" as never)
      .select("estimated_cost")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const row = (budget.data ?? {}) as Record<string, unknown>;
  const dailyLimit = Number(row["daily_limit"] ?? 0);
  const monthlyLimit = Number(row["monthly_limit"] ?? 0);
  const spentToday = sumCost(day.data as never);
  const spentMonth = sumCost(month.data as never);
  const dayPercent = pct(spentToday, dailyLimit);
  const monthPercent = pct(spentMonth, monthlyLimit);
  const enforce = row["enforce"] !== false;
  const worst = Math.max(dayPercent, monthPercent);

  const next: BudgetState = {
    dailyLimit,
    monthlyLimit,
    enforce,
    thresholds: Array.isArray(row["alert_thresholds"])
      ? (row["alert_thresholds"] as unknown[]).map(Number)
      : FALLBACK.thresholds,
    spentToday,
    spentMonth,
    dayPercent,
    monthPercent,
    exhausted: enforce && worst >= 100,
    degrade: worst >= DEGRADE_AT,
  };

  announce(next, worst);
  cached = next;
  loadedAt = Date.now();
}

/** Raise one alert per crossed threshold per day, never a stream of them. */
function announce(state: BudgetState, worst: number) {
  const crossed = state.thresholds.filter((t) => worst >= t).sort((a, b) => b - a)[0];
  if (!crossed) return;
  const day = new Date().toISOString().slice(0, 10);
  raiseAlert({
    severity: crossed >= 100 ? "critical" : crossed >= 90 ? "warning" : "info",
    component: "budget",
    title: `AI spend reached ${crossed}% of budget`,
    description: `Today $${state.spentToday.toFixed(4)} of $${state.dailyLimit.toFixed(2)} · this month $${state.spentMonth.toFixed(4)} of $${state.monthlyLimit.toFixed(2)}.`,
    recommendedAction:
      crossed >= 100
        ? "Raise the budget or switch the operating mode to Restricted/Emergency."
        : "Consider switching to a cost-saving operating mode.",
    dedupeKey: `budget:${day}:${crossed}`,
  });
}

/** Non-blocking refresh; safe on every request. */
export function refreshBudget(): void {
  if (loading || Date.now() - loadedAt < TTL_MS) return;
  loading = load()
    .catch((err) => console.warn("[budget] refresh:", err instanceof Error ? err.message : err))
    .finally(() => {
      loading = null;
    });
}

/** Blocking read for admin views and pre-dispatch checks. */
export async function budgetState(): Promise<BudgetState> {
  if (Date.now() - loadedAt < TTL_MS) return cached;
  if (!loading) refreshBudget();
  if (loading) await loading;
  return cached;
}

/** Last known state without touching the database. */
export function budgetSnapshot(): BudgetState {
  return cached;
}

/** True when routing should prefer the cheapest acceptable model. */
export function shouldDegrade(): boolean {
  return cached.degrade;
}

/** Throws AI_BUDGET_EXCEEDED when the platform budget is spent. */
export async function assertBudget(): Promise<void> {
  const state = await budgetState();
  if (state.exhausted) throw new Error("AI_BUDGET_EXCEEDED");
}
