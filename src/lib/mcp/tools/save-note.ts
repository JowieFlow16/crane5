import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "save_note",
  title: "Save a note",
  description: "Save a study note to the signed-in learner's Crane5 saved items.",
  inputSchema: {
    title: z.string().trim().optional().describe("Short title for the note."),
    content: z.string().trim().describe("The note body, markdown allowed."),
    subject: z.string().trim().optional().describe("Subject name, e.g. Biology."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, subject }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (!content)
      return { content: [{ type: "text", text: "content is required" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: ctx.getUserId()!,
        kind: "note",
        title: title ?? null,
        content,
        subject: subject ?? null,
      })
      .select("id, title, subject")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved note${data.title ? `: ${data.title}` : ""}` }],
      structuredContent: { note: data },
    };
  },
});
