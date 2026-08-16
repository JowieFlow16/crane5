import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const JobKind = z.enum(["image", "quiz", "revision", "indexing", "text"]);

const EnqueueInput = z.object({
  kind: JobKind,
  prompt: z.string().min(1).max(8_000).optional(),
  subject: z.string().max(80).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  json: z.boolean().optional(),
});

/** Queue heavy AI work so a nationwide spike becomes a queue, not a flood. */
export const queueAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EnqueueInput.parse(input))
  .handler(async ({ data, context }) => {
    const { enqueueJob } = await import("./ai/queue.server");
    const job = await enqueueJob({
      kind: data.kind,
      userId: context.userId,
      priority: data.priority ?? 3,
      payload: {
        prompt: data.prompt ?? "",
        subject: data.subject ?? null,
        json: data.json ?? false,
      },
      dedupeKey: data.prompt ? `${data.kind}:${context.userId}:${data.prompt.slice(0, 180)}` : null,
    });
    return { id: job.id, status: job.status };
  });

const JobId = z.object({ id: z.string().uuid() });

/** Poll one of your own jobs. Other learners' jobs are never returned. */
export const getAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => JobId.parse(input))
  .handler(async ({ data, context }) => {
    const { readJob } = await import("./ai/queue.server");
    const job = await readJob(data.id);
    if (!job || job.userId !== context.userId) return null;
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      attempts: job.attempts,
      result: job.result,
      errorMessage: job.errorMessage,
    };
  });
