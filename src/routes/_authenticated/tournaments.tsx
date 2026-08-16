import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
  Loader2,
  ChevronRight,
  Medal,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listTournaments,
  getTournamentRound,
  getTournamentStandings,
  submitTournamentAnswers,
  type TournamentRow,
  type StandingRow,
} from "@/lib/tournaments.functions";
import { Button } from "@/components/ui/button";
import { MessageButton } from "@/components/MessageButton";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments · Crane5 AI" },
      {
        name: "description",
        content:
          "Compete in Crane5 AI tournaments — quick quizzes and fastest-learner races. Top 5 winners earn 10 free credits and climb the leaderboard.",
      },
      { property: "og:title", content: "Crane5 AI Tournaments" },
      {
        property: "og:description",
        content: "Quick-quiz battles for Ugandan students. Win credits, climb the leaderboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentsPage,
});

const KIND_LABEL: Record<string, string> = {
  quick_quiz: "Quick Quiz",
  fastest_learner: "Fastest Learner",
  subject_clash: "Subject Clash",
};

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

function StatusPill({ status }: { status: TournamentRow["status"] }) {
  const map = {
    live: { label: "Live now", cls: "bg-emerald-500/15 text-emerald-500" },
    pending: { label: "Starting soon", cls: "bg-amber-500/15 text-amber-500" },
    ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
  } as const;
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        s.cls,
      )}
    >
      {status === "live" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {s.label}
    </span>
  );
}

function TournamentsPage() {
  const fetchList = useServerFn(listTournaments);
  const [playing, setPlaying] = useState<TournamentRow | null>(null);
  const [boardFor, setBoardFor] = useState<TournamentRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => fetchList(),
    refetchInterval: 60_000,
  });

  const groups = useMemo(() => {
    const rows = data ?? [];
    return {
      live: rows.filter((r) => r.status === "live"),
      pending: rows.filter((r) => r.status === "pending"),
      ended: rows.filter((r) => r.status === "ended"),
    };
  }, [data]);

  if (playing) {
    return <PlayRound tournament={playing} onDone={() => setPlaying(null)} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Swords className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Tournaments</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Race other Crane5 students in timed quiz battles. The top 5 of every tournament earn{" "}
        <span className="font-semibold text-foreground">10 free credits</span> plus XP that lifts
        their leaderboard rank.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          No tournaments yet. Crane5 will announce the next one right here — keep revising so you're
          ready.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {(["live", "pending", "ended"] as const).map((key) =>
            groups[key].length === 0 ? null : (
              <section key={key}>
                <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {key === "live" ? (
                    <Zap className="h-4 w-4 text-emerald-500" />
                  ) : key === "pending" ? (
                    <CalendarClock className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {key === "live" ? "Happening now" : key === "pending" ? "Coming up" : "Finished"}
                </h2>
                <div className="mt-3 space-y-3">
                  {groups[key].map((t, i) => (
                    <TournamentCard
                      key={t.id}
                      t={t}
                      delay={i * 0.03}
                      onPlay={() => setPlaying(t)}
                      onBoard={() => setBoardFor(t)}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      <AnimatePresence>
        {boardFor && <Standings tournament={boardFor} onClose={() => setBoardFor(null)} />}
      </AnimatePresence>
    </div>
  );
}

function TournamentCard({
  t,
  delay,
  onPlay,
  onBoard,
}: {
  t: TournamentRow;
  delay: number;
  onPlay: () => void;
  onBoard: () => void;
}) {
  const played = t.my_score !== null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-card",
        t.status === "live" ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={t.status} />
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {KIND_LABEL[t.kind] ?? t.kind}
          </span>
          {t.subject && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {t.subject}
            </span>
          )}
          {t.class_level && (
            <span className="text-xs text-muted-foreground">{t.class_level}</span>
          )}
        </div>

        <h3 className="mt-3 font-display text-lg font-bold">{t.title}</h3>
        {t.description && (
          <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" /> {t.question_count} Qs ·{" "}
            {t.seconds_per_question}s each
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {t.players} competing
          </span>
          <span className="inline-flex items-center gap-1 text-primary">
            <Trophy className="h-3.5 w-3.5" /> Top {t.winners_count} win {t.prize_credits} credits +{" "}
            {t.prize_xp} XP
          </span>
          <span>
            {t.status === "pending"
              ? `Starts in ${countdown(t.starts_at)}`
              : t.status === "live"
                ? `Closes in ${countdown(t.ends_at)}`
                : `Ended ${new Date(t.ends_at).toLocaleDateString()}`}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {t.status === "live" && (
            <Button onClick={onPlay} className="rounded-full">
              {played ? "Improve my score" : "Join now"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" className="rounded-full" onClick={onBoard}>
            <Medal className="mr-1 h-4 w-4" /> Standings
          </Button>
          {played && (
            <span className="text-xs font-medium text-muted-foreground">
              Your score: {t.my_score}
              {t.my_rank ? ` · rank #${t.my_rank}` : ""}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function PlayRound({ tournament, onDone }: { tournament: TournamentRow; onDone: () => void }) {
  const qc = useQueryClient();
  const loadRound = useServerFn(getTournamentRound);
  const submit = useServerFn(submitTournamentAnswers);
  const [answers, setAnswers] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [sending, setSending] = useState(false);
  const startedAt = useRef(Date.now());

  const { data: round, isLoading, error } = useQuery({
    queryKey: ["tournament-round", tournament.id],
    queryFn: () => loadRound({ data: { id: tournament.id } }),
    retry: false,
  });

  useEffect(() => {
    if (round) setLeft(round.seconds_per_question);
  }, [round, i]);

  const finish = async (final: string[]) => {
    setSending(true);
    try {
      const res = await submit({
        data: { id: tournament.id, answers: final, timeMs: Date.now() - startedAt.current },
      });
      setResult(res);
      await qc.invalidateQueries({ queryKey: ["tournaments"] });
    } catch {
      toast.error("Couldn't submit your result. Try again.");
    } finally {
      setSending(false);
    }
  };

  const choose = (opt: string) => {
    if (!round) return;
    const next = [...answers];
    next[i] = opt;
    setAnswers(next);
    if (i + 1 < round.questions.length) setI(i + 1);
    else finish(next);
  };

  // Per-question countdown; running out auto-advances with no answer.
  useEffect(() => {
    if (!round || result) return;
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          if (i + 1 < round.questions.length) setI(i + 1);
          else finish(answers);
          return round.seconds_per_question;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, i, result]);

  if (isLoading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (error || !round)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          This round isn't available right now.
        </p>
        <Button className="mt-4 rounded-full" onClick={onDone}>
          Back to tournaments
        </Button>
      </div>
    );

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Trophy className="mx-auto h-14 w-14 text-primary" />
        </motion.div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          {result.score}/{result.total} correct
        </h1>
        <p className="mt-1 text-muted-foreground">
          {pct >= 80
            ? "Elite run — you're in contention for the top 5! 🔥"
            : pct >= 50
              ? "Solid. Sharpen up and try again before the round closes."
              : "Good effort. Revise the topic and come back stronger."}
        </p>
        <Button className="mt-6 rounded-full" onClick={onDone}>
          See standings
        </Button>
      </div>
    );
  }

  const q = round.questions[i]!;
  const pct = Math.round(((i + 1) / round.questions.length) * 100);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{round.title}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold",
            left <= 5 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
          )}
        >
          <Timer className="h-4 w-4" /> {left}s
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Question {i + 1} of {round.questions.length}
        </p>
        <h2 className="mt-2 font-display text-lg font-bold">{q.question}</h2>
        <div className="mt-4 space-y-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              disabled={sending}
              onClick={() => choose(opt)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-60"
            >
              {opt}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function Standings({
  tournament,
  onClose,
}: {
  tournament: TournamentRow;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const fetchBoard = useServerFn(getTournamentStandings);
  const { data, isLoading } = useQuery({
    queryKey: ["tournament-standings", tournament.id],
    queryFn: () => fetchBoard({ data: { id: tournament.id } }),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center gap-2">
          <Medal className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">{tournament.title}</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Top {tournament.winners_count} earn {tournament.prize_credits} credits +{" "}
          {tournament.prize_xp} XP{tournament.finalized_at ? " · rewards paid out" : ""}
        </p>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No entries yet — be the first on the board.
            </p>
          ) : (
            (data as StandingRow[]).map((s, idx) => {
              const me = s.user_id === user?.id;
              return (
                <div
                  key={s.user_id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3",
                    me ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {s.rank ?? idx + 1}
                  </span>
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                      {(s.display_name ?? "S").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.display_name ?? "Student"} {me && <span className="text-primary">(You)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.score}/{s.total} · {(s.time_ms / 1000).toFixed(0)}s
                      {s.awarded_credits > 0 ? ` · +${s.awarded_credits} credits` : ""}
                    </p>
                  </div>
                  {!me && <MessageButton otherUserId={s.user_id} label="" variant="ghost" />}
                </div>
              );
            })
          )}
        </div>

        <Button variant="outline" className="mt-5 w-full rounded-full" onClick={onClose}>
          Close
        </Button>
      </motion.div>
    </motion.div>
  );
}
