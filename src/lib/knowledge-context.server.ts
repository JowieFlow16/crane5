// Server-only knowledge retrieval. Ranks EVERY learned source — uploaded
// curriculum documents, web links and video transcripts — so the tutor can
// actually use what an admin taught it, even when a video has no subject tag.

export interface KnowledgeDoc {
  id: string;
  name: string;
  subject: string | null;
  doc_type: string | null;
  source_url: string | null;
  source_type: string | null;
  content_text: string | null;
}

const STOP = new Set([
  "the","a","an","and","or","of","to","in","is","are","was","were","be","it","this","that","for",
  "on","with","as","at","by","from","how","what","why","when","which","who","do","does","did","i",
  "you","me","my","we","us","can","please","explain","tell","about","help","using","use",
]);

function keywords(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[a-z0-9']{3,}/g) ?? []).filter((w) => !STOP.has(w)),
    ),
  ].slice(0, 25);
}

/** Pull the slice of a long transcript that actually talks about the question. */
function bestExcerpt(text: string, words: string[], chars: number): string {
  if (text.length <= chars || words.length === 0) return text.slice(0, chars);
  const lower = text.toLowerCase();
  const window = chars;
  const step = Math.max(400, Math.floor(window / 3));
  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start < lower.length; start += step) {
    const chunk = lower.slice(start, start + window);
    let score = 0;
    for (const w of words) if (chunk.includes(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  const prefix = bestStart > 0 ? "…" : "";
  return prefix + text.slice(bestStart, bestStart + window) + (bestStart + window < text.length ? "…" : "");
}

function scoreDoc(doc: KnowledgeDoc, words: string[], subject?: string, classLevel?: string) {
  const hay = `${doc.name} ${doc.subject ?? ""} ${doc.doc_type ?? ""}`.toLowerCase();
  const body = (doc.content_text ?? "").toLowerCase();
  let score = 0;

  if (subject) {
    const s = subject.toLowerCase();
    if ((doc.subject ?? "").toLowerCase().includes(s)) score += 8;
    else if (hay.includes(s) || body.includes(s)) score += 3;
    else if (!doc.subject) score += 1; // untagged sources (e.g. videos) stay eligible
  }
  if (classLevel && hay.includes(classLevel.toLowerCase())) score += 2;

  for (const w of words) {
    if (hay.includes(w)) score += 2;
    if (body.includes(w)) score += 1;
  }
  return score;
}

function label(doc: KnowledgeDoc): string {
  const kind =
    doc.source_type === "video"
      ? `Video lesson${doc.doc_type ? ` — ${doc.doc_type}` : ""}`
      : doc.source_type === "link"
        ? "Web source"
        : (doc.doc_type ?? "Curriculum document");
  const bits = [kind, doc.subject ? doc.subject : null].filter(Boolean).join(" · ");
  return `# ${doc.name}\n(${bits}${doc.source_url ? ` · ${doc.source_url}` : ""})`;
}

/**
 * Retrieve the most relevant learned material for a request.
 * `query` should be the learner's question / topic.
 */
export async function retrieveKnowledge(opts: {
  query?: string;
  subject?: string;
  classLevel?: string;
  limit?: number;
  charsPerDoc?: number;
}): Promise<{ docs: KnowledgeDoc[]; context: string }> {
  const limit = opts.limit ?? 4;
  const charsPerDoc = opts.charsPerDoc ?? 2500;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data } = await supabaseAdmin
    .from("documents")
    .select("id, name, subject, doc_type, source_url, source_type, content_text")
    .not("content_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const all = ((data ?? []) as KnowledgeDoc[]).filter(
    (d) => (d.content_text ?? "").trim().length > 100,
  );
  if (all.length === 0) return { docs: [], context: "" };

  const words = keywords(`${opts.query ?? ""} ${opts.subject ?? ""}`);
  const ranked = all
    .map((d) => ({ d, s: scoreDoc(d, words, opts.subject, opts.classLevel) }))
    .sort((a, b) => b.s - a.s)
    .filter((r) => r.s > 0)
    .slice(0, limit)
    .map((r) => r.d);

  const docs = ranked.length ? ranked : all.slice(0, limit);

  const context =
    "\n\n=== LEARNED REFERENCE MATERIAL (curriculum documents, web sources and video lessons Omicron has studied — ground your answer in this and cite the source name when you use it) ===\n" +
    docs
      .map((d) => `${label(d)}\n${bestExcerpt((d.content_text ?? "").trim(), words, charsPerDoc)}`)
      .join("\n\n---\n\n");

  return { docs, context };
}
