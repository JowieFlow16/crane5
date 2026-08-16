import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  CalendarClock,
  Loader2,
  Sparkles,
  Trash2,
  BellRing,
  BellOff,
  Clock,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { db, type TimetableSlot } from "@/lib/db";
import { generateTimetable } from "@/lib/ai.functions";
import { aiErrorMessage } from "@/lib/ai-errors";
import { SUBJECTS } from "@/lib/subjects";
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

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({
    meta: [
      { title: "Revision Timetable · Crane5 AI" },
      {
        name: "description",
        content:
          "Build a personal weekly revision timetable with reminders, tuned to the subjects you offer.",
      },
      { property: "og:title", content: "Revision Timetable · Crane5 AI" },
      {
        property: "og:description",
        content: "Your own AI-built weekly revision timetable with study reminders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimetablePage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hhmm(t: string) {
  return t.slice(0, 5);
}

/** Fire a browser notification a few minutes before each session starts. */
function useSlotReminders(slots: TimetableSlot[]) {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const fired = new Set<string>();

    const tick = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const day = now.getDay();
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      for (const s of slots) {
        if (!s.reminders_on || s.day_of_week !== day) continue;
        const [h, m] = hhmm(s.start_time).split(":").map(Number);
        const startsIn = h * 60 + m - minutesNow;
        const key = `${s.id}-${now.toDateString()}`;
        if (startsIn <= s.reminder_minutes && startsIn >= 0 && !fired.has(key)) {
          fired.add(key);
          new Notification(`Crane5 AI · ${s.subject}`, {
            body: `${s.activity}${s.topic ? ` — ${s.topic}` : ""} at ${hhmm(s.start_time)}. Let's go 💪`,
          });
        }
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [slots]);
}

function TimetablePage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const build = useServerFn(generateTimetable);

  const mySubjects = useMemo(
    () => (profile?.favorite_subjects?.length ? profile.favorite_subjects : SUBJECTS.slice(0, 6)),
    [profile?.favorite_subjects],
  );

  const [subjects, setSubjects] = useState<string[]>(mySubjects);
  const [weak, setWeak] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [startHour, setStartHour] = useState(17);
  const [endHour, setEndHour] = useState(21);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setSubjects(mySubjects), [mySubjects]);

  const { data: slots } = useQuery({
    queryKey: ["timetable", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TimetableSlot[]> => {
      const { data } = await db
        .from("timetable_slots")
        .select("*")
        .order("day_of_week")
        .order("start_time");
      return (data as TimetableSlot[]) ?? [];
    },
  });

  useSlotReminders(slots ?? []);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const generate = async () => {
    if (!user) return;
    if (subjects.length === 0) {
      toast.error("Pick at least one subject.");
      return;
    }
    if (endHour <= startHour) {
      toast.error("Your finish time must be after your start time.");
      return;
    }
    setBusy(true);
    try {
      const plan = await build({
        data: {
          subjects,
          classLevel: profile?.class_level ?? "S4",
          studyDays: days.length ? days : [1, 2, 3, 4, 5],
          startHour,
          endHour,
          sessionMinutes,
          weakSubjects: weak,
          goal: goal.trim() || undefined,
        },
      });

      await db.from("timetable_slots").delete().eq("user_id", user.id);
      const rows = plan.slots.map((s) => ({
        user_id: user.id,
        day_of_week: s.day,
        start_time: s.start.length === 5 ? `${s.start}:00` : s.start,
        end_time: s.end.length === 5 ? `${s.end}:00` : s.end,
        subject: s.subject,
        topic: s.topic || null,
        activity: s.activity || "Revision",
      }));
      if (rows.length) {
        const { error } = await db.from("timetable_slots").insert(rows as never);
        if (error) throw new Error(String((error as { message?: string }).message ?? error));
      }
      qc.invalidateQueries({ queryKey: ["timetable", user.id] });
      toast.success(plan.advice || "Your timetable is ready 🎉");
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't build your timetable."));
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!user) return;
    const { error } = await db.from("timetable_slots").insert({
      user_id: user.id,
      day_of_week: 1,
      start_time: "17:00:00",
      end_time: "17:45:00",
      subject: subjects[0] ?? "Mathematics",
      activity: "Revision",
    } as never);
    if (error) toast.error("Couldn't add that slot.");
    else qc.invalidateQueries({ queryKey: ["timetable", user.id] });
  };

  const update = async (slot: TimetableSlot, patch: Partial<TimetableSlot>) => {
    await db
      .from("timetable_slots")
      .update(patch as never)
      .eq("id", slot.id);
    qc.invalidateQueries({ queryKey: ["timetable", user?.id] });
  };

  const remove = async (slot: TimetableSlot) => {
    await db.from("timetable_slots").delete().eq("id", slot.id);
    qc.invalidateQueries({ queryKey: ["timetable", user?.id] });
  };

  const askReminders = async () => {
    if (!("Notification" in window)) {
      toast.error("This device doesn't support reminders.");
      return;
    }
    const res = await Notification.requestPermission();
    if (res === "granted") toast.success("Reminders on — we'll nudge you before each session.");
    else toast.error("Reminders blocked. Enable notifications for this site to get nudges.");
  };

  const byDay = useMemo(() => {
    const map: Record<number, TimetableSlot[]> = {};
    for (const s of slots ?? []) (map[s.day_of_week] ??= []).push(s);
    return map;
  }, [slots]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Revision timetable</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={askReminders}>
          <BellRing className="h-4 w-4" /> Turn on reminders
        </Button>
      </div>
      <p className="mt-1 text-muted-foreground">
        Crane5 builds a realistic weekly plan around the subjects you offer, then reminds you before
        every session.
      </p>

      {/* Builder */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <div>
          <Label>Subjects you're revising</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(subjects, setSubjects, s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  subjects.includes(s)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Subjects you find hardest (extra time)</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(weak, setWeak, s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  weak.includes(s)
                    ? "border-amber-500 bg-amber-500/10 text-amber-600"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Study days</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SHORT.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  days.includes(i)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">Start</Label>
            <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
              <SelectTrigger id="from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 19 }, (_, i) => i + 4).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Finish</Label>
            <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
              <SelectTrigger id="to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 19 }, (_, i) => i + 5).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="len">Session length</Label>
            <Select
              value={String(sessionMinutes)}
              onValueChange={(v) => setSessionMinutes(Number(v))}
            >
              <SelectTrigger id="len">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 40, 45, 60, 90].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="goal">What are you working towards? (optional)</Label>
          <Input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Pass UNEB with distinctions in the sciences"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="hero" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {slots?.length ? "Rebuild my timetable" : "Build my timetable"}
          </Button>
          <Button variant="outline" onClick={addManual}>
            <Plus className="h-4 w-4" /> Add a slot myself
          </Button>
        </div>
      </motion.section>

      {/* Week view */}
      <div className="mt-8 space-y-6">
        {(slots ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No timetable yet. Pick your subjects above and let Crane5 build one.
          </div>
        ) : (
          DAYS.map((day, i) =>
            (byDay[i] ?? []).length === 0 ? null : (
              <section key={day}>
                <h2 className="font-display text-lg font-bold">{day}</h2>
                <div className="mt-2 space-y-2">
                  {(byDay[i] ?? []).map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
                    >
                      <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {hhmm(s.start_time)} – {hhmm(s.end_time)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.activity}
                          {s.topic ? ` · ${s.topic}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => update(s, { reminders_on: !s.reminders_on })}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                        aria-label={s.reminders_on ? "Mute reminder" : "Unmute reminder"}
                      >
                        {s.reminders_on ? (
                          <BellRing className="h-4 w-4 text-primary" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ),
          )
        )}
      </div>
    </div>
  );
}
