// Server-only central AI model configuration + task routing policy.
//
// Crane5 runs on PAID OpenRouter models. Every model id lives here (never
// scattered through the app) and each one is env-overridable so an
// administrator can change models without touching application code.

/** Central model configuration — the single source of truth. */
export const AI_MODELS = {
  primary: process.env["AI_MODEL_PRIMARY"] ?? "openai/gpt-oss-120b",
  secondary: process.env["AI_MODEL_SECONDARY"] ?? "qwen/qwen3.5-122b-a10b",
  premium: process.env["AI_MODEL_PREMIUM"] ?? "anthropic/claude-sonnet-4.6",
  /** Multimodal-capable model used when the learner attaches images/files. */
  vision: process.env["AI_MODEL_VISION"] ?? "anthropic/claude-sonnet-4.6",
} as const;

export type TaskType =
  | "NORMAL_TUTORING"
  | "MATH"
  | "PHYSICS"
  | "CHEMISTRY"
  | "BIOLOGY"
  | "ENGLISH"
  | "QUIZ_GENERATION"
  | "QUIZ_MARKING"
  | "REVISION"
  | "STUDY_PLAN"
  | "CURRICULUM_GROUNDED"
  | "COMPLEX_REASONING"
  | "ADMIN_CONTENT";

export type ReasoningEffort = "low" | "medium" | "high";

export interface RoutePolicy {
  /** Ordered model chain: first entry is the model actually used. */
  models: string[];
  reasoning: ReasoningEffort;
  temperature: number;
}

const P = AI_MODELS.primary;
const S = AI_MODELS.secondary;
const X = AI_MODELS.premium;

/**
 * Explicit routing policy. Deterministic — the same task always routes the
 * same way, and the expensive escalation model is never used for ordinary
 * student questions.
 */
const POLICY: Record<TaskType, RoutePolicy> = {
  NORMAL_TUTORING: { models: [P, S], reasoning: "low", temperature: 0.6 },
  MATH: { models: [P, S], reasoning: "high", temperature: 0.2 },
  PHYSICS: { models: [P, S], reasoning: "high", temperature: 0.2 },
  CHEMISTRY: { models: [P, S], reasoning: "high", temperature: 0.3 },
  BIOLOGY: { models: [P, S], reasoning: "medium", temperature: 0.4 },
  ENGLISH: { models: [P, S], reasoning: "low", temperature: 0.6 },
  QUIZ_GENERATION: { models: [P, S], reasoning: "medium", temperature: 0.7 },
  QUIZ_MARKING: { models: [P, S], reasoning: "medium", temperature: 0.2 },
  REVISION: { models: [P, S], reasoning: "medium", temperature: 0.5 },
  STUDY_PLAN: { models: [P, S], reasoning: "low", temperature: 0.5 },
  CURRICULUM_GROUNDED: { models: [P, S], reasoning: "medium", temperature: 0.4 },
  // Hard questions try the primary model at high reasoning, then the
  // secondary, and only then escalate to the premium model.
  COMPLEX_REASONING: { models: [P, S, X], reasoning: "high", temperature: 0.3 },
  // Administrator / content-authoring work is worth the extra cost.
  ADMIN_CONTENT: { models: [X, P], reasoning: "medium", temperature: 0.5 },
};

export function routeTask(task: TaskType = "NORMAL_TUTORING"): RoutePolicy {
  return POLICY[task] ?? POLICY.NORMAL_TUTORING;
}

/** Task types that are allowed to reach the premium escalation model. */
export function mayEscalate(task: TaskType): boolean {
  return task === "COMPLEX_REASONING" || task === "ADMIN_CONTENT";
}

const SUBJECT_TASKS: [RegExp, TaskType][] = [
  [/math|algebra|geometr|calcul|trigon|statist|numer/i, "MATH"],
  [/physic/i, "PHYSICS"],
  [/chem/i, "CHEMISTRY"],
  [/bio|agric|health/i, "BIOLOGY"],
  [/english|literature|language/i, "ENGLISH"],
];

const HARD_SIGNALS =
  /\b(prove|derive|why does|multi-?step|show that|from first principles|past paper|uneb|paper 2|integrat|differentiat|simultaneous|stoichiometr|titration|moment of inertia|projectile|logarithm|matri(x|ces)|vector)\b/i;

const CALC_SIGNALS = /\b(calculate|solve|find the|determine|evaluate|compute|how many|how much)\b/i;

/**
 * Classify a tutoring request into an internal task type. Never exposed to the
 * student — it only decides which paid model and reasoning level to use.
 */
export function classifyTask(input: { subject?: string; text?: string }): TaskType {
  const subject = input.subject ?? "";
  const text = (input.text ?? "").slice(0, 2000);

  let base: TaskType = "NORMAL_TUTORING";
  for (const [re, task] of SUBJECT_TASKS) {
    if (re.test(subject) || re.test(text)) {
      base = task;
      break;
    }
  }

  const hard = HARD_SIGNALS.test(text);
  const isCalcSubject = base === "MATH" || base === "PHYSICS" || base === "CHEMISTRY";

  // Genuinely difficult, multi-step reasoning gets the escalation chain.
  if (hard && (isCalcSubject || text.length > 600)) return "COMPLEX_REASONING";
  if (isCalcSubject && CALC_SIGNALS.test(text)) return base; // already high reasoning
  return base;
}

/** Hard input limits — abuse protection and cost control. */
export const LIMITS = {
  maxUserMessageChars: 8_000,
  maxHistoryMessages: 12,
  maxHistoryChars: 12_000,
  maxSystemChars: 24_000,
};
