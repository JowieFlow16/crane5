// Scheduled queue drain. Serverless workers have no resident background
// process, so a cron caller (or the admin UI) pokes this endpoint and it
// processes a small, fair batch of queued AI jobs.
//
// Public prefix => authentication is enforced here with a shared secret.

import { createFileRoute } from "@tanstack/react-router";

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

async function drain(request: Request): Promise<Response> {
  const secret = process.env["QUEUE_DRAIN_SECRET"];
  if (!secret) return new Response("Queue drain is not configured", { status: 503 });

  const provided =
    request.headers.get("x-queue-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) return unauthorized();

  const { claimJobs, completeJob, failJob, requeueStale, queueStats } = await import(
    "@/lib/ai/queue.server"
  );
  const { handlerFor } = await import("@/lib/ai/queue-handlers.server");

  await requeueStale();
  const batch = await claimJobs(Number(process.env["QUEUE_BATCH_SIZE"] ?? 5));

  let processed = 0;
  let failed = 0;
  for (const job of batch) {
    const handler = handlerFor(job.kind);
    if (!handler) {
      await failJob(job, `No handler for job kind "${job.kind}"`);
      failed += 1;
      continue;
    }
    try {
      await completeJob(job.id, await handler(job));
      processed += 1;
    } catch (err) {
      await failJob(job, err instanceof Error ? err.message : String(err));
      failed += 1;
    }
  }

  return Response.json({ claimed: batch.length, processed, failed, queue: await queueStats() });
}

export const Route = createFileRoute("/api/public/queue/drain")({
  server: {
    handlers: {
      POST: ({ request }) => drain(request),
      GET: ({ request }) => drain(request),
    },
  },
});
