import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Sb = { from: (t: string) => any };

async function assertAdmin(supabase: unknown, userId: string) {
  const { data } = await (supabase as Sb)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Turn a web page into clean, learnable plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function titleOf(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : null;
}

const MAX_TEXT = 60_000;

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "OmicronAI-Learner/1.0", Accept: "text/html,text/plain,*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Couldn't read that link (HTTP ${res.status}).`);
  const html = await res.text();
  const text = htmlToText(html).slice(0, MAX_TEXT);
  if (text.length < 200) throw new Error("That page had almost no readable text.");
  return { text, title: titleOf(html) };
}

/** Admin: teach Omicron from a web link. */
export const learnFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().url().max(2000),
        name: z.string().max(200).optional(),
        subject: z.string().max(80).optional(),
        classLevel: z.string().max(10).optional(),
        docType: z.string().max(60).default("web link"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    if (!/^https?:\/\//i.test(data.url)) throw new Error("Only http(s) links are supported.");

    const { text, title } = await fetchPage(data.url);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Re-learning the same link replaces the old copy.
    await supabaseAdmin.from("documents").delete().eq("source_url", data.url);

    const { error } = await supabaseAdmin.from("documents").insert({
      name: (data.name?.trim() || title || data.url).slice(0, 200),
      subject: data.subject ?? null,
      class_level: (data.classLevel ?? null) as never,
      doc_type: data.docType,
      storage_path: `link/${Date.now()}`,
      content_text: text,
      source_url: data.url,
      source_type: "link",
      last_fetched_at: new Date().toISOString(),
      uploaded_by: context.userId as string,
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true, characters: text.length, title: title ?? data.url };
  });

/** Admin: teach Omicron from a video link (captions / transcript). */
export const learnFromVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().url().max(2000),
        name: z.string().max(200).optional(),
        subject: z.string().max(80).optional(),
        classLevel: z.string().max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    if (!/^https?:\/\//i.test(data.url)) throw new Error("Only http(s) links are supported.");

    const { fetchVideoLesson } = await import("./knowledge-video.server");
    const lesson = await fetchVideoLesson(data.url);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Re-learning the same video replaces the old copy.
    await supabaseAdmin.from("documents").delete().eq("source_url", data.url);

    const { error } = await supabaseAdmin.from("documents").insert({
      name: (data.name?.trim() || lesson.title).slice(0, 200),
      subject: data.subject ?? null,
      class_level: (data.classLevel ?? null) as never,
      doc_type: `${lesson.platform} video`,
      storage_path: `video/${Date.now()}`,
      content_text: lesson.text,
      source_url: data.url,
      source_type: "video",
      last_fetched_at: new Date().toISOString(),
      uploaded_by: context.userId as string,
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true, characters: lesson.text.length, title: lesson.title };
  });

/** Admin: re-read every saved link so the tutor stays up to date. */

export const refreshLinkSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("documents")
      .select("id, source_url, source_type")
      .in("source_type", ["link", "video"])
      .not("source_url", "is", null)
      .order("last_fetched_at", { ascending: true, nullsFirst: true })
      .limit(10);

    let updated = 0;
    let failed = 0;
    for (const row of (rows ?? []) as {
      id: string;
      source_url: string;
      source_type: string;
    }[]) {
      try {
        let text: string;
        if (row.source_type === "video") {
          const { fetchVideoLesson } = await import("./knowledge-video.server");
          text = (await fetchVideoLesson(row.source_url)).text;
        } else {
          text = (await fetchPage(row.source_url)).text;
        }

        const { error } = await supabaseAdmin
          .from("documents")
          .update({ content_text: text, last_fetched_at: new Date().toISOString() } as never)
          .eq("id", row.id);
        if (error) throw new Error(error.message);
        updated++;
      } catch {
        failed++;
      }
    }
    return { updated, failed, checked: rows?.length ?? 0 };
  });
