import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  GraduationCap,
  Loader2,
  Sparkles,
  BadgeCheck,
  Clock,
  XCircle,
  BookOpen,
  ClipboardList,
  LineChart,
  Save,
  MessagesSquare,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { aiErrorMessage } from "@/lib/ai-errors";
import { db, type TeacherProfile, type Conversation, type DirectMessage } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { SUBJECTS } from "@/lib/subjects";
import { generateLessonPlan, generateExam, classInsights } from "@/lib/ai.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teach")({
  head: () => ({ meta: [{ title: "Teacher Center · Crane5 AI" }] }),
  component: TeachPage,
});

const CLASS_LEVELS = ["S1", "S2", "S3", "S4", "S5", "S6"];

function TeachPage() {
  const { user, isTeacher, profile } = useAuth();

  const { data: tp, isLoading } = useQuery({
    queryKey: ["my-teacher-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TeacherProfile | null> => {
      const { data } = await db
        .from("teacher_profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      return (data as TeacherProfile) ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const approved = tp?.status === "approved" || isTeacher;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Teacher Center</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        {approved
          ? "Your AI teaching copilot + student requests, all in one place."
          : "Join Crane5 as a verified teacher and help students across Uganda."}
      </p>

      {/* Status banner */}
      {tp && tp.status === "pending" && (
        <Banner
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
          title="Application under review"
          text="An admin will verify your details shortly. You can keep editing your profile below."
        />
      )}
      {tp && tp.status === "rejected" && (
        <Banner
          icon={<XCircle className="h-5 w-5" />}
          tone="red"
          title="Application not approved"
          text="Update your details and resubmit — we'll take another look."
        />
      )}
      {approved && (
        <Banner
          icon={<BadgeCheck className="h-5 w-5" />}
          tone="green"
          title="You're a verified teacher 🎉"
          text="Students can now find you in the directory and message you for help."
        />
      )}

      {approved ? (
        <TeacherDashboard tp={tp ?? null} />
      ) : (
        <ApplicationForm tp={tp ?? null} profile={profile} />
      )}
    </div>
  );
}

function Banner({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "amber" | "red" | "green";
}) {
  const tones = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    red: "border-destructive/40 bg-destructive/10 text-destructive",
    green: "border-success/40 bg-success/10 text-success",
  };
  return (
    <div className={cn("mt-5 flex items-start gap-3 rounded-2xl border p-4", tones[tone])}>
      {icon}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm opacity-90">{text}</p>
      </div>
    </div>
  );
}

/* ------------------------- Application / edit form ------------------------- */

function ApplicationForm({
  tp,
  profile,
}: {
  tp: TeacherProfile | null;
  profile: ReturnType<typeof useAuth>["profile"];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [headline, setHeadline] = useState("");
  const [school, setSchool] = useState("");
  const [experience, setExperience] = useState("1");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tp) {
      setHeadline(tp.headline ?? "");
      setSchool(tp.school ?? "");
      setExperience(String(tp.experience_years ?? 1));
      setSubjects(tp.subjects ?? []);
      setLevels(tp.class_levels ?? []);
      setBio(tp.bio ?? "");
      setContact(tp.contact_note ?? "");
    }
  }, [tp]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = async () => {
    if (!user) return;
    if (subjects.length === 0) {
      toast.error("Pick at least one subject you teach.");
      return;
    }
    setBusy(true);
    const payload = {
      id: user.id,
      full_name: profile?.full_name ?? "Teacher",
      avatar_url: profile?.avatar_url ?? null,
      headline: headline.trim() || null,
      school: school.trim() || null,
      experience_years: Number(experience) || 0,
      subjects,
      class_levels: levels,
      bio: bio.trim() || null,
      contact_note: contact.trim() || null,
      status: "pending",
    };
    const { error } = await db.from("teacher_profiles").upsert(payload as never);
    setBusy(false);
    if (error) {
      toast.error("Couldn't submit. Please try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-teacher-profile", user.id] });
    toast.success("Application submitted! We'll review it soon. 🎓");
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
    >
      <h2 className="font-display font-semibold">
        {tp ? "Update your teacher profile" : "Apply to teach"}
      </h2>

      <div className="space-y-1.5">
        <Label>Headline</Label>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Physics & Maths teacher · 8 years · UCE examiner"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>School</Label>
          <Input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="e.g. Namilyango College"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Years of experience</Label>
          <Select value={experience} onValueChange={setExperience}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 41 }, (_, i) => String(i)).map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Subjects you teach</Label>
        <div className="flex flex-wrap gap-2">
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

      <div className="space-y-1.5">
        <Label>Class levels</Label>
        <div className="flex flex-wrap gap-2">
          {CLASS_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggle(levels, setLevels, l)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                levels.includes(l)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>About you</Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Share your teaching style, achievements and how you help students…"
          rows={4}
          maxLength={600}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Availability / contact note (optional)</Label>
        <Input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="e.g. Reply within a day, evenings are best"
        />
      </div>

      <Button onClick={submit} variant="hero" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {tp ? "Save & resubmit" : "Submit application"}
      </Button>
    </motion.section>
  );
}

/* ----------------------------- Teacher dashboard ----------------------------- */

type Tool = "lesson" | "exam" | "insights" | "profile";

function TeacherDashboard({ tp }: { tp: TeacherProfile | null }) {
  const [tab, setTab] = useState<Tool>("lesson");
  const { user, profile } = useAuth();

  const tabs: { id: Tool; label: string; icon: React.ElementType }[] = [
    { id: "lesson", label: "Lesson Plan", icon: BookOpen },
    { id: "exam", label: "Exam Builder", icon: ClipboardList },
    { id: "insights", label: "Class Insights", icon: LineChart },
    { id: "profile", label: "My Profile", icon: GraduationCap },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-gradient-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
        <Link
          to="/messages"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <MessagesSquare className="h-4 w-4" /> Student chats
        </Link>
      </div>

      <div className="mt-5">
        {tab === "lesson" && <LessonPlanTool teacherSubjects={tp?.subjects ?? SUBJECTS} />}
        {tab === "exam" && <ExamTool teacherSubjects={tp?.subjects ?? SUBJECTS} />}
        {tab === "insights" && <InsightsTool subjects={tp?.subjects ?? []} userId={user?.id} />}
        {tab === "profile" && <ApplicationForm tp={tp} profile={profile} />}
      </div>
    </div>
  );
}

function OutputCard({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <div className="mb-3 flex justify-end">
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="text-sm">
        <Markdown>{content}</Markdown>
      </div>
    </motion.div>
  );
}

function ToolShell({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="font-display font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function SubjectSelect({
  subjects,
  value,
  onChange,
}: {
  subjects: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const list = subjects.length ? subjects : SUBJECTS;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {list.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LessonPlanTool({ teacherSubjects }: { teacherSubjects: string[] }) {
  const run = useServerFn(generateLessonPlan);
  const [subject, setSubject] = useState(teacherSubjects[0] ?? "Mathematics");
  const [topic, setTopic] = useState("");
  const [classLevel, setClassLevel] = useState("S4");
  const [duration, setDuration] = useState("80 minutes");
  const [notes, setNotes] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!topic.trim()) return toast.error("Enter a topic.");
    setBusy(true);
    setOut("");
    try {
      const { content } = await run({ data: { subject, topic, classLevel, duration, notes } });
      setOut(content);
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't generate the lesson plan."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToolShell
        title="AI Lesson Plan Generator"
        desc="Get a full NCDC competency-based lesson plan in seconds."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <SubjectSelect subjects={teacherSubjects} value={subject} onChange={setSubject} />
          </div>
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classLevel} onValueChange={setClassLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Simultaneous equations"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Lesson duration</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Extra notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Focus areas, class context…"
          />
        </div>
        <Button onClick={go} variant="hero" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate lesson plan
        </Button>
      </ToolShell>
      {out && <OutputCard content={out} />}
    </>
  );
}

function ExamTool({ teacherSubjects }: { teacherSubjects: string[] }) {
  const run = useServerFn(generateExam);
  const [subject, setSubject] = useState(teacherSubjects[0] ?? "Mathematics");
  const [topic, setTopic] = useState("");
  const [classLevel, setClassLevel] = useState("S4");
  const [count, setCount] = useState("6");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard" | "Mixed">("Mixed");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setOut("");
    try {
      const { content } = await run({
        data: { subject, topic: topic || undefined, classLevel, count: Number(count), difficulty },
      });
      setOut(content);
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't build the exam."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToolShell
        title="AI Exam & Item Builder"
        desc="Generate NCDC scenario-based items with a full marking guide."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <SubjectSelect subjects={teacherSubjects} value={subject} onChange={setSubject} />
          </div>
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classLevel} onValueChange={setClassLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Number of items</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["3", "4", "5", "6", "8", "10", "12"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Easy", "Medium", "Hard", "Mixed"].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Topic (optional)</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Leave blank for a broad paper"
          />
        </div>
        <Button onClick={go} variant="hero" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Build exam paper
        </Button>
      </ToolShell>
      {out && <OutputCard content={out} />}
    </>
  );
}

function InsightsTool({ subjects, userId }: { subjects: string[]; userId?: string }) {
  const run = useServerFn(classInsights);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");

  const go = async () => {
    setBusy(true);
    setOut("");
    try {
      let msgs: string[] = manual
        .split("\n")
        .map((m) => m.trim())
        .filter(Boolean);

      if (msgs.length === 0 && userId) {
        // Pull recent messages students sent me.
        const { data: convos } = await db
          .from("conversations")
          .select("id")
          .or(`user_lo.eq.${userId},user_hi.eq.${userId}`);
        const ids = ((convos as { id: string }[]) ?? []).map((c) => c.id);
        if (ids.length) {
          const { data: dms } = await db
            .from("direct_messages")
            .select("content, recipient_id, created_at")
            .eq("recipient_id", userId)
            .order("created_at", { ascending: false })
            .limit(40);
          msgs = ((dms as DirectMessage[]) ?? []).map((m) => m.content);
        }
      }

      if (msgs.length === 0) {
        toast.error("No student questions found yet. Paste some below to analyse.");
        setBusy(false);
        return;
      }

      const { content } = await run({ data: { messages: msgs.slice(0, 60), subjects } });
      setOut(content);
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't generate insights."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToolShell
        title="Class Insights"
        desc="Turn the questions students ask you into a plan for what to reteach."
      >
        <p className="text-sm text-muted-foreground">
          We'll analyse recent questions students sent you. No messages yet? Paste some below (one
          per line) to try it.
        </p>
        <Textarea
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          rows={4}
          placeholder={"e.g. Why does osmosis happen?\nHow do I balance equations?"}
        />
        <Button onClick={go} variant="hero" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LineChart className="h-4 w-4" />}
          Analyse & advise
        </Button>
      </ToolShell>
      {out && <OutputCard content={out} />}
    </>
  );
}
