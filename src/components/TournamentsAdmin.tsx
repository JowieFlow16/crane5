import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Swords, Loader2, Trash2, Trophy, Flag, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  createTournament,
  listTournamentsAdmin,
  manageTournament,
} from "@/lib/tournaments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECTS } from "@/lib/subjects";

const CLASSES = ["S1", "S2", "S3", "S4", "S5", "S6"];
const ALL = "__all__";

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TournamentsAdmin() {
  const qc = useQueryClient();
  const create = useServerFn(createTournament);
  const manage = useServerFn(manageTournament);
  const list = useServerFn(listTournamentsAdmin);

  const [title, setTitle] = useState("Friday Quick Quiz");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("quick_quiz");
  const [subject, setSubject] = useState("Mathematics");
  const [classLevel, setClassLevel] = useState(ALL);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState(8);
  const [seconds, setSeconds] = useState(30);
  const [prizeCredits, setPrizeCredits] = useState(10);
  const [prizeXp, setPrizeXp] = useState(100);
  const [winners, setWinners] = useState(5);
  const [startsAt, setStartsAt] = useState(localInput(new Date()));
  const [endsAt, setEndsAt] = useState(localInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [busy, setBusy] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["tournaments-admin"],
    queryFn: () => list(),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({
        data: {
          title,
          description: description || undefined,
          kind: kind as "quick_quiz" | "fastest_learner" | "subject_clash",
          subject: subject === ALL ? undefined : subject,
          classLevel: classLevel === ALL ? undefined : classLevel,
          topic: topic || undefined,
          difficulty: difficulty as "Easy" | "Medium" | "Hard",
          questionCount,
          secondsPerQuestion: seconds,
          prizeCredits,
          prizeXp,
          winnersCount: winners,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        },
      });
      toast.success(`“${res.title}” is live and being announced to students.`);
      setDescription("");
      await qc.invalidateQueries({ queryKey: ["tournaments-admin"] });
      await qc.invalidateQueries({ queryKey: ["tournaments"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the tournament.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, action: "publish" | "unpublish" | "delete" | "end_now") => {
    try {
      await manage({ data: { id, action } });
      toast.success(
        action === "delete"
          ? "Tournament deleted."
          : action === "end_now"
            ? "Tournament closed — winners rewarded."
            : "Updated.",
      );
      await qc.invalidateQueries({ queryKey: ["tournaments-admin"] });
      await qc.invalidateQueries({ queryKey: ["tournaments"] });
    } catch {
      toast.error("That action failed.");
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Tournaments</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Create timed competitions. Crane5 generates the question set, announces the tournament to
        students and rewards the top finishers with credits and XP automatically.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2"
        >
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Announcement (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beat the clock on Chemistry equations…"
              className="min-h-[70px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick_quiz">Quick Quiz</SelectItem>
                  <SelectItem value="fastest_learner">Fastest Learner</SelectItem>
                  <SelectItem value="subject_clash">Subject Clash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Easy", "Medium", "Hard"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All subjects</SelectItem>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classLevel} onValueChange={setClassLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All classes</SelectItem>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Topic focus (optional)</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Quadratics" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Questions</Label>
              <Input
                type="number"
                min={3}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Seconds / question</Label>
              <Input
                type="number"
                min={10}
                max={180}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Winners rewarded</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={winners}
                onChange={(e) => setWinners(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Credits each</Label>
              <Input
                type="number"
                min={0}
                max={200}
                value={prizeCredits}
                onChange={(e) => setPrizeCredits(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>XP each</Label>
              <Input
                type="number"
                min={0}
                max={5000}
                value={prizeXp}
                onChange={(e) => setPrizeXp(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
            {busy ? "Generating questions…" : "Create tournament"}
          </Button>
        </form>

        <div className="space-y-3 lg:col-span-3">
          {(rows ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No tournaments yet.
            </div>
          ) : (
            (rows ?? []).map((t) => (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.subject ?? "All subjects"} · {t.class_level ?? "All classes"} ·{" "}
                      {t.difficulty} · top {t.winners_count} get {t.prize_credits} credits
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(t.starts_at).toLocaleString()} →{" "}
                      {new Date(t.ends_at).toLocaleString()}
                      {t.finalized_at ? " · rewarded" : ""}
                      {!t.published ? " · hidden" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(t.id, t.published ? "unpublish" : "publish")}
                      title={t.published ? "Hide from students" : "Publish"}
                    >
                      {t.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {!t.finalized_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(t.id, "end_now")}
                        title="Close now and reward winners"
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(t.id, "delete")}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
