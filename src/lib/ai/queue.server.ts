// Server-only durable AI job queue.
//
// Interactive tutoring stays synchronous (students must not wait on a cron
// tick). Heavy or bursty work — image generation, quiz generation, revision
// packs, curriculum indexing — is enqueued here and drained by a scheduled
// endpoint, so a nationwide spike becomes a queue instead of a provider flood.
//
// Guarantees:
//  * priority ordering (0 = highest) with oldest-first inside a priority;
//  * dedupe: an identical pending job is reused instead of duplicated;
//  * per-user fair scheduling: one user cannot occupy a whole drain batch;
//  * exponential backoff with a dead-letter state after max attempts.

import { raiseAlert, recordMetric } from "./control-plane.server";

export type JobKind = "image" | "quiz" | "revision" | "indexing" | "text";
export type JobStatus = "pending" | "running" | "done" | "failed" | "dead";

export interface QueueJob {
  id: string;
  userId: string | null;
  kind: JobKind;
  priority: number;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const BACKOFF_MS = [0, 5_000, 20_000, 60_000, 180_000];

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Deliberately loose typing: these tables are internal infrastructure and are
// not part of the generated public API surface used by the app UI.
type Row = Record<string, unknown>;
const table = (client: Awaited<ReturnType<typeof db>>, name: string) =>
  client.from(name as never) as never as {
    select: (cols: string) => never;
    insert: (values: unknown) => never;
    update: (values: unknown) => never;
  };

function toJob(row: Row): QueueJob {
  return {
    id: String(row["id"]),
    userId: row["user_id"] == null ? null : String(row["user_id"]),
    kind: String(row["kind"]) as JobKind,
    priority: Number(row["priority"] ?? 3),
    status: String(row["status"] ?? "pending") as JobStatus,
    attempts: Number(row["attempts"] ?? 0),
    maxAttempts: Number(row["max_attempts"] ?? 3),
    payload: (row["payload"] ?? {}) as Record<string, unknown>,
    result: row["result"] ?? null,
    errorMessage: row["error_message"] == null ? null : String(row["error_message"]),
    createdAt: String(row["created_at"] ?? ""),
    finishedAt: row["finished_at"] == null ? null : String(row["finished_at"]),
  };
}

export interface EnqueueInput {
  kind: JobKind;
  payload: Record<string, unknown>;
  userId?: string | null;
  /** 0 = highest. Interactive-ish work 1, batch work 3. */
  priority?: number;
  dedupeKey?: string | null;
  maxAttempts?: number;
  correlationId?: string | null;
}

/** Add a job (or return the identical pending one). */
export async function enqueueJob(input: EnqueueInput): Promise<QueueJob> {
  const client = await db();

  if (input.dedupeKey) {
    const { data } = await (
      table(client, "ai_queue_jobs").select("*") as unknown as {
        eq: (c: string, v: unknown) => {
          in: (c: string, v: string[]) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: Row[] | null }>;
            };
          };
        };
      }
    )
      .eq("dedupe_key", input.dedupeKey)
      .in("status", ["pending", "running", "done"])
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = (data ?? [])[0];
    if (existing) return toJob(existing);
  }

  const { data, error } = await (
    table(client, "ai_queue_jobs").insert({
      user_id: input.userId ?? null,
      kind: input.kind,
      priority: Math.min(Math.max(input.priority ?? 3, 0), 4),
      payload: input.payload,
      dedupe_key: input.dedupeKey ?? null,
      max_attempts: input.maxAttempts ?? 3,
      correlation_id: input.correlationId ?? null,
    }) as unknown as {
      select: (c: string) => { single: () => Promise<{ data: Row | null; error: { message: string } | null }> };
    }
  )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not queue that job");
  recordMetric("queue.enqueued", 1, { kind: input.kind });
  return toJob(data);
}

/** A job's current state — callers poll this while it is pending. */
export async function readJob(id: string): Promise<QueueJob | null> {
  const client = await db();
  const { data } = await (
    table(client, "ai_queue_jobs").select("*") as unknown as {
      eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: Row | null }> };
    }
  )
    .eq("id", id)
    .maybeSingle();
  return data ? toJob(data) : null;
}

/**
 * Claim up to `limit` runnable jobs, at most `perUser` per learner so the
 * batch stays fair. Claiming marks them running immediately, which keeps
 * concurrent drains from doing the same work twice.
 */
export async function claimJobs(limit = 5, perUser = 2): Promise<QueueJob[]> {
  const client = await db();
  const nowIso = new Date().toISOString();

  const { data } = await (
    table(client, "ai_queue_jobs").select("*") as unknown as {
      eq: (c: string, v: unknown) => {
        lte: (c: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => { limit: (n: number) => Promise<{ data: Row[] | null }> };
          };
        };
      };
    }
  )
    .eq("status", "pending")
    .lte("run_after", nowIso)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit * 5);

  const perUserCount = new Map<string, number>();
  const picked: QueueJob[] = [];
  for (const row of data ?? []) {
    const job = toJob(row);
    const key = job.userId ?? "anonymous";
    const used = perUserCount.get(key) ?? 0;
    if (used >= perUser) continue;
    perUserCount.set(key, used + 1);
    picked.push(job);
    if (picked.length >= limit) break;
  }

  const claimed: QueueJob[] = [];
  for (const job of picked) {
    const { error } = await (
      table(client, "ai_queue_jobs").update({
        status: "running",
        attempts: job.attempts + 1,
        locked_at: nowIso,
        started_at: nowIso,
      }) as unknown as {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .eq("id", job.id)
      .eq("status", "pending");
    if (!error) claimed.push({ ...job, status: "running", attempts: job.attempts + 1 });
  }
  return claimed;
}

export async function completeJob(id: string, result: unknown): Promise<void> {
  const client = await db();
  await (
    table(client, "ai_queue_jobs").update({
      status: "done",
      result: result ?? null,
      error_message: null,
      finished_at: new Date().toISOString(),
    }) as unknown as { eq: (c: string, v: unknown) => Promise<unknown> }
  ).eq("id", id);
  recordMetric("queue.completed", 1);
}

/** Reschedule with backoff, or dead-letter when attempts are used up. */
export async function failJob(job: QueueJob, message: string): Promise<void> {
  const client = await db();
  const dead = job.attempts >= job.maxAttempts;
  const delay = BACKOFF_MS[Math.min(job.attempts, BACKOFF_MS.length - 1)] ?? 60_000;

  await (
    table(client, "ai_queue_jobs").update({
      status: dead ? "dead" : "pending",
      error_message: message.slice(0, 300),
      run_after: new Date(Date.now() + delay).toISOString(),
      locked_at: null,
      finished_at: dead ? new Date().toISOString() : null,
    }) as unknown as { eq: (c: string, v: unknown) => Promise<unknown> }
  ).eq("id", job.id);

  if (dead) {
    raiseAlert({
      severity: "warning",
      component: "queue",
      title: `Queued ${job.kind} job failed permanently`,
      description: message.slice(0, 300),
      recommendedAction: "Check provider health and budget, then retry the request.",
      dedupeKey: `queue-dead:${job.id}`,
    });
  }
  recordMetric(dead ? "queue.dead" : "queue.retry", 1, { kind: job.kind });
}

/** Release jobs a crashed worker left running. */
export async function requeueStale(olderThanMs = 5 * 60_000): Promise<void> {
  const client = await db();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  await (
    table(client, "ai_queue_jobs").update({
      status: "pending",
      locked_at: null,
    }) as unknown as {
      eq: (c: string, v: unknown) => { lt: (c: string, v: string) => Promise<unknown> };
    }
  )
    .eq("status", "running")
    .lt("locked_at", cutoff);
}

export interface QueueStats {
  pending: number;
  running: number;
  done: number;
  failed: number;
  dead: number;
  oldestPendingMs: number;
  byKind: Record<string, number>;
}

export async function queueStats(): Promise<QueueStats> {
  const client = await db();
  const { data } = await (
    table(client, "ai_queue_jobs").select("status, kind, created_at") as unknown as {
      order: (
        c: string,
        o: { ascending: boolean },
      ) => { limit: (n: number) => Promise<{ data: Row[] | null }> };
    }
  )
    .order("created_at", { ascending: false })
    .limit(1000);

  const stats: QueueStats = {
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
    dead: 0,
    oldestPendingMs: 0,
    byKind: {},
  };

  for (const row of data ?? []) {
    const status = String(row["status"]) as JobStatus;
    if (status in stats) (stats as unknown as Record<string, number>)[status] += 1;
    const kind = String(row["kind"]);
    stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
    if (status === "pending") {
      const age = Date.now() - new Date(String(row["created_at"])).getTime();
      if (age > stats.oldestPendingMs) stats.oldestPendingMs = age;
    }
  }
  return stats;
}
