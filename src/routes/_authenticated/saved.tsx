import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Bookmark,
  Trash2,
  MessageSquareText,
  NotebookPen,
  ListChecks,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db, type Bookmark as BookmarkRow } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Library · Crane5 AI" }] }),
  component: SavedPage,
});

const kindMeta: Record<string, { icon: typeof FileText; label: string }> = {
  answer: { icon: MessageSquareText, label: "Tutor answer" },
  revision: { icon: NotebookPen, label: "Revision" },
  quiz: { icon: ListChecks, label: "Quiz" },
  note: { icon: FileText, label: "Note" },
};

function SavedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("bookmarks")
        .select("*")
        .order("created_at", { ascending: false });
      return (data as BookmarkRow[]) ?? [];
    },
  });

  const remove = async (id: string) => {
    await db.from("bookmarks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
    toast.success("Removed from library");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Bookmark className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">My Library</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Everything you've saved — answers, revision notes and more, in one place.
      </p>

      <div className="mt-6 space-y-3">
        {(items ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Bookmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            Nothing saved yet. Tap “Save” on any tutor answer or revision note.
          </div>
        ) : (
          (items ?? []).map((it, i) => {
            const meta = kindMeta[it.kind] ?? kindMeta.note;
            const Icon = meta.icon;
            return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                    {it.subject ? ` · ${it.subject}` : ""}
                  </span>
                  <button
                    onClick={() => remove(it.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm">
                  <Markdown>{it.content}</Markdown>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
