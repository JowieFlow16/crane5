import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface TournamentRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  subject: string | null;
  class_level: string | null;
  difficulty: string;
  seconds_per_question: number;
  prize_credits: number;
  prize_xp: number;
  winners_count: number;
  starts_at: string;
  ends_at: string;
  published: boolean;
  finalized_at: string | null;
  question_count: number;
  players: number;
  my_score: number | null;
  my_rank: number | null;
  status: "pending" | "live" | "ended";
}

export interface StandingRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  class_level: string | null;
  score: number;
  total: number;
  time_ms: number;
  rank: number | null;
  awarded_credits: number;
}

/** Every tournament a student can see, with live status and their own result. */
export const listTournaments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TournamentRow[]> => {
    const { finalizeDueTournaments } = await import("./tournaments.server");
    await finalizeDueTournaments();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId as string;

    const { data: rows } = await supabaseAdmin
      .from("tournaments" as never)
      .select("*")
      .eq("published", true)
      .order("starts_at", { ascending: false })
      .limit(50);

    const tournaments = (rows ?? []) as unknown as (Omit<
      TournamentRow,
      "question_count" | "players" | "my_score" | "my_rank" | "status"
    > & { questions: unknown[] })[];
    if (tournaments.length === 0) return [];

    const ids = tournaments.map((t) => t.id);
    const { data: entries } = await supabaseAdmin
      .from("tournament_entries" as never)
      .select("tournament_id, user_id, score, rank")
      .in("tournament_id", ids);

    const all = (entries ?? []) as unknown as {
      tournament_id: string;
      user_id: string;
      score: number;
      rank: number | null;
    }[];

    const now = Date.now();
    return tournaments.map((t) => {
      const mine = all.find((e) => e.tournament_id === t.id && e.user_id === userId);
      const status: TournamentRow["status"] =
        new Date(t.starts_at).getTime() > now
          ? "pending"
          : new Date(t.ends_at).getTime() < now
            ? "ended"
            : "live";
      return {
        ...t,
        question_count: Array.isArray(t.questions) ? t.questions.length : 0,
        players: all.filter((e) => e.tournament_id === t.id).length,
        my_score: mine?.score ?? null,
        my_rank: mine?.rank ?? null,
        status,
      } as TournamentRow;
    });
  });

/** Questions for a live tournament (answers stripped) plus its standings. */
export const getTournamentRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("tournaments" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Tournament not found");

    const t = row as unknown as {
      id: string;
      title: string;
      seconds_per_question: number;
      starts_at: string;
      ends_at: string;
      questions: { question: string; options: string[]; answer: string }[];
    };

    const now = Date.now();
    if (new Date(t.starts_at).getTime() > now) throw new Error("This tournament hasn't started yet");
    if (new Date(t.ends_at).getTime() < now) throw new Error("This tournament has ended");

    return {
      id: t.id,
      title: t.title,
      seconds_per_question: t.seconds_per_question,
      ends_at: t.ends_at,
      questions: (t.questions ?? []).map((q, i) => ({
        index: i,
        question: q.question,
        options: q.options,
      })),
    };
  });

/** Mark the student's answers server-side and store their result. */
export const submitTournamentAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        answers: z.array(z.string()),
        timeMs: z.number().int().min(0).max(24 * 3600 * 1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("tournaments" as never)
      .select("questions")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Tournament not found");

    const questions = ((row as unknown as { questions: { answer: string }[] }).questions ??
      []) as { answer: string }[];
    let score = 0;
    questions.forEach((q, i) => {
      if ((data.answers[i] ?? "").trim() === q.answer.trim()) score += 1;
    });

    const { error } = await context.supabase.rpc("submit_tournament_entry" as never, {
      p_tournament_id: data.id,
      p_score: score,
      p_total: questions.length,
      p_time_ms: data.timeMs,
    } as never);
    if (error) throw new Error(error.message);

    return { score, total: questions.length };
  });

/** Public standings for one tournament. */
export const getTournamentStandings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<StandingRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("tournament_entries" as never)
      .select("user_id, display_name, avatar_url, class_level, score, total, time_ms, rank, awarded_credits")
      .eq("tournament_id", data.id)
      .order("score", { ascending: false })
      .order("time_ms", { ascending: true })
      .limit(25);
    return (rows ?? []) as unknown as StandingRow[];
  });

/** Claim the daily +10 credit reward for sitting in the leaderboard top 5. */
export const claimTopRankBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_top_rank_bonus" as never);
    if (error) throw new Error(error.message);
    return data as unknown as {
      granted: boolean;
      rank: number | null;
      amount?: number;
      reason?: string;
    };
  });

/** Find other students to message, by name, school or class. */
export const searchStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, class_level, school")
      .or(`full_name.ilike.${like},school.ilike.${like}`)
      .neq("id", context.userId as string)
      .limit(12);
    return (rows ?? []).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      avatar_url: r.avatar_url,
      class_level: r.class_level as string | null,
      school: r.school,
    }));
  });

// ---------- Admin ----------

const adminInput = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  kind: z.enum(["quick_quiz", "fastest_learner", "subject_clash"]).default("quick_quiz"),
  subject: z.string().optional(),
  classLevel: z.string().optional(),
  topic: z.string().max(120).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  questionCount: z.number().int().min(3).max(20).default(8),
  secondsPerQuestion: z.number().int().min(10).max(180).default(30),
  prizeCredits: z.number().int().min(0).max(200).default(10),
  prizeXp: z.number().int().min(0).max(5000).default(100),
  winnersCount: z.number().int().min(1).max(20).default(5),
  startsAt: z.string(),
  endsAt: z.string(),
});

/** Create a tournament, generating its question set with AI (admin only). */
export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertTournamentAdmin } = await import("./tournaments-admin.server");
    await assertTournamentAdmin(context.supabase, context.userId as string);

    const { generateTournamentQuestions } = await import("./tournaments.server");
    const questions = await generateTournamentQuestions({
      userId: context.userId as string,
      subject: data.subject ?? "General Knowledge",
      topic: data.topic,
      classLevel: data.classLevel,
      difficulty: data.difficulty,
      count: data.questionCount,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin
      .from("tournaments" as never)
      .insert({
        title: data.title,
        description: data.description ?? null,
        kind: data.kind,
        subject: data.subject ?? null,
        class_level: data.classLevel ?? null,
        difficulty: data.difficulty,
        questions,
        seconds_per_question: data.secondsPerQuestion,
        prize_credits: data.prizeCredits,
        prize_xp: data.prizeXp,
        winners_count: data.winnersCount,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        published: true,
        created_by: context.userId as string,
      } as never)
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);
    return created as unknown as { id: string; title: string };
  });

/** Publish/unpublish or delete a tournament (admin only). */
export const manageTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["publish", "unpublish", "delete", "finalize", "end_now"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertTournamentAdmin } = await import("./tournaments-admin.server");
    await assertTournamentAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "delete") {
      const { error } = await supabaseAdmin.from("tournaments" as never).delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (data.action === "finalize" || data.action === "end_now") {
      if (data.action === "end_now") {
        const { error } = await supabaseAdmin
          .from("tournaments" as never)
          .update({ ends_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
          .eq("id", data.id);
        if (error) throw new Error(error.message);
      }
      const { data: res, error } = await supabaseAdmin.rpc("finalize_tournament" as never, {
        p_tournament_id: data.id,
      } as never);
      if (error) throw new Error(error.message);
      return (res ?? { ok: true }) as unknown as { ok: boolean; rewarded?: number };
    }

    const { error } = await supabaseAdmin
      .from("tournaments" as never)
      .update({
        published: data.action === "publish",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin view: every tournament including unpublished drafts. */
export const listTournamentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertTournamentAdmin } = await import("./tournaments-admin.server");
    await assertTournamentAdmin(context.supabase, context.userId as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("tournaments" as never)
      .select(
        "id, title, kind, subject, class_level, difficulty, prize_credits, winners_count, starts_at, ends_at, published, finalized_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as unknown as {
      id: string;
      title: string;
      kind: string;
      subject: string | null;
      class_level: string | null;
      difficulty: string;
      prize_credits: number;
      winners_count: number;
      starts_at: string;
      ends_at: string;
      published: boolean;
      finalized_at: string | null;
    }[];
  });
