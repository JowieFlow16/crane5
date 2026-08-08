import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_study_task",
  title: "Complete a study task",
  description: "Mark one of the signed-in learner's study planner tasks as done (or not done).",
  inputSchema: {
    taskId: z.string().trim().describe("The id of the study task."),
    done: z.boolean().optional().describe("Set false to reopen the task. Defaults to true."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ taskId, done }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (!taskId) return { content: [{ type: "text", text: "taskId is required" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("study_tasks")
      .update({ done: done ?? true })
      .eq("id", taskId)
      .select("id, title, done")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Task not found" }], isError: true };
    return {
      content: [{ type: "text", text: `${data.title} → ${data.done ? "done" : "reopened"}` }],
      structuredContent: { task: data },
    };
  },
});
