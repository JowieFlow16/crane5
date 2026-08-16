# Crane 5 — Nationwide AI Tutor: Architecture Review & Phased Plan

Per your build rule (§34/§36): inspection and gap analysis first, no destructive rewrite.

## 1. What already exists (reusable, keep)

**Provider abstraction — already built.** `src/lib/ai/registry.server.ts` defines 8 providers (OpenRouter, Lovable AI, Requesty, AIMLAPI, OFOX, HaiMaker, AllModels, Auto Router) with per-capability model lists, env-overridable base URLs, multi-key rotation, and capability preferences. Adding a provider is a single array entry — the §3 requirement is satisfied.

**Routing + failover — mostly built.** `src/lib/ai/gateway.server.ts` runs the request lifecycle: capability selection, provider ordering, key rotation, timeout, hedging, error classification (rate limit / quota / invalid key), cross-provider failover. `src/lib/ai/models.server.ts` classifies tasks (MATH, PHYSICS, COMPLEX_REASONING, ADMIN_CONTENT…) and maps them to model chains + reasoning effort. `src/lib/ai/health.server.ts` holds circuit breakers, cooldowns, key parking, an in-memory response cache, a concurrency gate (`withSlot`) and counters.

**Usage & quota — built at the student level.** `consume_ai_quota`, `ai_effective_limits`, `ai_usage_snapshot` in the database enforce per-user daily request/image caps by plan, so one student cannot consume others' allowance (§7 core guarantee).

**Observability — built per request.** `ai_request_log` records provider, model, task, subject, tokens, cost, latency, status; `ai_cost_overview()` + `AiObservabilityAdmin.tsx` surface spend, error rate, top users, failures.

**Teaching engine + curriculum — partly built.** `ncdc-framework.ts`, `subjects.ts`, `notation.ts`, `knowledge-context.server.ts` (RAG over admin documents/videos), progress/mastery/flashcards/quiz tables, `markQuiz`.

**Safety/abuse — partly built.** `abuse.server.ts` (sliding-window limits, duplicate detection, history trimming), RLS on every table, `user_roles` + `has_role`, admin-only surfaces.

## 2. Real gaps (what the spec asks for and the app lacks)

| Gap | Why it matters at national scale |
| --- | --- |
| Health, cache, key-state, metrics and the concurrency gate are **per-worker in-memory** | Serverless workers are stateless and horizontally replicated; a circuit breaker one worker learned is invisible to the others, so failover and cache hit rates degrade as traffic grows |
| **No durable queue** | Concurrency is a per-worker semaphore; 2,000 concurrent students still fan out to providers |
| **No platform/provider budget layer** | Only per-student caps exist; nothing stops a nationwide day from blowing the monthly AI budget |
| **No admin-editable runtime config** | Provider priority, quotas, policies, thresholds live in env vars/code — you must ship code to change them |
| **No alert center, no system-health status, no predictive overload** | Overload is discovered by student complaints |
| **No cost-aware policy modes** (Economy/Balanced/Premium/Emergency/Maintenance) | No lever to cut spend during a spike |
| **No feature flags** | Nationwide rollout is all-or-nothing |
| **Cache is not measured or curriculum-aware** | Biggest single cost saver is untracked |
| **No load tests** | Bottleneck is assumed, not identified |

## 3. Recommended sequencing

Phase 2 first — durability is the actual blocker; every admin feature afterwards reads from it.

### Phase A — Durable AI control plane (foundation for everything else)
New tables + RLS: `ai_providers_config`, `ai_models_config`, `provider_health`, `ai_cache_entries`, `ai_budgets`, `ai_policies`, `feature_flags`, `system_alerts`, `system_metrics`, `audit_logs`, `ai_queue_jobs`.
- Registry reads provider enable/priority/limits from the database with the current code values as fallback, cached briefly in-process.
- Health/circuit-breaker state and key parking move to `provider_health` (write-through, in-memory read cache) so all workers share one view.
- Response cache moves to `ai_cache_entries`, keyed by normalized question + subject + level, never by student, with hit/miss/savings counters.
- Every AI request gets a correlation id threaded through log lines and `ai_request_log`.

### Phase B — Queue, budgets, policy modes
- `ai_queue_jobs` with priority (P0–P4), per-user fair scheduling, retry + exponential backoff, dead-letter, timeout, dedupe. Interactive chat stays synchronous with an admission gate; heavy/batch work (quiz generation, image, video, curriculum indexing) goes async with status polling.
- Budget service: platform daily/monthly, per-provider, per-plan caps checked before dispatch; graceful degrade → cheaper model → friendly message.
- Policy modes Normal / High Demand / Restricted / Emergency / Maintenance, each a stored row remapping model chains and limits. Cost-aware routing picks the cheapest model that clears the task's quality bar.

### Phase C — Admin control room
- Live tiles: users (total/new/active today-week-month), AI (asked, failed, avg latency, avg queue wait, tokens, cost, cache hit rate), queue (length, processing, oldest job, retries, dead-letter), provider health matrix with status chips (Healthy / Degraded / Rate limited / Offline).
- System status 🟢🟡🟠🔴 from configurable thresholds; predictive alert when queue growth rate or budget burn trends toward exhaustion.
- Alert center: severity, component, description, recommended action, resolve.
- Controls: enable/disable provider, reorder priority, edit quotas/budgets/thresholds, switch policy mode, toggle feature flags, manage users/roles/curriculum — destructive actions behind a typed confirmation, all writes to `audit_logs`.
- Realtime for queue/health/alerts; the rest on a slow interval.

### Phase D — Student resilience & teaching depth
Queued-request status UI, retry/resume on flaky connections, offline access to previously cached lessons, low-bandwidth rendering. Teaching layer gains adaptive difficulty from mastery, misconception tracking, hint-before-answer bias.

### Phase E — Hardening
Vitest coverage for routing, failover, key rotation, quota, budget, cache correctness (no cross-student leakage), queue fairness, RBAC isolation; scripted load runs at 100 / 1k / 5k / 10k simulated students to find the real bottleneck.

## 4. What I will not change
Existing student-facing routes and their behaviour, the current provider keys and registry entries, the RLS model, quiz/flashcard/progress/community schemas, `src/integrations/supabase/*`, and the Lovable AI fallback that keeps the tutor alive when OpenRouter is down.

## 5. Risks
- Serverless workers have no long-lived background process, so the queue needs a scheduled drain endpoint (`/api/public/queue/drain`) driven by cron rather than a resident worker.
- Database-backed health/cache adds a read per request; mitigated with short in-process TTL caching.
- Moving provider config to the database can silently disable a provider if seeded wrong — seed from the current code values verbatim.

## 6. Technical notes
Server-only logic stays in `createServerFn` and `*.server.ts`; cron/drain endpoints under `src/routes/api/public/*` with a shared-secret header check. New tables ship with GRANTs, RLS, admin-only policies via `has_role`, and indexes on `(created_at)`, `(provider, created_at)`, `(user_id, created_at)`, `(status, priority, created_at)`.

## Proposed next step
Start with Phase A, then Phase B — say the word and I will implement Phase A in this session.
