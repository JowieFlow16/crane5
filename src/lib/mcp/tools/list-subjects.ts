import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_subjects",
  title: "List subjects and topics",
  description:
    "List the NCDC subjects available in Crane5, optionally with their topics for a class level.",
  inputSchema: {
    includeTopics: z.boolean().optional().describe("Include the topics for each subject."),
    classLevel: z
      .string()
      .optional()
      .describe("Filter topics by class level, e.g. S1, S2, S3, S4, S5, S6."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeTopics, classLevel }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: subjects, error } = await supabase
      .from("subjects")
      .select("id, name, slug, description")
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let topicsBySubject: Record<string, string[]> = {};
    if (includeTopics) {
      let query = supabase.from("topics").select("name, subject_id, class_level");
      if (classLevel) query = query.eq("class_level", classLevel as never);
      const { data: topics, error: topicsError } = await query;
      if (topicsError)
        return { content: [{ type: "text", text: topicsError.message }], isError: true };
      topicsBySubject = (topics ?? []).reduce<Record<string, string[]>>((acc, t) => {
        (acc[t.subject_id] ??= []).push(t.name);
        return acc;
      }, {});
    }

    const rows = (subjects ?? []).map((s) => ({
      name: s.name,
      slug: s.slug,
      description: s.description,
      ...(includeTopics ? { topics: topicsBySubject[s.id] ?? [] } : {}),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { subjects: rows },
    };
  },
});
