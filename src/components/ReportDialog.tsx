import { useState } from "react";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { REPORT_REASONS, reportContent, type ReportTargetType } from "@/lib/moderation";

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  reportedUserId,
  excerpt,
  subjectName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: ReportTargetType;
  targetId?: string | null;
  reportedUserId?: string | null;
  excerpt?: string | null;
  subjectName?: string | null;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await reportContent({
        reporterId: user.id,
        reportedUserId,
        targetType,
        targetId,
        reason,
        details,
        excerpt,
      });
      toast.success("Report sent to the Crane5 moderation team. Thank you for keeping it safe.");
      setDetails("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" /> Report{" "}
            {subjectName ? subjectName : "content"}
          </DialogTitle>
          <DialogDescription>
            Reports are private and reviewed by Crane5 moderators. Misuse of reporting may limit
            your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdetails">What happened? (optional)</Label>
            <Textarea
              id="rdetails"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add anything a moderator should know…"
              className="min-h-[90px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
