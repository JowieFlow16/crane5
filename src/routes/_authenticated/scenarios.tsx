import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Wand2, Loader2, ListChecks, Target, ClipboardList, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { generateScenario, type GeneratedScenario } from "@/lib/ai.functions";
import { aiErrorMessage } from "@/lib/ai-errors";
import { SUBJECTS } from "@/lib/subjects";
import { Markdown } from "@/components/Markdown";
import { SaveButton } from "@/components/SaveButton";
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
import { useStats } from "@/lib/useStats";

export const Route = createFileRoute("/_authenticated/scenarios")({
  head: () => ({
    meta: [
      { title: "Scenario Generator · Crane5 AI" },
      {
        name: "description",
        content:
          "Generate authentic Ugandan situational learning scenarios with graded tasks and a marking guide.",
      },
      { property: "og:title", content: "Scenario Generator · Crane5 AI" },
      {
        property: "og:description",
        content: "Practise NCDC situational items built on real Ugandan contexts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScenariosPage,
});

const CLASSES = ["S1", "S2", "S3", "S4", "S5", "S6"];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

function ScenariosPage() {
  const { profile } = useAuth();
  const { award } = useStats();
  const run = useServerFn(generateScenario);

  const [subject, setSubject] = useState(profile?.favorite_subjects?.[0] ?? "Physics");
  const [topic, setTopic] = useState("");
  const [classLevel, setClassLevel] = useState(profile?.class_level ?? "S4");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("medium");
  const [contextNote, setContextNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedScenario | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Add a topic first.");
      return;
    }
    setBusy(true);
    setResult(null);
    setShowGuide(false);
    try {
      const out = await run({
        data: {
          subject,
          topic: topic.trim(),
          classLevel,
          difficulty,
          context: contextNote.trim() || undefined,
        },
      });
      setResult(out);
      award(15);
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't generate a scenario."));
    } finally {
      setBusy(false);
    }
  };

  const asMarkdown = result
    ? `# ${result.title}\n\n${result.scenario}\n\n## Tasks\n${result.tasks
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n")}\n\n## Extension\n${result.extension}`
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Wand2 className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Scenario generator</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Real-life Ugandan situations with graded NCDC tasks — exactly how you'll be assessed.
      </p>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="subject">
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
            <Label htmlFor="class">Class</Label>
            <Select value={classLevel} onValueChange={setClassLevel}>
              <SelectTrigger id="class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Simple machines, Demand and supply, Soil erosion…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ctx">Set it somewhere (optional)</Label>
            <Input
              id="ctx"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder="A boda stage in Mbarara"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diff">Challenge level</Label>
            <Select
              value={difficulty}
              onValueChange={(v) => setDifficulty(v as (typeof DIFFICULTIES)[number])}
            >
              <SelectTrigger id="diff">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="hero" className="w-full" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Generate scenario
        </Button>
      </motion.section>

      {result && (
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <header className="flex flex-wrap items-start gap-3">
            <h2 className="font-display text-xl font-bold">{result.title}</h2>
            <SaveButton
              kind="note"
              className="ml-auto"
              title={result.title}
              subject={subject}
              content={asMarkdown}
            />
          </header>

          <Markdown>{result.scenario}</Markdown>

          <section>
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <ListChecks className="h-4 w-4 text-primary" /> Your tasks
            </h3>
            <ol className="mt-2 space-y-2">
              {result.tasks.map((t, i) => (
                <li key={i} className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <span className="mr-1.5 font-semibold text-primary">{i + 1}.</span>
                  <Markdown className="inline">{t}</Markdown>
                </li>
              ))}
            </ol>
          </section>

          {result.competencies.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 font-display font-semibold">
                <Target className="h-4 w-4 text-primary" /> Competencies practised
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.competencies.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </section>
          )}

          {result.extension && (
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <h3 className="flex items-center gap-2 font-display font-semibold text-primary">
                <ArrowUpRight className="h-4 w-4" /> Push yourself
              </h3>
              <div className="mt-1 text-sm">
                <Markdown>{result.extension}</Markdown>
              </div>
            </section>
          )}

          {result.markingGuide.length > 0 && (
            <section>
              <Button variant="outline" size="sm" onClick={() => setShowGuide((v) => !v)}>
                <ClipboardList className="h-4 w-4" />
                {showGuide ? "Hide marking guide" : "Show marking guide"}
              </Button>
              {showGuide && (
                <ul className="mt-3 space-y-2">
                  {result.markingGuide.map((g, i) => (
                    <li key={i} className="rounded-xl border border-border p-3 text-sm">
                      <Markdown>{g}</Markdown>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </motion.article>
      )}
    </div>
  );
}
