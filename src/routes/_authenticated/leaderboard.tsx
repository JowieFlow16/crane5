import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Trophy, Flame, Crown, Medal, Gift, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { db, type LeaderboardRow } from "@/lib/db";
import { claimTopRankBonus } from "@/lib/tournaments.functions";
import { MessageButton } from "@/components/MessageButton";
import { TournamentPromo } from "@/components/TournamentPromo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Top 10 Leaderboard · Crane5 AI" },
      {
        name: "description",
        content:
          "The top 10 hardest-working Crane5 AI students. Finish in the top 5 to earn 10 free AI credits every day.",
      },
      { property: "og:title", content: "Crane5 AI Top 10" },
      {
        property: "og:description",
        content: "Climb the Crane5 top 10 — the top 5 earn 10 free credits daily.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function initials(name: string | null) {
  return (name ?? "S").charAt(0).toUpperCase();
}

const PODIUM = [
  { ring: "ring-amber-400/60", text: "text-amber-400", label: "1st" },
  { ring: "ring-zinc-300/60", text: "text-zinc-300", label: "2nd" },
  { ring: "ring-amber-700/60", text: "text-amber-700", label: "3rd" },
];

function LeaderboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const claim = useServerFn(claimTopRankBonus);
  const [claiming, setClaiming] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["leaderboard-top10"],
    queryFn: async () => {
      const { data } = await db
        .from("leaderboard")
        .select("user_id, full_name, avatar_url, class_level, xp, level, current_streak")
        .order("xp", { ascending: false })
        .limit(10);
      return (data as LeaderboardRow[]) ?? [];
    },
  });

  const list = rows ?? [];
  const myIndex = list.findIndex((r) => r.user_id === user?.id);
  const inTop5 = myIndex >= 0 && myIndex < 5;

  const onClaim = async () => {
    setClaiming(true);
    try {
      const res = await claim();
      if (res.granted) {
        toast.success(`Top ${res.rank} reward unlocked — +${res.amount} credits added today! 🎉`);
        await qc.invalidateQueries({ queryKey: ["ai-usage", user?.id] });
      } else if (res.reason === "already_claimed") {
        toast.info("You've already collected today's top-5 reward. Come back tomorrow.");
      } else {
        toast.info("Reach the top 5 to unlock 10 free credits a day.");
      }
    } catch {
      toast.error("Couldn't collect the reward right now.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Top 10</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        The ten hardest-working learners on Crane5 AI. The{" "}
        <span className="font-semibold text-foreground">top 5 earn 10 free credits every day</span> —
        tap a student to message them and study together.
      </p>

      <TournamentPromo className="mt-5" />

      {/* Daily top-5 reward */}
      <div
        className={cn(
          "mt-5 flex flex-wrap items-center gap-3 rounded-2xl border p-4",
          inTop5 ? "border-primary/50 bg-primary/5" : "border-dashed border-border",
        )}
      >
        <Gift className={cn("h-5 w-5", inTop5 ? "text-primary" : "text-muted-foreground")} />
        <p className="min-w-0 flex-1 text-sm">
          {inTop5 ? (
            <>
              You're <span className="font-semibold">#{myIndex + 1}</span> — collect your 10 free
              credits for today.
            </>
          ) : (
            <>Break into the top 5 to unlock 10 bonus credits daily.</>
          )}
        </p>
        <Button
          onClick={onClaim}
          disabled={claiming || !inTop5}
          className="rounded-full"
          size="sm"
        >
          {claiming ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          Collect +10
        </Button>
      </div>

      {/* Podium */}
      {list.length >= 3 && (
        <div className="mt-6 grid grid-cols-3 items-end gap-3">
          {[1, 0, 2].map((pos) => {
            const r = list[pos]!;
            const style = PODIUM[pos]!;
            const height = pos === 0 ? "h-28" : pos === 1 ? "h-24" : "h-20";
            return (
              <motion.div
                key={r.user_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pos * 0.05 }}
                className="flex flex-col items-center"
              >
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt=""
                    className={cn("h-12 w-12 rounded-full object-cover ring-2", style.ring)}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-base font-bold text-primary-foreground ring-2",
                      style.ring,
                    )}
                  >
                    {initials(r.full_name)}
                  </div>
                )}
                <p className="mt-2 w-full truncate text-center text-xs font-semibold">
                  {r.full_name ?? "Student"}
                </p>
                <div
                  className={cn(
                    "mt-1 flex w-full flex-col items-center justify-center rounded-t-2xl border border-b-0 border-border bg-card",
                    height,
                  )}
                >
                  {pos === 0 ? (
                    <Crown className={cn("h-5 w-5", style.text)} />
                  ) : (
                    <Medal className={cn("h-5 w-5", style.text)} />
                  )}
                  <span className={cn("mt-1 font-display text-sm font-bold", style.text)}>
                    {style.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.xp} XP</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Crown className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No scores yet. Be the first — ask the tutor, take a quiz or join a tournament!
          </div>
        ) : (
          list.map((r, i) => {
            const me = r.user_id === user?.id;
            const rewarded = i < 5;
            return (
              <motion.div
                key={r.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card",
                  me ? "border-primary ring-1 ring-primary/40" : "border-border",
                )}
              >
                <div className="flex w-7 shrink-0 justify-center">
                  <span
                    className={cn(
                      "font-display text-sm font-bold",
                      i < 3 ? PODIUM[i]!.text : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                </div>
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                    {initials(r.full_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.full_name ?? "Student"} {me && <span className="text-primary">(You)</span>}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    Level {r.level}
                    {r.class_level ? ` · ${r.class_level}` : ""}
                    {rewarded && <span className="text-primary">· +10 credits/day</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 text-orange-500">
                    <Flame className="h-4 w-4" /> {r.current_streak}
                  </span>
                  <span className="font-display font-bold">{r.xp} XP</span>
                  {!me && <MessageButton otherUserId={r.user_id} label="" variant="ghost" />}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
