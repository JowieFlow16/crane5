import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  Sparkles,
  Layers,
  Plus,
  RotateCw,
  Check,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { generateFlashcards } from "@/lib/ai.functions";
import { useAuth } from "@/lib/auth";
import { db, type FlashcardRow } from "@/lib/db";
import { useStats } from "@/lib/useStats";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUBJECTS } from "@/lib/subjects";
import { Markdown } from "@/components/Markdown";
import { toast } from "sonner";
import { aiErrorMessage } from "@/lib/ai-errors";


export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () => ({ meta: [{ title: "Flashcards · Crane5 AI" }] }),
  component: FlashcardsPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextSchedule(card: FlashcardRow, grade: "again" | "hard" | "good" | "easy") {
  let ease = card.ease;
  let interval = card.interval_days;
  if (grade === "again") {
    ease = Math.max(1.3, ease - 0.2);
    interval = 1;
  } else if (grade === "hard") {
    ease = Math.max(1.3, ease - 0.15);
    interval = Math.max(1, Math.round((interval || 1) * 1.2));
  } else if (grade === "good") {
    interval = interval === 0 ? 1 : Math.round(interval * ease);
  } else {
    ease = ease + 0.15;
    interval = Math.max(2, Math.round((interval || 1) * ease * 1.3));
  }
  const due = new Date();
  due.setDate(due.getDate() + interval);
  return { ease, interval_days: interval, due_date: due.toISOString().slice(0, 10) };
}

function FlashcardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { award } = useStats();
  const callGenerate = useServerFn(generateFlashcards);

  const [subject, setSubject] = useState("Biology");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const { data: cards } = useQuery({
    queryKey: ["flashcards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("flashcards")
        .select("*")
        .order("created_at", { ascending: false });
      return (data as FlashcardRow[]) ?? [];
    },
  });

  const due = (cards ?? []).filter((c) => c.due_date <= todayISO());

  // Study state
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = due[idx];

  const generate = async () => {
    if (!topic.trim() || !user) {
      toast.error("Enter a topic.");
      return;
    }
    setBusy(true);
    try {
      const res = await callGenerate({ data: { subject, topic: topic.trim(), count } });
      if (!res.cards?.length) throw new Error("empty");
      const rows = res.cards.map((c) => ({
        user_id: user.id,
        subject,
        topic: topic.trim(),
        front: c.front,
        back: c.back,
      }));
      const { error } = await db.from("flashcards").insert(rows);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["flashcards", user.id] });
      toast.success(`${rows.length} flashcards added 🎴`);
      setTopic("");
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't create flashcards."));
    } finally {
      setBusy(false);
    }
  };

  const grade = async (g: "again" | "hard" | "good" | "easy") => {
    if (!current) return;
    const sched = nextSchedule(current, g);
    await db
      .from("flashcards")
      .update({ ...sched, reps: current.reps + 1 })
      .eq("id", current.id);
    if (g !== "again") await award(2);
    setFlipped(false);
    setIdx((i) => i + 1);
    qc.invalidateQueries({ queryKey: ["flashcards", user?.id] });
  };

  const remove = async (id: string) => {
    await db.from("flashcards").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["flashcards", user?.id] });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Layers className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Flashcards</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Generate smart flashcards and review them with spaced repetition.
      </p>

      <Tabs defaultValue="study" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="study">Study ({due.length})</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="all">All ({cards?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* STUDY */}
        <TabsContent value="study" className="mt-5">
          {due.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing due right now — you're all caught up! 🎉 Create a new set or come back later.
              </p>
            </div>
          ) : !current ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
              <Check className="mx-auto h-10 w-10 text-success" />
              <p className="mt-3 font-medium">Session complete! Great work 💪</p>
              <Button className="mt-4" variant="hero" onClick={() => setIdx(0)}>
                <RotateCw className="h-4 w-4" /> Review again
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-center text-xs text-muted-foreground">
                {idx + 1} / {due.length} · {current.subject}
                {current.topic ? ` · ${current.topic}` : ""}
              </p>
              <AnimatePresence mode="wait">
                <motion.button
                  key={current.id + String(flipped)}
                  initial={{ opacity: 0, rotateY: -8 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setFlipped((f) => !f)}
                  className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-card"
                >
                  <span className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                    {flipped ? "Answer" : "Question"}
                  </span>
                  <div className="text-lg">
                    <Markdown>{flipped ? current.back : current.front}</Markdown>
                  </div>
                  {!flipped && (
                    <span className="mt-4 text-xs text-muted-foreground">Tap to flip</span>
                  )}
                </motion.button>
              </AnimatePresence>

              {flipped && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 grid grid-cols-4 gap-2"
                >
                  <Button variant="outline" onClick={() => grade("again")}>Again</Button>
                  <Button variant="outline" onClick={() => grade("hard")}>Hard</Button>
                  <Button variant="outline" onClick={() => grade("good")}>Good</Button>
                  <Button variant="hero" onClick={() => grade("easy")}>Easy</Button>
                </motion.div>
              )}
            </div>
          )}
        </TabsContent>

        {/* CREATE */}
        <TabsContent value="create" className="mt-5">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
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
                <Label>Topic</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate()}
                  placeholder="e.g. Cell division"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>How many cards: {count}</Label>
                <input
                  type="range"
                  min={4}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </div>
            </div>
            <Button onClick={generate} disabled={busy} variant="hero" className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Generating…" : "Generate flashcards"}
            </Button>
          </div>
        </TabsContent>

        {/* ALL */}
        <TabsContent value="all" className="mt-5 space-y-2">
          {(cards ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Plus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              No flashcards yet. Create your first set!
            </div>
          ) : (
            (cards ?? []).map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium"><Markdown>{c.front}</Markdown></div>
                    <div className="mt-1 text-sm text-muted-foreground"><Markdown>{c.back}</Markdown></div>
                  </div>
                  <button
                    onClick={() => remove(c.id)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  {c.subject}{c.topic ? ` · ${c.topic}` : ""} · due {c.due_date}
                </p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
