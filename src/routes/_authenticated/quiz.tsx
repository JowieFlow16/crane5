import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateQuiz, type QuizQuestion } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({ meta: [{ title: "Quizzes · Omicron AI" }] }),
  component: QuizPage,
});

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const TYPES = ["MCQ", "Short Answer", "Mixed"] as const;

type Stage = "setup" | "taking" | "results";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function isCorrect(q: QuizQuestion, given: string) {
  if (!given) return false;
  const a = normalize(q.answer);
  const g = normalize(given);
  if (q.type === "mcq") return a === g;
  return g === a || g.includes(a) || a.includes(g);
}

function QuizPage() {
  const { user } = useAuth();
  const callGenerate = useServerFn(generateQuiz);

  const [stage, setStage] = useState<Stage>("setup");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("Medium");
  const [quizType, setQuizType] = useState<(typeof TYPES)[number]>("MCQ");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await callGenerate({
        data: { subject, topic: topic || undefined, difficulty, quizType, count },
      });
      if (!res.questions?.length) throw new Error("empty");
      setQuestions(res.questions);
      setAnswers(new Array(res.questions.length).fill(""));
      setStage("taking");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("CREDITS")) toast.error("AI usage limit reached. Try later.");
      else toast.error("Couldn't generate the quiz. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    let correct = 0;
    const weak: string[] = [];
    questions.forEach((q, i) => {
      if (isCorrect(q, answers[i])) correct++;
      else weak.push(q.topic);
    });
    setScore(correct);
    setStage("results");

    if (user) {
      try {
        const { data: quiz } = await supabase
          .from("quizzes")
          .insert({
            user_id: user.id,
            subject,
            topic: topic || null,
            difficulty,
            quiz_type: quizType,
            questions: questions as unknown as import("@/integrations/supabase/types").Json,
          })
          .select("id")
          .single();
        await supabase.from("quiz_results").insert({
          quiz_id: quiz?.id ?? null,
          user_id: user.id,
          subject,
          topic: topic || null,
          score: correct,
          total: questions.length,
          answers: answers as unknown as import("@/integrations/supabase/types").Json,
          weak_areas: Array.from(new Set(weak)),
        });
      } catch {
        /* non-blocking */
      }
    }
  };

  const reset = () => {
    setStage("setup");
    setQuestions([]);
    setAnswers([]);
    setScore(0);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <AnimatePresence mode="wait">
        {stage === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <h1 className="font-display text-2xl font-bold">Generate a quiz</h1>
            <p className="mt-1 text-muted-foreground">
              Pick your subject and settings — Omicron AI builds it instantly.
            </p>

            <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Topic (optional)</Label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Quadratic equations"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={quizType} onValueChange={(v) => setQuizType(v as typeof quizType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Number of questions: {count}</Label>
                  <input
                    type="range"
                    min={3}
                    max={15}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              </div>
              <Button onClick={generate} disabled={busy} variant="hero" size="lg" className="w-full">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {busy ? "Generating…" : "Generate quiz"}
              </Button>
            </div>
          </motion.div>
        )}

        {stage === "taking" && (
          <motion.div
            key="taking"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-display text-xl font-bold">{subject} quiz</h1>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                {difficulty} · {questions.length} questions
              </span>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <p className="font-medium">
                    <span className="text-primary">{i + 1}.</span> {q.question}
                  </p>
                  {q.type === "mcq" && q.options ? (
                    <div className="mt-3 space-y-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() =>
                            setAnswers((a) => a.map((v, idx) => (idx === i ? opt : v)))
                          }
                          className={cn(
                            "block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                            answers[i] === opt
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Input
                      value={answers[i]}
                      onChange={(e) =>
                        setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))
                      }
                      placeholder="Your answer…"
                      className="mt-3"
                    />
                  )}
                </div>
              ))}
            </div>
            <Button onClick={submit} variant="hero" size="lg" className="mt-6 w-full">
              Submit answers
            </Button>
          </motion.div>
        )}

        {stage === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-center"
            >
              <div className="pattern-kente absolute inset-0 opacity-25" />
              <div className="relative">
                <Trophy className="mx-auto h-12 w-12 text-primary-foreground" />
                <p className="mt-3 font-display text-4xl font-bold text-primary-foreground">
                  {score}/{questions.length}
                </p>
                <p className="mt-1 text-primary-foreground/85">
                  {score === questions.length
                    ? "Perfect score! You're on fire 🔥"
                    : score / questions.length >= 0.6
                      ? "Great work — keep it up! 💪"
                      : "Good effort! Review the corrections below."}
                </p>
              </div>
            </motion.div>

            <div className="mt-6 space-y-4">
              {questions.map((q, i) => {
                const ok = isCorrect(q, answers[i]);
                return (
                  <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                    <div className="flex items-start gap-2">
                      {ok ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      )}
                      <p className="font-medium">{q.question}</p>
                    </div>
                    <div className="mt-3 space-y-1 pl-7 text-sm">
                      <p className={cn(ok ? "text-success" : "text-destructive")}>
                        Your answer: {answers[i] || "—"}
                      </p>
                      {!ok && <p className="text-success">Correct: {q.answer}</p>}
                      <p className="mt-1 rounded-lg bg-muted p-2 text-muted-foreground">
                        💡 {q.explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={reset} variant="hero" size="lg" className="flex-1">
                <RotateCcw className="h-4 w-4" /> New quiz
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
