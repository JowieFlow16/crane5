import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert, Check, X, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { listReports, setReportStatus, type ContentReport } from "@/lib/moderation";
import { cn } from "@/lib/utils";

const FILTERS: { key: "open" | "all"; label: string }[] = [
  { key: "open", label: "Needs review" },
  { key: "all", label: "All reports" },
];

const STATUS_STYLE: Record<ContentReport["status"], string> = {
  open: "bg-destructive/10 text-destructive",
  reviewing: "bg-amber-500/10 text-amber-600",
  actioned: "bg-primary/10 text-primary",
  dismissed: "bg-muted text-muted-foreground",
};

export function ModerationQueue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["moderation-reports"],
    queryFn: listReports,
  });

  const rows = (reports ?? []).filter((r) =>
    filter === "open" ? r.status === "open" || r.status === "reviewing" : true,
  );

  const act = async (r: ContentReport, status: ContentReport["status"]) => {
    if (!user) return;
    setBusy(r.id);
    try {
      await setReportStatus(r.id, status, user.id, notes[r.id]);
      toast.success(`Report marked ${status}.`);
      await qc.invalidateQueries({ queryKey: ["moderation-reports"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that report.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Moderation queue</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Reports students send about messages, posts or people. Review each one and record the
        outcome.
      </p>

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing to review — the community is clean right now.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase",
                    STATUS_STYLE[r.status],
                  )}
                >
                  {r.status}
                </span>
                <span className="text-sm font-medium">{r.reason}</span>
                <span className="text-xs text-muted-foreground">· {r.target_type}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>

              {r.excerpt && (
                <p className="mt-2 rounded-xl bg-muted/60 p-2.5 text-sm italic">“{r.excerpt}”</p>
              )}
              {r.details && <p className="mt-2 text-sm text-muted-foreground">{r.details}</p>}
              {r.admin_note && (
                <p className="mt-2 text-xs text-muted-foreground">Note: {r.admin_note}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Moderator note (optional)"
                  className="h-9 min-w-[180px] flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => act(r, "reviewing")}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> Reviewing
                </Button>
                <Button size="sm" disabled={busy === r.id} onClick={() => act(r, "actioned")}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Actioned
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === r.id}
                  onClick={() => act(r, "dismissed")}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
