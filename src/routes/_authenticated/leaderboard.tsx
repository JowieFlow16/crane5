import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Trophy, Flame, Crown, Medal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db, type LeaderboardRow } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard · Omicron AI" }] }),
  component: LeaderboardPage,
});

const rankColor = ["text-amber-400", "text-zinc-400", "text-amber-700"];

function initials(name: string | null) {
  return (name ?? "S").charAt(0).toUpperCase();
}

function LeaderboardPage() {
  const { user } = useAuth();

  const { data: rows } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await db
        .from("leaderboard")
        .select("*")
        .order("xp", { ascending: false })
        .limit(50);
      return (data as LeaderboardRow[]) ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Leaderboard</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        The hardest-working learners on Omicron AI this season. Earn XP to climb! 🚀
      </p>

      <div className="mt-6 space-y-2">
        {(rows ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Crown className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No scores yet. Be the first — ask the tutor, take a quiz or review flashcards!
          </div>
        ) : (
          (rows ?? []).map((r, i) => {
            const me = r.user_id === user?.id;
            return (
              <motion.div
                key={r.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card",
                  me ? "border-primary ring-1 ring-primary/40" : "border-border",
                )}
              >
                <div className="flex w-7 shrink-0 justify-center">
                  {i < 3 ? (
                    <Medal className={cn("h-5 w-5", rankColor[i])} />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                    {initials(r.full_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.full_name ?? "Student"} {me && <span className="text-primary">(You)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Level {r.level}{r.class_level ? ` · ${r.class_level}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-orange-500">
                    <Flame className="h-4 w-4" /> {r.current_streak}
                  </span>
                  <span className="font-display font-bold">{r.xp} XP</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
