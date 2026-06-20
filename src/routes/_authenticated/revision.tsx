import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Sparkles, BookMarked, KeyRound, HelpCircle, FileText } from "lucide-react";
import { generateRevision } from "@/lib/ai.functions";
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
import { Markdown } from "@/components/Markdown";
import { SUBJECTS } from "@/lib/subjects";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/revision")({
  head: () => ({ meta: [{ title: "Revision · Omicron AI" }] }),
  component: RevisionPage,
});

interface RevisionData {
  summary: string;
  notes: string[];
  keyConcepts: string[];
  likelyQuestions: string[];
}

function RevisionPage() {
  const callRevision = useServerFn(generateRevision);
  const [subject, setSubject] = useState("Biology");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<RevisionData | null>(null);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic to revise.");
      return;
    }
    setBusy(true);
    try {
      const res = await callRevision({ data: { subject, topic: topic.trim() } });
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("CREDITS")) toast.error("AI usage limit reached. Try later.");
      else toast.error("Couldn't generate revision. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Revision mode</h1>
      <p className="mt-1 text-muted-foreground">
        Get summaries, key concepts and likely exam questions for any topic.
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:w-44">
          <Label>Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label>Topic</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder="e.g. Cell division"
          />
        </div>
        <Button onClick={generate} disabled={busy} variant="hero">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate
        </Button>
      </div>

      {busy && !data && (
        <div className="mt-10 flex flex-col items-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm">Building your revision notes…</p>
        </div>
      )}

      {!busy && !data && (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
          <BookMarked className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Choose a subject and topic to generate revision material.
          </p>
        </div>
      )}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="rounded-2xl border border-border bg-gradient-primary p-5 text-primary-foreground shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Summary
            </div>
            <p className="mt-2 text-sm leading-relaxed text-primary-foreground/90">
              {data.summary}
            </p>
          </div>

          <Tabs defaultValue="notes" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="concepts">Key concepts</TabsTrigger>
              <TabsTrigger value="questions">Exam Qs</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="mt-4 space-y-3">
              {data.notes.map((n, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 text-sm shadow-card">
                  <Markdown>{n}</Markdown>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="concepts" className="mt-4 space-y-2">
              {data.keyConcepts.map((c, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-card">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <Markdown>{c}</Markdown>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="questions" className="mt-4 space-y-2">
              {data.likelyQuestions.map((q, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-card">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <Markdown>{q}</Markdown>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
}
