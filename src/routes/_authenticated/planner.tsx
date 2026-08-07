import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { CalendarCheck, Plus, Trash2, Circle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db, type StudyTask } from "@/lib/db";
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
import { SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({ meta: [{ title: "Study Planner · Crane5 AI" }] }),
  component: PlannerPage,
});

function PlannerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { award } = useStats();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [due, setDue] = useState("");

  const { data: tasks } = useQuery({
    queryKey: ["study-tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("study_tasks")
        .select("*")
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      return (data as StudyTask[]) ?? [];
    },
  });

  const add = async () => {
    if (!title.trim() || !user) {
      toast.error("Enter a task.");
      return;
    }
    const { error } = await db.from("study_tasks").insert({
      user_id: user.id,
      title: title.trim(),
      subject,
      due_date: due || null,
    });
    if (error) {
      toast.error("Couldn't add task.");
      return;
    }
    setTitle("");
    setDue("");
    qc.invalidateQueries({ queryKey: ["study-tasks", user.id] });
  };

  const toggle = async (t: StudyTask) => {
    await db.from("study_tasks").update({ done: !t.done }).eq("id", t.id);
    if (!t.done) await award(10);
    qc.invalidateQueries({ queryKey: ["study-tasks", user?.id] });
  };

  const remove = async (id: string) => {
    await db.from("study_tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["study-tasks", user?.id] });
  };

  const pending = (tasks ?? []).filter((t) => !t.done);
  const done = (tasks ?? []).filter((t) => t.done);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Study Planner</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Plan your study goals. Tick them off to earn XP and build your streak.
      </p>

      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label>Task</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="e.g. Revise photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due</Label>
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
        <Button onClick={add} variant="hero" className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>

      <div className="mt-6 space-y-2">
        <AnimatePresence initial={false}>
          {pending.map((t) => (
            <TaskRow key={t.id} t={t} onToggle={toggle} onRemove={remove} />
          ))}
        </AnimatePresence>
        {pending.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No pending tasks. Add one above to get started! ✨
          </p>
        )}
      </div>

      {done.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Completed</p>
          <div className="space-y-2">
            {done.map((t) => (
              <TaskRow key={t.id} t={t} onToggle={toggle} onRemove={remove} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  t,
  onToggle,
  onRemove,
}: {
  t: StudyTask;
  onToggle: (t: StudyTask) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <button onClick={() => onToggle(t)} aria-label="Toggle">
        {t.done ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", t.done && "text-muted-foreground line-through")}>
          {t.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {t.subject}
          {t.due_date ? ` · due ${t.due_date}` : ""}
        </p>
      </div>
      <button
        onClick={() => onRemove(t.id)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
