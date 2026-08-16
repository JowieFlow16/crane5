import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  Gift,
  Share2,
  Copy,
  Loader2,
  Infinity as InfinityIcon,
  MessageCircle,
  Users,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMyAiUsage } from "@/lib/usage.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Earn Credits · Crane5 AI" },
      {
        name: "description",
        content:
          "Share Crane5 AI with friends to earn extra daily AI credits for tutoring, quizzes and revision.",
      },
      { property: "og:title", content: "Earn Credits · Crane5 AI" },
      {
        property: "og:description",
        content: "Every 3 friends you share Crane5 with earns you 5 more AI credits today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreditsPage,
});

const SITE = "https://crane5.com";
const PITCH = `I'm using Crane5 AI — a Ugandan AI tutor for the NCDC syllabus (S1–S6). It explains topics, sets quizzes and builds revision timetables. Try it: ${SITE}`;

function Bar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-destructive" : "bg-gradient-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CreditsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchUsage = useServerFn(getMyAiUsage);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage", user?.id],
    enabled: !!user,
    queryFn: () => fetchUsage(),
  });

  /** Log a share; every 3 shares in a day unlocks +5 AI credits. */
  const logShare = async (channel: string) => {
    setBusy(true);
    try {
      const { error } = await db.rpc("record_app_share", { p_channel: channel });
      if (error) throw new Error("share failed");
      await qc.invalidateQueries({ queryKey: ["ai-usage", user?.id] });
      toast.success("Share counted! Keep going to unlock +5 credits 🎉");
    } catch {
      toast.error("Couldn't count that share. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Crane5 AI", text: PITCH, url: SITE });
      } else {
        await navigator.clipboard.writeText(PITCH);
        toast.success("Message copied — paste it to a friend.");
      }
      await logShare("native");
    } catch {
      /* user cancelled — don't count it */
    }
  };

  const shareWhatsApp = async () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(PITCH)}`, "_blank", "noopener");
    await logShare("whatsapp");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(SITE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await logShare("copy");
  };

  const shares = data?.shares_today ?? 0;
  const toNext = data?.shares_to_next_bonus ?? 3;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Earn extra credits</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        You get a free daily allowance of AI credits. Share Crane5 with 3 friends and you instantly
        earn <span className="font-semibold text-foreground">+5 more</span> — as many times as you
        like, every day.
      </p>

      {/* Allowance */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        {isLoading || !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your credits…
          </div>
        ) : data.unlimited ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <InfinityIcon className="h-4 w-4 text-primary" /> Your account has unlimited AI credits.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Credits used today</span>
              <span className="font-display text-lg font-bold">
                {data.requests_today} / {data.request_limit}
              </span>
            </div>
            <div className="mt-2">
              <Bar used={data.requests_today} limit={data.request_limit} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                Base {data.base_request_limit}
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                Earned +{data.bonus_requests}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                {data.plan} plan
              </span>
            </div>
          </>
        )}
      </motion.section>

      {/* Share to earn */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Share to earn</h2>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                shares % 3 > i || (shares > 0 && shares % 3 === 0)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-dashed border-border text-muted-foreground",
              )}
            >
              {shares % 3 > i || (shares > 0 && shares % 3 === 0) ? (
                <Check className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </span>
          ))}
          <p className="ml-2 text-sm text-muted-foreground">
            {shares} share{shares === 1 ? "" : "s"} today · {toNext} more for +5 credits
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="hero" onClick={shareNative} disabled={busy}>
            <Share2 className="h-4 w-4" /> Share with a friend
          </Button>
          <Button variant="outline" onClick={shareWhatsApp} disabled={busy}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={copyLink} disabled={busy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy link
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Your credits are yours alone — sharing never takes credits from anyone else. Bonus credits
          reset with your daily allowance, so you can earn again tomorrow.
        </p>
      </motion.section>
    </div>
  );
}
