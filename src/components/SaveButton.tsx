import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SaveButtonProps {
  kind: "answer" | "revision" | "quiz" | "note";
  content: string;
  title?: string | null;
  subject?: string | null;
  className?: string;
  label?: string;
}

export function SaveButton({
  kind,
  content,
  title,
  subject,
  className,
  label = "Save",
}: SaveButtonProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!user || busy || saved) return;
    setBusy(true);
    const { error } = await db.from("bookmarks").insert({
      user_id: user.id,
      kind,
      title: title ?? content.slice(0, 60),
      subject: subject ?? null,
      content,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    setSaved(true);
    toast.success("Saved to your library 📚");
  };

  return (
    <button
      onClick={save}
      disabled={busy || saved}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-70",
        saved && "border-success/40 text-success",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="h-3.5 w-3.5" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      {saved ? "Saved" : label}
    </button>
  );
}
