import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  learnFromFile,
  learnFromLink,
  learnFromPlaylist,
  learnFromVideo,
  refreshLinkSources,
} from "@/lib/knowledge.functions";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Upload,
  Loader2,
  Trash2,
  FileText,
  Search,
  ShieldAlert,
  Database,
  Link as LinkIcon,
  RefreshCw,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import { toast } from "sonner";
import { AiLimitsAdmin } from "@/components/AiLimitsAdmin";
import { AiGatewayAdmin } from "@/components/AiGatewayAdmin";
import { AiObservabilityAdmin } from "@/components/AiObservabilityAdmin";
import { AiControlPlaneAdmin } from "@/components/AiControlPlaneAdmin";
import { TournamentsAdmin } from "@/components/TournamentsAdmin";
import { ModerationQueue } from "@/components/ModerationQueue";
import { SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Crane5 AI" }] }),
  component: AdminPage,
});

const CLASSES = ["S1", "S2", "S3", "S4", "S5", "S6"];
/** Sentinel for "applies to every subject / every class" training material. */
const ALL = "__all__";
/** Turn a select value into what the server stores (null = all). */
const orAll = (v: string) => (v === ALL ? undefined : v);
const DOC_TYPES = ["notes", "past paper", "marking guide", "textbook", "syllabus", "reference"];

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [classLevel, setClassLevel] = useState("S4");
  const [docType, setDocType] = useState("notes");
  const [file, setFile] = useState<File | null>(null);
  const [contentText, setContentText] = useState("");
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");

  const { data: documents } = useQuery({
    queryKey: ["documents"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    if (!file && !contentText.trim()) {
      toast.error("Add a file or paste curriculum text.");
      return;
    }
    setBusy(true);
    try {
      let storagePath = `manual/${Date.now()}-${name.replace(/\s+/g, "-")}`;
      let fileSize: number | null = null;
      let text = contentText.trim();

      if (file) {
        storagePath = `${orAll(subject) ?? "all"}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("curriculum-docs")
          .upload(storagePath, file);
        if (upErr) throw upErr;
        fileSize = file.size;
        // Auto-extract text from plain-text files for the RAG knowledge base
        if (!text && /text\/|json|csv|markdown/.test(file.type)) {
          text = (await file.text()).slice(0, 50000);
        }
      }

      const { error } = await supabase.from("documents").insert({
        name: name.trim(),
        subject: orAll(subject) ?? null,
        class_level: (orAll(classLevel) ?? null) as never,
        doc_type: docType,
        storage_path: storagePath,
        file_size: fileSize,
        content_text: text || null,
        uploaded_by: user.id,
      });
      if (error) throw error;

      toast.success("Document added to the knowledge base.");
      setName("");
      setFile(null);
      setContentText("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm("Delete this document?")) return;
    if (path && !path.startsWith("manual/")) {
      await supabase.storage.from("curriculum-docs").remove([path]);
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete document.");
      return;
    }
    toast.success("Document deleted.");
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-4 font-display text-xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have access to the admin area. Contact your administrator if you believe this is
          a mistake.
        </p>
      </div>
    );
  }

  const filtered = (documents ?? []).filter(
    (d) =>
      (filterSubject === "all" || d.subject === filterSubject) &&
      (!search || d.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold">Knowledge base</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Upload curriculum documents. Pasted text becomes searchable by the AI tutor (RAG).
      </p>

      <div className="mt-10 flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Knowledge base documents</h2>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Upload form */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleUpload}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2"
        >
          <h2 className="font-display font-semibold">Add document</h2>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="S4 Algebra notes"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All subjects</SelectItem>
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
            <Label>Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>File (optional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Curriculum text (for AI / RAG)</Label>
            <Textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Paste the notes / syllabus content the tutor should learn from…"
              rows={5}
            />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Add to knowledge base
          </Button>
        </motion.form>

        {/* Documents list */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="pl-9"
              />
            </div>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                <SelectItem value={ALL}>All subjects</SelectItem>
            {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No documents yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.subject} · {d.class_level ?? "—"} · {d.doc_type}
                      {d.content_text ? " · RAG ready" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(d.id, d.storage_path)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <LinkLearning isAdmin={isAdmin} />

      <VideoLearning isAdmin={isAdmin} />

      <FileLearning isAdmin={isAdmin} />

      <AiControlPlaneAdmin />
      <AiGatewayAdmin />

      <AiObservabilityAdmin />
      <AiLimitsAdmin />
      <TournamentsAdmin />
    </div>
  );
}

/** Continuous learning: feed Crane5 web links it keeps re-reading. */
function LinkLearning({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const learn = useServerFn(learnFromLink);
  const refresh = useServerFn(refreshLinkSources);
  const [url, setUrl] = useState("");
  const [linkSubject, setLinkSubject] = useState("Mathematics");
  const [linkClass, setLinkClass] = useState("S4");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!isAdmin) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await learn({
        data: {
          url: url.trim(),
          subject: orAll(linkSubject),
          classLevel: orAll(linkClass),
          docType: "web link",
        },
      });
      toast.success(`Learned ${res.characters.toLocaleString()} characters from “${res.title}”.`);
      setUrl("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't learn from that link.");
    } finally {
      setBusy(false);
    }
  };

  const reRead = async () => {
    setRefreshing(true);
    try {
      const res = await refresh({ data: undefined });
      toast.success(`Re-read ${res.updated} of ${res.checked} link(s).`);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <LinkIcon className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Continuous learning from links</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a web page and Crane5 reads it into its knowledge base. Re-read links any time to pick
        up new content.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-card sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.ncdc.go.ug/…"
          type="url"
          required
        />
        <Select value={linkSubject} onValueChange={setLinkSubject}>
          <SelectTrigger className="sm:w-40">
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
        <Select value={linkClass} onValueChange={setLinkClass}>
          <SelectTrigger className="sm:w-24">
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
        <Button type="submit" variant="hero" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          Learn
        </Button>
      </form>
      <Button variant="outline" className="mt-3" onClick={reRead} disabled={refreshing}>
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Re-read saved links
      </Button>
    </section>
  );
}

/** Continuous learning from video links: Crane5 reads their captions. */
function VideoLearning({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const learn = useServerFn(learnFromVideo);
  const learnList = useServerFn(learnFromPlaylist);
  const [url, setUrl] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [classLevel, setClassLevel] = useState("S4");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      const clean = url.trim();
      if (/[?&]list=/.test(clean)) {
        const res = await learnList({
          data: { url: clean, subject: orAll(subject), classLevel: orAll(classLevel), limit: 15 },
        });
        toast.success(
          `Learned ${res.learned} of ${res.total} videos in that playlist${res.failed ? ` (${res.failed} skipped)` : ""}.`,
        );
      } else {
        const res = await learn({
          data: { url: clean, subject: orAll(subject), classLevel: orAll(classLevel) },
        });
        toast.success(`Learned ${res.characters.toLocaleString()} characters from “${res.title}”.`);
      }
      setUrl("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't learn from that video.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Learning from videos &amp; playlists</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste any video link — YouTube, a full playlist (?list=…), Vimeo, Khan Academy or a direct
        video file. Crane5 reads the captions when they exist, and watches the video itself when they
        don't.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-card sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Video or playlist link — https://www.youtube.com/watch?v=… or …?list=…"
          type="url"
          required
        />
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="sm:w-40">
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
        <Select value={classLevel} onValueChange={setClassLevel}>
          <SelectTrigger className="sm:w-24">
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
        <Button type="submit" variant="hero" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          Learn video
        </Button>
      </form>
    </section>
  );
}

/** Continuous learning from documents: PDFs, Word files, slides and text. */
function FileLearning({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const learn = useServerFn(learnFromFile);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(ALL);
  const [classLevel, setClassLevel] = useState(ALL);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("That file is over 15 MB. Split it or upload a smaller version.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Couldn't read that file."));
        reader.readAsDataURL(file);
      });

      const res = await learn({
        data: {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          name: title.trim() || undefined,
          subject: orAll(subject),
          classLevel: orAll(classLevel),
          docType: "notes",
        },
      });
      toast.success(`Learned ${res.characters.toLocaleString()} characters from that ${res.kind}.`);
      setFile(null);
      setTitle("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't learn from that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Learning from documents</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a PDF, Word document, slide deck or text file. Crane5 extracts the full text —
        including scanned PDFs — and adds it to its knowledge base.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-card sm:grid-cols-2"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="kfile">File</Label>
          <Input
            id="kfile"
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ktitle">Title (optional)</Label>
          <Input
            id="ktitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="NCDC Biology syllabus S1–S4"
          />
        </div>
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
        <Button type="submit" variant="hero" disabled={busy} className="sm:col-span-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Teach Crane5 this document
        </Button>
      </form>
    </section>
  );
}
