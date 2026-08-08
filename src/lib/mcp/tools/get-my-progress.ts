import { defineTool } from "@lovable.dev/mcp-js";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_progress",
  title: "Get my learning progress",
  description:
    "Get the signed-in learner's XP, level, streaks, per-subject mastery and recent quiz scores.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [stats, progress, quizzes] = await Promise.all([
      supabase
        .from("user_stats")
        .select("xp, level, current_streak, longest_streak, last_active")
        .eq("user_id", ctx.getUserId()!)
        .maybeSingle(),
      supabase
        .from("progress")
        .select("subject, topic, mastery, attempts, last_studied")
        .order("last_studied", { ascending: false })
        .limit(50),
      supabase
        .from("quiz_results")
        .select("subject, topic, score, total, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const error = stats.error ?? progress.error ?? quizzes.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const payload = {
      stats: stats.data ?? { xp: 0, level: 1, current_streak: 0, longest_streak: 0 },
      progress: progress.data ?? [],
      recentQuizzes: quizzes.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
