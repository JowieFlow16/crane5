import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateConversation } from "@/lib/ai.functions";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Starts (or opens) a DM conversation with another user and navigates to the
 * Messages page. Reusable across the teacher directory, community posts, etc.
 */
export function MessageButton({
  otherUserId,
  label = "Message",
  className,
  variant = "solid",
}: {
  otherUserId: string;
  label?: string;
  className?: string;
  variant?: "solid" | "ghost";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const start = useServerFn(getOrCreateConversation);
  const [busy, setBusy] = useState(false);

  if (!user || user.id === otherUserId) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const convo = (await start({ data: { otherUserId } })) as { id: string };
      navigate({ to: "/messages", search: { c: convo.id } });
    } catch {
      toast.error("Couldn't open the chat. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all disabled:opacity-60",
        variant === "solid"
          ? "bg-gradient-primary text-primary-foreground hover:opacity-90"
          : "border border-border text-foreground hover:bg-muted",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
      {label}
    </button>
  );
}
