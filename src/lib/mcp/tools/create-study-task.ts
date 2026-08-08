import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_study_task",
  title: "Create a study task",
  description: "Add a task to the signed-in learner's Crane5 study planner.",
  inputSchema: {
    title: z.string().trim().describe("What the learner should study."),
    subject: z.string().trim().optional().describe("Subject name, e.g. Physics."),
    dueDate: z.string().trim().optional().describe("Due date as YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, subject, dueDate }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (!title) return { content: [{ type: "text", text: "title is required" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("study_tasks")
      .insert({
        user_id: ctx.getUserId()!,
        title,
        subject: subject ?? null,
        due_date: dueDate ?? null,
      })
      .select("id, title, subject, due_date, done")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added study task: ${data.title}` }],
      structuredContent: { task: data },
    };
  },
});
