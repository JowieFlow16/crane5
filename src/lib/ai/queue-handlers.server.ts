// Server-only handlers for queued AI work.
//
// Handlers must be pure "payload in, serialisable result out" so a drain
// worker can run them without any request context.

import { chat, generateImage, type ChatMessage } from "./gateway.server";
import type { JobKind, QueueJob } from "./queue.server";

type Handler = (job: QueueJob) => Promise<unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

const HANDLERS: Record<JobKind, Handler> = {
  image: async (job) => {
    const prompt = str(job.payload["prompt"]);
    if (!prompt) throw new Error("Missing prompt");
    return { url: await generateImage(prompt, prompt) };
  },
  text: async (job) => runChat(job),
  quiz: async (job) => runChat(job, true),
  revision: async (job) => runChat(job),
  indexing: async (job) => runChat(job),
};

async function runChat(job: QueueJob, json = false) {
  const messages = Array.isArray(job.payload["messages"])
    ? (job.payload["messages"] as ChatMessage[])
    : null;
  const prompt = str(job.payload["prompt"]);
  if (!messages && !prompt) throw new Error("Missing prompt");
  const content = await chat({
    messages: messages ?? [{ role: "user", content: prompt }],
    json: json || job.payload["json"] === true,
    task: (job.payload["task"] as never) ?? undefined,
    subject: str(job.payload["subject"]) || undefined,
    userId: job.userId ?? undefined,
    cacheKey: str(job.payload["cacheKey"]) || undefined,
  });
  return { content };
}

export function handlerFor(kind: JobKind): Handler | undefined {
  return HANDLERS[kind];
}
