import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Swords, ChevronRight, Timer, Users } from "lucide-react";
import { listTournaments } from "@/lib/tournaments.functions";
import { cn } from "@/lib/utils";

function untilLabel(iso: string, prefix: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${prefix} ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${prefix} ${h}h`;
  return `${prefix} ${Math.floor(h / 24)}d`;
}

/**
 * In-app marketing strip: surfaces any live or upcoming tournament so students
 * are invited to compete wherever they are in Crane5.
 */
export function TournamentPromo({ className }: { className?: string }) {
  const fetchList = useServerFn(listTournaments);
  const { data } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => fetchList(),
    refetchInterval: 120_000,
  });

  const t =
    (data ?? []).find((x) => x.status === "live") ?? (data ?? []).find((x) => x.status === "pending");
  if (!t) return null;

  const live = t.status === "live";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/40 bg-primary/5 p-4 shadow-card",
        className,
      )}
    >
      <Link to="/tournaments" className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Swords className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            {live ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Tournament live
              </>
            ) : (
              "Tournament starting soon"
            )}
          </p>
          <p className="truncate text-sm font-semibold">{t.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {live ? untilLabel(t.ends_at, "closes in") : untilLabel(t.starts_at, "starts in")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {t.players} competing
            </span>
            <span>
              Top {t.winners_count} win {t.prize_credits} credits
            </span>
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
      </Link>
    </motion.div>
  );
}
