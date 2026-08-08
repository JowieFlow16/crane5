import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_study_tasks",
  title: "List study tasks",
  description: "List the signed-in learner's study planner tasks.",
  inputSchema: {
    includeDone: z.boolean().optional().describe("Include tasks already marked done."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeDone }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("study_tasks")
      .select("id, title, subject, due_date, done, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!includeDone) query = query.eq("done", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
