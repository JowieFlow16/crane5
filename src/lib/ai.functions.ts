import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  NCDC_PERSONA,
  NCDC_NOTATION,
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

/** A user-supplied attachment (image or document) as a base64 data URL. */
const attachmentSchema = z.object({
  name: z.string().max(200),
  mimeType: z.string().max(120),
  /** data:<mime>;base64,... */
  dataUrl: z.string().max(14_000_000),
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
        attachments: z.array(attachmentSchema).max(5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { guardAiRequest, validateUserMessage, trimConversation } = await import(
      "./ai/abuse.server"
    );
    const { classifyTask } = await import("./ai/models.server");

    const lastUserRaw = [...data.messages].reverse().find((m) => m.role === "user");
    guardAiRequest(context.userId as string, lastUserRaw?.content ?? "");
    if (lastUserRaw) lastUserRaw.content = validateUserMessage(lastUserRaw.content);

    const { withAiQuota } = await import("./ai-usage.server");
    return withAiQuota(context.userId as string, "request", async () => {
      const { callAI } = await import("./ai-gateway.server");
      type ContentPart =
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "file"; file: { filename: string; file_data: string } };

      // ---- RAG: pull relevant learned material (documents, links, videos) ----
      const { retrieveKnowledge } = await import("./knowledge-context.server");
      const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
      const { docs, context: curriculumContext } = await retrieveKnowledge({
        query: typeof lastUser?.content === "string" ? lastUser.content : "",
        subject: data.subject,
        classLevel: data.classLevel,
        limit: 4,
        charsPerDoc: 2500,
      });

      const hasAttachments = (data.attachments?.length ?? 0) > 0;
      const system =
        NCDC_PERSONA +
        NCDC_FRAMEWORK_BLOCK +
        (data.subject ? `\n\nCurrent subject focus: ${data.subject}.` : "") +
        (data.classLevel
          ? `\n\nThe learner is in ${data.classLevel}. Pitch depth, vocabulary and examples to this level.`
          : "") +
        (hasAttachments
          ? "\n\nThe learner has attached one or more files (images and/or documents). Carefully read, analyse and use EVERY attachment to answer their prompt: transcribe relevant text, interpret diagrams/photos, solve questions shown, mark their work, or extract data as the prompt requires. Reference what you see specifically. If an attachment is unclear or unreadable, say so politely."
          : "") +
        curriculumContext;

      // Attach files to the most recent user message as multimodal parts.
      const outgoing: { role: "user" | "assistant"; content: string | ContentPart[] }[] = [
        ...trimConversation(data.messages),
      ];
      if (hasAttachments) {
        let lastUserIdx = -1;
        for (let i = outgoing.length - 1; i >= 0; i--) {
          if (outgoing[i].role === "user") {
            lastUserIdx = i;
            break;
          }
        }
        if (lastUserIdx >= 0) {
          const original = outgoing[lastUserIdx];
          const textContent = typeof original.content === "string" ? original.content : "";
          const parts: ContentPart[] = [
            { type: "text", text: textContent || "Please analyse the attached file(s)." },
          ];
          for (const a of data.attachments!) {
            if (a.mimeType.startsWith("image/")) {
              parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
            } else {
              parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
            }
          }
          outgoing[lastUserIdx] = { role: "user", content: parts };
        }
      }

      // Never let a provider hiccup surface as a server crash — reply in-chat
      // with a calm, human message instead.
      try {
        const content = await callAI({
          messages: [{ role: "system", content: system }, ...outgoing],
          task: classifyTask({
            subject: data.subject,
            text: typeof lastUser?.content === "string" ? lastUser.content : "",
          }),
          capability: hasAttachments ? "vision" : undefined,
          userId: context.userId as string,
          subject: data.subject,
        });
        return { content, usedSources: docs?.map((d) => d.name) ?? [] };
      } catch {
        return {
          content:
            "I couldn't reach my brain for that one 😅 — the AI service is busy right now. Please send your question again in a moment.",
          usedSources: [],
        };
      }
    });
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

const quizQuestionSchema = z.object({
  question: z.string().min(1),
  type: z.enum(["mcq", "short"]).catch("short"),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  explanation: z.string().default(""),
  topic: z.string().default("General"),
  scenario: z.string().optional(),
  competency: z.string().optional(),
});

const quizPayloadSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1),
});

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
    const { withAiQuota } = await import("./ai-usage.server");
    return withAiQuota(context.userId as string, "request", async () => {
      const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

      const { retrieveKnowledge } = await import("./knowledge-context.server");
      const { context: ref } = await retrieveKnowledge({
        query: `${data.subject} ${data.topic ?? ""}`,
        subject: data.subject,
        limit: 3,
        charsPerDoc: 2000,
      });

      const typeInstruction =
        data.quizType === "MCQ"
          ? 'All questions must be "mcq" with 4 plausible options.'
          : data.quizType === "Short Answer"
            ? 'All questions must be "short" (no options) — NCDC short-response items.'
            : "Mix of mcq (4 options) and short-response items.";

      const raw = await callAI({
        json: true,
        task: "QUIZ_GENERATION",
        userId: context.userId as string,
        subject: data.subject,
        messages: [
          {
            role: "system",
            content: `${NCDC_PERSONA}\n\nYou are setting assessment ITEMS exactly the way NCDC sets them.${NCDC_COMPETENCY_LEVELS}${NCDC_ITEM_FRAMEWORK}${NCDC_SUBJECT_CONSTRUCTS}${NCDC_VISUAL_OUTPUT}${NCDC_NOTATION}`,
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

      const parsed = parseJsonResponse<unknown>(raw);
      // Structured-output contract: never hand the UI a malformed quiz.
      return quizPayloadSchema.parse(parsed);
    });
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
    const { withAiQuota } = await import("./ai-usage.server");
    return withAiQuota(context.userId as string, "request", async () => {
      const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

      const { retrieveKnowledge } = await import("./knowledge-context.server");
      const { context: ref } = await retrieveKnowledge({
        query: `${data.subject} ${data.topic}`,
        subject: data.subject,
        limit: 3,
        charsPerDoc: 2200,
      });

      const raw = await callAI({
        json: true,
        task: "REVISION",
        userId: context.userId as string,
        subject: data.subject,
        messages: [
          {
            role: "system",
            content: `${NCDC_PERSONA}${NCDC_COMPETENCY_LEVELS}${NCDC_ITEM_FRAMEWORK}${NCDC_ANSWERING_APPROACH}${NCDC_VISUAL_OUTPUT}${NCDC_NOTATION}`,
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
  .handler(async ({ data, context }) => {
    const { withAiQuota } = await import("./ai-usage.server");
    return withAiQuota(context.userId as string, "request", async () => {
      const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

      const raw = await callAI({
        json: true,
        task: "REVISION",
        userId: context.userId as string,
        subject: data.subject,
        messages: [
          {
            role: "system",
            content: `${NCDC_PERSONA}${NCDC_ANSWERING_APPROACH}${NCDC_NOTATION}`,
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
  .handler(async ({ data, context }) => {
    const { withAiQuota } = await import("./ai-usage.server");
    return withAiQuota(context.userId as string, "image", async () => {
      const { generateImageAI } = await import("./ai-gateway.server");
      const styled = `Educational, clearly labelled illustration for a Ugandan secondary school ${
        data.subject ? `${data.subject} ` : ""
      }student. Clean, accurate, textbook-style diagram with readable labels and a light background. Subject: ${data.prompt}`;
      const url = await generateImageAI(styled);
      return { url };
    });
  });

// ============================================================================
// Direct Messaging — start / fetch a conversation between two users
// ============================================================================
export const getOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ otherUserId: z.string().uuid() }).parse(input))
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

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", [lo, hi]);
    const profOf = (id: string) =>
      (profs ?? []).find((p) => p.id === id) as
        | { full_name: string | null; avatar_url: string | null }
        | undefined;
    const roleOf = (_id: string) => "student";

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

// ---- AI quiz marking (structured output) ----
export interface MarkedAnswer {
  index: number;
  correct: boolean;
  awarded: number;
  feedback: string;
}

export interface QuizMarking {
  score: number;
  total: number;
  percentage: number;
  results: MarkedAnswer[];
  weakAreas: string[];
  recommendations: string[];
  summary: string;
}

const markingSchema = z.object({
  results: z
    .array(
      z.object({
        index: z.number(),
        correct: z.boolean(),
        awarded: z.number().min(0).max(1).default(0),
        feedback: z.string().default(""),
      }),
    )
    .default([]),
  weakAreas: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  summary: z.string().default(""),
});

export const markQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string(),
        topic: z.string().optional(),
        items: z
          .array(
            z.object({
              question: z.string().max(4000),
              type: z.enum(["mcq", "short"]),
              expected: z.string().max(2000),
              given: z.string().max(4000),
              topic: z.string().max(200).optional(),
            }),
          )
          .min(1)
          .max(15),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { guardAiRequest } = await import("./ai/abuse.server");
    guardAiRequest(context.userId as string);

    const { withAiQuota } = await import("./ai-usage.server");
    return withAiQuota(context.userId as string, "request", async (): Promise<QuizMarking> => {
      const { callAI, parseJsonResponse } = await import("./ai-gateway.server");

      const raw = await callAI({
        json: true,
        task: "QUIZ_MARKING",
        userId: context.userId as string,
        subject: data.subject,
        messages: [
          {
            role: "system",
            content: `${NCDC_PERSONA}\n\nYou are marking a learner's quiz exactly like an NCDC examiner using a scoring guide.${NCDC_COMPETENCY_LEVELS}${NCDC_NOTATION}\n\nMarking rules:\n- Mark on MEANING, not exact wording. Accept correct answers phrased differently, with spelling slips, or with equivalent units/forms.\n- A blank answer is always wrong.\n- Feedback must be one or two encouraging sentences telling the learner exactly what to fix.\n- Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Subject: ${data.subject}${data.topic ? ` — topic: ${data.topic}` : ""}\n\nMark these answers:\n${data.items
              .map(
                (it, i) =>
                  `#${i}\nQuestion: ${it.question}\nExpected answer: ${it.expected}\nLearner answered: ${it.given || "(no answer)"}`,
              )
              .join("\n\n")}\n\nReturn JSON exactly: {"results":[{"index":0,"correct":true,"awarded":1,"feedback":"..."}],"weakAreas":["sub-topic"],"recommendations":["what to revise next"],"summary":"two-sentence overall comment"}`,
          },
        ],
      });

      const parsed = markingSchema.parse(parseJsonResponse<unknown>(raw));
      const results: MarkedAnswer[] = data.items.map((it, i) => {
        const r = parsed.results.find((x) => x.index === i);
        return {
          index: i,
          correct: r?.correct ?? false,
          awarded: r?.correct ? 1 : (r?.awarded ?? 0),
          feedback: r?.feedback ?? "",
        };
      });
      const score = results.filter((r) => r.correct).length;
      const weak = parsed.weakAreas.length
        ? parsed.weakAreas
        : Array.from(
            new Set(
              results.filter((r) => !r.correct).map((r) => data.items[r.index]?.topic ?? "General"),
            ),
          );

      return {
        score,
        total: data.items.length,
        percentage: Math.round((score / data.items.length) * 100),
        results,
        weakAreas: weak,
        recommendations: parsed.recommendations,
        summary: parsed.summary,
      };
    });
  });

// ---- Personal revision timetable generator ----
export interface TimetablePlanSlot {
  day: number;
  start: string;
  end: string;
  subject: string;
  topic: string;
  activity: string;
}

const timetableSchema = z.object({
  slots: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        start: z.string().max(8),
        end: z.string().max(8),
        subject: z.string().max(120),
        topic: z.string().max(200).default(""),
        activity: z.string().max(80).default("Revision"),
      }),
    )
    .default([]),
  advice: z.string().default(""),
});

export const generateTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subjects: z.array(z.string().max(120)).min(1).max(20),
        classLevel: z.string().max(10).default("S4"),
        studyDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        startHour: z.number().int().min(4).max(22).default(17),
        endHour: z.number().int().min(5).max(23).default(21),
        sessionMinutes: z.number().int().min(30).max(120).default(45),
        weakSubjects: z.array(z.string().max(120)).max(20).default([]),
        goal: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { guardAiRequest } = await import("./ai/abuse.server");
    guardAiRequest(context.userId as string);
    const { withAiQuota } = await import("./ai-usage.server");

    return withAiQuota(context.userId as string, "request", async () => {
      const { callAI, parseJsonResponse } = await import("./ai-gateway.server");
      const raw = await callAI({
        json: true,
        task: "STUDY_PLAN",
        userId: context.userId as string,
        messages: [
          {
            role: "system",
            content: `${NCDC_PERSONA}\n\nYou build realistic personal revision timetables for Ugandan secondary students. Respect boarding-school routines, prep time and rest. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Build a weekly revision timetable for a ${data.classLevel} learner.
Subjects: ${data.subjects.join(", ")}
${data.weakSubjects.length ? `Needs extra time on: ${data.weakSubjects.join(", ")}` : ""}
Study days (0=Sunday…6=Saturday): ${data.studyDays.join(", ")}
Daily window: ${data.startHour}:00 to ${data.endHour}:00, sessions of ${data.sessionMinutes} minutes with short breaks between them.
${data.goal ? `Learner's goal: ${data.goal}` : ""}
Rules:
- Cover EVERY subject across the week; give weak subjects roughly double the slots.
- Rotate activity types: "Notes", "Past paper", "Practice questions", "Flashcards", "Group discussion", "Recap".
- Give each slot a specific NCDC topic for that subject and class.
- Never overlap slots, never exceed the daily window, and leave at least one lighter day.
Return JSON exactly: {"slots":[{"day":1,"start":"17:00","end":"17:45","subject":"Physics","topic":"Moments and levers","activity":"Practice questions"}],"advice":"two-sentence coaching note"}`,
          },
        ],
      });
      const parsed = timetableSchema.parse(parseJsonResponse<unknown>(raw));
      return parsed;
    });
  });

// ---- Scenario generator (NCDC situational learning) ----
export interface GeneratedScenario {
  title: string;
  scenario: string;
  tasks: string[];
  competencies: string[];
  markingGuide: string[];
  extension: string;
}

const scenarioSchema = z.object({
  title: z.string().default("Scenario"),
  scenario: z.string().default(""),
  tasks: z.array(z.string()).default([]),
  competencies: z.array(z.string()).default([]),
  markingGuide: z.array(z.string()).default([]),
  extension: z.string().default(""),
});

export const generateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().max(120),
        topic: z.string().min(1).max(200),
        classLevel: z.string().max(10).default("S4"),
        context: z.string().max(300).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { guardAiRequest } = await import("./ai/abuse.server");
    guardAiRequest(context.userId as string, data.topic);
    const { withAiQuota } = await import("./ai-usage.server");

    return withAiQuota(context.userId as string, "request", async (): Promise<GeneratedScenario> => {
      const { callAI, parseJsonResponse } = await import("./ai-gateway.server");
      const { retrieveKnowledge } = await import("./knowledge-context.server");
      const { context: ref } = await retrieveKnowledge({
        query: `${data.subject} ${data.topic}`,
        subject: data.subject,
        limit: 3,
        charsPerDoc: 1800,
      });

      const raw = await callAI({
        json: true,
        task: "REVISION",
        userId: context.userId as string,
        subject: data.subject,
        messages: [
          {
            role: "system",
            content: `${NCDC_PERSONA}${NCDC_ITEM_FRAMEWORK}${NCDC_COMPETENCY_LEVELS}${NCDC_SUBJECT_CONSTRUCTS}${NCDC_ANSWERING_APPROACH}${NCDC_VISUAL_OUTPUT}${NCDC_NOTATION}\n\nYou write authentic Ugandan situational (scenario-based) learning items. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Write a ${data.difficulty} situational learning scenario for ${data.subject} — topic "${data.topic}" at ${data.classLevel}.${
              data.context ? ` Set it in this context: ${data.context}.` : ""
            }
Rules:
- The scenario is a real Ugandan situation (market in Owino, a Nile-side farm, a boda business, a school science club, a Kampala clinic…) written in 120–200 words with real data the learner must use.
- "tasks" are 3–5 graded demands moving from understanding → application → evaluation, each tagged with its competency level (CK/CU/AP/UE).
- Use Markdown, LaTeX for any maths, tables for data, and a \`\`\`mermaid diagram when a process is involved.
- "markingGuide" gives the expected answer points per task.
Return JSON exactly: {"title":"…","scenario":"markdown","tasks":["AP — …"],"competencies":["…"],"markingGuide":["Task 1: …"],"extension":"one harder follow-up challenge"}${ref}`,
          },
        ],
      });
      return scenarioSchema.parse(parseJsonResponse<unknown>(raw)) as GeneratedScenario;
    });
  });
