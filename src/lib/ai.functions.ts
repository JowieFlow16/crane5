import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NCDC_PERSONA = `You are Omicron AI, a warm, encouraging AI tutor for Ugandan secondary school students following the NCDC (National Curriculum Development Centre) curriculum.

Rules:
- Follow the Ugandan NCDC curriculum closely. Use East African / Ugandan examples (e.g. matooke, Lake Victoria, the shilling, boda-bodas, local towns) where helpful.
- Explain step by step in clear, age-appropriate language. Encourage critical thinking with gentle follow-up questions.
- Be supportive and motivating — celebrate effort, never demean. Use a friendly, Gen-Z-friendly but respectful tone.
- When curriculum reference material is provided below, ALWAYS prioritise it and ground your answer in it. Do not invent facts beyond the curriculum when relevant material is present.
- Use markdown: short paragraphs, **bold** key terms, bullet lists, and numbered steps for working.`;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

// ---- AI Tutor chat ----
export const chatTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z.array(chatMessageSchema).min(1),
        subject: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callAI } = await import("./ai-gateway.server");

    // ---- RAG: pull relevant curriculum documents ----
    let curriculumContext = "";
    let query = context.supabase
      .from("documents")
      .select("name, subject, content_text")
      .not("content_text", "is", null)
      .limit(4);
    if (data.subject) query = query.ilike("subject", `%${data.subject}%`);
    const { data: docs } = await query;

    if (docs && docs.length > 0) {
      curriculumContext =
        "\n\n=== CURRICULUM REFERENCE MATERIAL (ground your answer in this) ===\n" +
        docs
          .map(
            (d) =>
              `# ${d.name}${d.subject ? ` (${d.subject})` : ""}\n${(d.content_text ?? "").slice(0, 2500)}`,
          )
          .join("\n\n");
    }

    const system =
      NCDC_PERSONA +
      (data.subject ? `\n\nCurrent subject focus: ${data.subject}.` : "") +
      curriculumContext;

    const content = await callAI({
      messages: [{ role: "system", content: system }, ...data.messages],
      model: "google/gemini-2.5-flash",
    });

    return { content, usedSources: docs?.map((d) => d.name) ?? [] };
  });

// ---- Quiz generation ----
export interface QuizQuestion {
  question: string;
  type: "mcq" | "short";
  options?: string[];
  answer: string;
  explanation: string;
  topic: string;
}

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string(),
        topic: z.string().optional(),
        difficulty: z.enum(["Easy", "Medium", "Hard"]),
        quizType: z.enum(["MCQ", "Short Answer", "Mixed"]),
        count: z.number().min(3).max(15).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

    const { data: docs } = await context.supabase
      .from("documents")
      .select("name, content_text")
      .ilike("subject", `%${data.subject}%`)
      .not("content_text", "is", null)
      .limit(3);

    const ref =
      docs && docs.length
        ? "\n\nGround questions in this curriculum material:\n" +
          docs.map((d) => (d.content_text ?? "").slice(0, 2000)).join("\n---\n")
        : "";

    const typeInstruction =
      data.quizType === "MCQ"
        ? 'All questions must be "mcq" with 4 options.'
        : data.quizType === "Short Answer"
          ? 'All questions must be "short" (no options).'
          : "Mix of mcq (4 options) and short questions.";

    const raw = await callAI({
      json: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You generate quizzes for Ugandan NCDC secondary students. ${NCDC_PERSONA}`,
        },
        {
          role: "user",
          content: `Create ${data.count} ${data.difficulty} difficulty questions on ${data.subject}${
            data.topic ? ` (topic: ${data.topic})` : ""
          }. ${typeInstruction}
Return ONLY valid JSON of this exact shape:
{"questions":[{"question":"...","type":"mcq"|"short","options":["a","b","c","d"],"answer":"the correct option text or short answer","explanation":"why","topic":"specific sub-topic"}]}
For "short" questions omit the options field.${ref}`,
        },
      ],
    });

    const parsed = parseJsonResponse<{ questions: QuizQuestion[] }>(raw);
    return parsed;
  });

// ---- Revision generator ----
export const generateRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string(),
        topic: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

    const { data: docs } = await context.supabase
      .from("documents")
      .select("content_text")
      .ilike("subject", `%${data.subject}%`)
      .not("content_text", "is", null)
      .limit(3);

    const ref =
      docs && docs.length
        ? "\n\nUse this curriculum material:\n" +
          docs.map((d) => (d.content_text ?? "").slice(0, 2200)).join("\n---\n")
        : "";

    const raw = await callAI({
      json: true,
      messages: [
        { role: "system", content: NCDC_PERSONA },
        {
          role: "user",
          content: `Create revision material for ${data.subject} — topic "${data.topic}" (Ugandan NCDC).
Return ONLY valid JSON:
{"summary":"2-3 sentence overview","notes":["concise revision note in markdown", "..."],"keyConcepts":["term: short definition", "..."],"likelyQuestions":["likely exam question", "..."]}
Provide 5-7 notes, 5-8 keyConcepts, and 5 likelyQuestions.${ref}`,
        },
      ],
    });

    return parseJsonResponse<{
      summary: string;
      notes: string[];
      keyConcepts: string[];
      likelyQuestions: string[];
    }>(raw);
  });
