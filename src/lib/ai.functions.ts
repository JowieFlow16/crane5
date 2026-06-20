import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  NCDC_PERSONA,
  NCDC_FRAMEWORK_BLOCK,
  NCDC_ITEM_FRAMEWORK,
  NCDC_SUBJECT_CONSTRUCTS,
  NCDC_COMPETENCY_LEVELS,
  NCDC_ANSWERING_APPROACH,
} from "./ncdc-framework";

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
      NCDC_FRAMEWORK_BLOCK +
      (data.subject ? `\n\nCurrent subject focus: ${data.subject}.` : "") +
      curriculumContext;

    const content = await callAI({
      messages: [{ role: "system", content: system }, ...data.messages],
      model: "google/gemini-2.5-flash",
    });

    return { content, usedSources: docs?.map((d) => d.name) ?? [] };
  });

// ---- Quiz generation (NCDC competency-based items) ----
export interface QuizQuestion {
  question: string;
  type: "mcq" | "short";
  options?: string[];
  answer: string;
  explanation: string;
  topic: string;
  /** Authentic Ugandan context/situation the item is built around (NCDC style). */
  scenario?: string;
  /** The competency / Learning Outcome the item assesses. */
  competency?: string;
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
        ? 'All questions must be "mcq" with 4 plausible options.'
        : data.quizType === "Short Answer"
          ? 'All questions must be "short" (no options) — NCDC short-response items.'
          : "Mix of mcq (4 options) and short-response items.";

    const raw = await callAI({
      json: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `${NCDC_PERSONA}\n\nYou are setting assessment ITEMS exactly the way NCDC sets them.${NCDC_ITEM_FRAMEWORK}${NCDC_SUBJECT_CONSTRUCTS}`,
        },
        {
          role: "user",
          content: `Set ${data.count} ${data.difficulty} difficulty NCDC competency-based assessment items on ${data.subject}${
            data.topic ? ` (topic: ${data.topic})` : ""
          }. ${typeInstruction}

NCDC item rules you MUST follow:
- Build EVERY item around an authentic Ugandan real-life scenario/context (a farmer, market, swamp, school trip, household, boda-boda, local town, etc.). Put that situation in the "scenario" field and reference it in the "question".
- Each item must demand higher-order thinking (apply/analyse/evaluate), NOT pure recall.
- Tag each item with the competency / Learning Outcome it assesses in the "competency" field.
- "explanation" must justify the correct answer step by step like an NCDC scoring guide.

Return ONLY valid JSON of this exact shape:
{"questions":[{"scenario":"the real-life Ugandan context","question":"the task built on the scenario","type":"mcq"|"short","options":["a","b","c","d"],"answer":"correct option text or model short answer","explanation":"NCDC-style scoring reasoning","topic":"specific sub-topic","competency":"the LO/competency assessed"}]}
For "short" items omit the options field.${ref}`,
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
        {
          role: "system",
          content: `${NCDC_PERSONA}${NCDC_ITEM_FRAMEWORK}`,
        },
        {
          role: "user",
          content: `Create revision material for ${data.subject} — topic "${data.topic}" (Ugandan NCDC competency-based curriculum).
Make "likelyQuestions" true NCDC-style assessment items: each must be built on an authentic Ugandan real-life scenario and demand application/analysis (mix short-response and extended/situational items), not recall.
Return ONLY valid JSON:
{"summary":"2-3 sentence overview","notes":["concise revision note in markdown", "..."],"keyConcepts":["term: short definition", "..."],"likelyQuestions":["scenario-based NCDC item", "..."]}
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
