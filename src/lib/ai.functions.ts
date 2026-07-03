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
  NCDC_VISUAL_OUTPUT,
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
        classLevel: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callAI } = await import("./ai-gateway.server");

    // ---- RAG: pull relevant curriculum documents (privileged server-side read) ----
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let curriculumContext = "";
    let query = supabaseAdmin
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
      (data.classLevel
        ? `\n\nThe learner is in ${data.classLevel}. Pitch depth, vocabulary and examples to this level.`
        : "") +
      curriculumContext;


    const content = await callAI({
      messages: [{ role: "system", content: system }, ...data.messages],
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: docs } = await supabaseAdmin
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
          content: `${NCDC_PERSONA}\n\nYou are setting assessment ITEMS exactly the way NCDC sets them.${NCDC_COMPETENCY_LEVELS}${NCDC_ITEM_FRAMEWORK}${NCDC_SUBJECT_CONSTRUCTS}${NCDC_VISUAL_OUTPUT}`,
        },
        {
          role: "user",
          content: `Set ${data.count} ${data.difficulty} difficulty NCDC competency-based assessment items on ${data.subject}${
            data.topic ? ` (topic: ${data.topic})` : ""
          }. ${typeInstruction}

NCDC item rules you MUST follow:
- Build EVERY item around an authentic Ugandan real-life scenario/context (a farmer, market, swamp, school trip, household, boda-boda, Rolex stand, local town, etc.). Put that situation in the "scenario" field and reference it in the "question".
- Each item must demand higher-order thinking (apply/analyse/evaluate), NOT pure recall.
- Tag each item with its competency LEVEL (CK, CU, AP or UE) AND the Learning Outcome it assesses, in the "competency" field (e.g. "AP — applies area & perimeter to a real garden").
- Across the set, deliberately progress from CK/CU toward AP/UE.
- "explanation" must justify the correct answer step by step like an NCDC scoring guide, with the reasoning a learner can follow, and may include a short real-life note.

Return ONLY valid JSON of this exact shape:
{"questions":[{"scenario":"the real-life Ugandan context","question":"the task built on the scenario","type":"mcq"|"short","options":["a","b","c","d"],"answer":"correct option text or model short answer","explanation":"NCDC-style scoring reasoning","topic":"specific sub-topic","competency":"LEVEL — the LO assessed"}]}
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: docs } = await supabaseAdmin
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
          content: `${NCDC_PERSONA}${NCDC_COMPETENCY_LEVELS}${NCDC_ITEM_FRAMEWORK}${NCDC_ANSWERING_APPROACH}${NCDC_VISUAL_OUTPUT}`,
        },
        {
          role: "user",
          content: `Create revision material for ${data.subject} — topic "${data.topic}" (Ugandan NCDC competency-based curriculum).
Rules:
- "notes" must be clear and simple, each with a live Ugandan example and the REASON ("why"), in markdown. Make them VISUAL: include at least ONE Mermaid diagram (in a \\\`\\\`\\\`mermaid fence) for any process/cycle/structure, use Markdown tables for comparisons or data, and write any maths/formulae in LaTeX ($inline$ or $$block$$). Where helpful, embed a reference link as proper markdown with the FULL https:// URL.
- "keyConcepts" are "term: short plain-language definition".
- "likelyQuestions" must be true NCDC-style assessment items: each built on an authentic Ugandan scenario, demanding application/analysis (mix short-response and extended/situational), tagged with its competency level (CK/CU/AP/UE). NOT recall.
- "references" are 2–4 trustworthy study resources as markdown links with FULL https:// URLs. Include at least ONE YouTube link (a real video or a https://www.youtube.com/results?search_query=... search) so it renders as a video card, plus the NCDC resource page https://ncdc.go.ug/resource/, Khan Academy, or a named textbook. Never invent a URL you are unsure of — prefer a search link.
Return ONLY valid JSON:
{"summary":"2-3 sentence overview","notes":["markdown note", "..."],"keyConcepts":["term: definition", "..."],"likelyQuestions":["LEVEL — scenario-based NCDC item", "..."],"references":["[Resource name](https://...)", "..."]}
Provide 5-7 notes, 5-8 keyConcepts, 5 likelyQuestions and 2-4 references.${ref}`,
        },
      ],
    });

    return parseJsonResponse<{
      summary: string;
      notes: string[];
      keyConcepts: string[];
      likelyQuestions: string[];
      references?: string[];
    }>(raw);
  });

// ---- Flashcard generation ----
export interface Flashcard {
  front: string;
  back: string;
}

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string(),
        topic: z.string().min(1),
        count: z.number().min(4).max(20).default(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

    const raw = await callAI({
      json: true,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `${NCDC_PERSONA}${NCDC_ANSWERING_APPROACH}`,
        },
        {
          role: "user",
          content: `Create ${data.count} study flashcards for ${data.subject} — topic "${data.topic}" (Uganda NCDC competency-based curriculum).
Rules:
- "front" is a short prompt/question or a key term.
- "back" is a clear, simple, correct answer a Ugandan secondary student understands, with a tiny live example where useful. Keep it concise (1-3 sentences). You may use simple inline LaTeX ($...$) for formulae.
- Cover the most important, exam-relevant points; progress from basic recall to application.
Return ONLY valid JSON: {"cards":[{"front":"...","back":"..."}]}`,
        },
      ],
    });

    return parseJsonResponse<{ cards: Flashcard[] }>(raw);
  });

// ---- AI image / diagram generation (visual research support) ----
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        prompt: z.string().min(3).max(500),
        subject: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { generateImageAI } = await import("./ai-gateway.server");
    const styled = `Educational, clearly labelled illustration for a Ugandan secondary school ${
      data.subject ? `${data.subject} ` : ""
    }student. Clean, accurate, textbook-style diagram with readable labels and a light background. Subject: ${data.prompt}`;
    const url = await generateImageAI(styled);
    return { url };
  });

// ============================================================================
// Direct Messaging — start / fetch a conversation between two users
// ============================================================================
export const getOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ otherUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = context.userId as string;
    const other = data.otherUserId;
    if (me === other) throw new Error("You cannot message yourself.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [lo, hi] = me < other ? [me, other] : [other, me];

    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("user_lo", lo)
      .eq("user_hi", hi)
      .maybeSingle();
    if (existing) return existing;

    const [{ data: profs }, { data: roleRows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", [lo, hi]),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", [lo, hi]),
    ]);
    const profOf = (id: string) =>
      (profs ?? []).find((p) => p.id === id) as
        | { full_name: string | null; avatar_url: string | null }
        | undefined;
    const roleOf = (id: string) =>
      (roleRows ?? []).some((r) => r.user_id === id && r.role === "teacher")
        ? "teacher"
        : "student";

    const { data: created, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        user_lo: lo,
        user_hi: hi,
        lo_name: profOf(lo)?.full_name ?? "User",
        lo_avatar: profOf(lo)?.avatar_url ?? null,
        lo_role: roleOf(lo),
        hi_name: profOf(hi)?.full_name ?? "User",
        hi_avatar: profOf(hi)?.avatar_url ?? null,
        hi_role: roleOf(hi),
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

// ============================================================================
// Teacher Copilot — AI tools exclusively for verified teachers
// ============================================================================

/** Lesson plan generator (NCDC competency-based). */
export const generateLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string(),
        topic: z.string().min(1),
        classLevel: z.string(),
        duration: z.string().default("80 minutes"),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { callAI } = await import("./ai-gateway.server");
    const { NCDC_TEACHER_PERSONA, NCDC_FRAMEWORK_BLOCK } = await import("./ncdc-framework");
    const content = await callAI({
      temperature: 0.6,
      messages: [
        { role: "system", content: NCDC_TEACHER_PERSONA + NCDC_FRAMEWORK_BLOCK },
        {
          role: "user",
          content: `Create a complete, classroom-ready NCDC lesson plan.
Subject: ${data.subject}
Topic: ${data.topic}
Class: ${data.classLevel}
Lesson duration: ${data.duration}
${data.notes ? `Teacher notes: ${data.notes}` : ""}

Return well-formatted Markdown with these sections:
1. **Lesson Overview** (topic, class, time, competency focus)
2. **Learning Outcome(s)** — split into Knowledge, Understanding, Skills, Values
3. **Generic skills & cross-cutting issues** addressed
4. **Materials / local resources** (realistic for a Ugandan school)
5. **Lesson sequence** in a Markdown table: | Phase | Time | Teacher activity | Learner activity | (Intro/Development/Conclusion) — use authentic Ugandan examples
6. **Differentiation** for mixed abilities
7. **Assessment** — 2 quick NCDC-style scenario items (tagged CK/CU/AP/UE) with a short marking guide
8. **Homework / extension**
Use LaTeX for any maths and a Mermaid diagram if a process helps.`,
        },
      ],
    });
    return { content };
  });

/** Exam / item builder that returns a ready-to-print paper + marking guide. */
export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string(),
        topic: z.string().optional(),
        classLevel: z.string(),
        count: z.number().min(2).max(15).default(6),
        difficulty: z.enum(["Easy", "Medium", "Hard", "Mixed"]).default("Mixed"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { callAI } = await import("./ai-gateway.server");
    const {
      NCDC_TEACHER_PERSONA,
      NCDC_COMPETENCY_LEVELS,
      NCDC_ITEM_FRAMEWORK,
      NCDC_SUBJECT_CONSTRUCTS,
    } = await import("./ncdc-framework");
    const content = await callAI({
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `${NCDC_TEACHER_PERSONA}${NCDC_COMPETENCY_LEVELS}${NCDC_ITEM_FRAMEWORK}${NCDC_SUBJECT_CONSTRUCTS}`,
        },
        {
          role: "user",
          content: `Set an NCDC ${data.difficulty} assessment paper with ${data.count} items.
Subject: ${data.subject}${data.topic ? `\nTopic: ${data.topic}` : ""}
Class: ${data.classLevel}

Return clean Markdown with two clearly separated parts:
## PART A — Question Paper
- A short header (Subject, Class, Time, Instructions).
- Number each item. Build EVERY item on an authentic Ugandan real-life scenario, then a task demanding higher-order thinking (apply/analyse/evaluate). Progress from CK/CU toward AP/UE. Show mark allocations, e.g. (04 marks).
## PART B — Marking Guide
- For each item: the competency level (CK/CU/AP/UE), expected response / model answer, and a RACE-based scoring scheme (Relevance, Accuracy, Coherence, Excellence) in a Markdown table.
Use LaTeX for maths.`,
        },
      ],
    });
    return { content };
  });

/** Draft a reply to a student's DM in the teacher's voice. */
export const draftReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        studentMessage: z.string().min(1).max(2000),
        subject: z.string().optional(),
        tone: z.enum(["Warm", "Concise", "Detailed"]).default("Warm"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { callAI } = await import("./ai-gateway.server");
    const { NCDC_TEACHER_PERSONA } = await import("./ncdc-framework");
    const content = await callAI({
      temperature: 0.6,
      messages: [
        { role: "system", content: NCDC_TEACHER_PERSONA },
        {
          role: "user",
          content: `A student sent this message${data.subject ? ` about ${data.subject}` : ""}:
"""${data.studentMessage}"""

Draft a ${data.tone.toLowerCase()}, encouraging reply I (the teacher) can send. Explain the concept simply and correctly with a live Ugandan example, and end with a small check-for-understanding question. Return ONLY the message text (no preamble), ready to send.`,
        },
      ],
    });
    return { content };
  });

/** Summarise recent student questions into class insights for a teacher. */
export const classInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z.array(z.string()).min(1).max(60),
        subjects: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { callAI } = await import("./ai-gateway.server");
    const { NCDC_TEACHER_PERSONA } = await import("./ncdc-framework");
    const content = await callAI({
      temperature: 0.5,
      messages: [
        { role: "system", content: NCDC_TEACHER_PERSONA },
        {
          role: "user",
          content: `Here are recent questions/messages students sent me${
            data.subjects?.length ? ` (I teach ${data.subjects.join(", ")})` : ""
          }:
${data.messages.map((m, i) => `${i + 1}. ${m}`).join("\n")}

Analyse them and return concise Markdown with:
- **Common struggles / misconceptions** (bullet list)
- **Priority topics to reteach** (ranked)
- **2 quick classroom actions** for tomorrow
- **1 NCDC scenario item** I can use to check the weakest area (with the competency level tagged).
Keep it practical and short.`,
        },
      ],
    });
    return { content };
  });


