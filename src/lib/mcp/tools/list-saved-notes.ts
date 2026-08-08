import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_saved_notes",
  title: "List saved notes",
  description:
    "List the signed-in learner's saved Crane5 notes and bookmarks, newest first, optionally filtered by subject.",
  inputSchema: {
    subject: z.string().trim().optional().describe("Filter by subject name."),
    limit: z.number().int().optional().describe("How many notes to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ subject, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("bookmarks")
      .select("id, kind, title, subject, content, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (subject) query = query.eq("subject", subject);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { notes: data ?? [] },
    };
  },
});
