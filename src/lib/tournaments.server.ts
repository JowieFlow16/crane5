// Server-only helpers for Crane5 tournaments.
import { z } from "zod";

export interface TournamentQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  topic?: string;
}

const questionSchema = z.object({
  question: z.string().min(3),
  options: z.array(z.string()).min(2),
  answer: z.string().min(1),
  explanation: z.string().optional(),
  topic: z.string().optional(),
});

const payloadSchema = z.object({ questions: z.array(questionSchema).min(1) });

/** Generate fast, NCDC-flavoured multiple-choice items for a tournament round. */
export async function generateTournamentQuestions(opts: {
  userId: string;
  subject: string;
  topic?: string;
  classLevel?: string;
  difficulty: string;
  count: number;
}): Promise<TournamentQuestion[]> {
  const { callAI, parseJsonResponse } = await import("./ai-gateway.server");
  const { NCDC_PERSONA, NCDC_NOTATION } = await import("./ncdc-framework");

  const raw = await callAI({
    json: true,
    task: "QUIZ_GENERATION",
    userId: opts.userId,
    subject: opts.subject,
    messages: [
      {
        role: "system",
        content: `${NCDC_PERSONA}\n\nYou set fast-paced competition questions for a national timed tournament.${NCDC_NOTATION}`,
      },
      {
        role: "user",
        content: `Set ${opts.count} ${opts.difficulty} multiple-choice tournament questions on ${opts.subject}${
          opts.topic ? ` (topic: ${opts.topic})` : ""
        }${opts.classLevel ? ` for Ugandan ${opts.classLevel} learners` : ""}.

Rules:
- Each question must be answerable in under 30 seconds but still require real thinking.
- Use Ugandan real-life contexts where natural.
- Exactly 4 distinct options; exactly one is correct.
- "answer" must be the full text of the correct option.
- Use correct symbols and notation (×, ÷, ², √, °C, etc.).

Return ONLY valid JSON: {"questions":[{"question":"…","options":["a","b","c","d"],"answer":"…","explanation":"why","topic":"sub-topic"}]}`,
      },
    ],
  });

  const parsed = payloadSchema.parse(parseJsonResponse<unknown>(raw));
  return parsed.questions.map((q) => ({
    ...q,
    // Guarantee the answer is one of the options.
    answer: q.options.includes(q.answer) ? q.answer : (q.options[0] as string),
  }));
}

/** Rank + reward every tournament whose window has closed. Safe to call often. */
export async function finalizeDueTournaments() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tournaments" as never)
    .select("id")
    .lte("ends_at", new Date().toISOString())
    .is("finalized_at", null)
    .limit(20);

  const due = (data ?? []) as unknown as { id: string }[];
  for (const t of due) {
    const { error } = await supabaseAdmin.rpc("finalize_tournament" as never, {
      p_tournament_id: t.id,
    } as never);
    if (error) console.error("[tournaments] finalize failed:", error.message);
  }
  return due.length;
}
