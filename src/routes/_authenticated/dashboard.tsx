import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  MessageCircle,
  ListChecks,
  NotebookPen,
  Flame,
  Trophy,
  Target,
  ArrowRight,
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Omicron AI" }] }),
  component: Dashboard,
});

const subjectIcons: Record<string, LucideIcon> = {
  Mathematics: Calculator,
  Physics: Atom,
  Chemistry: FlaskConical,
  Biology: Leaf,
  English: BookOpen,
};

function Dashboard() {
  const { user, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [chats, results, progress] = await Promise.all([
        supabase.from("chats").select("id", { count: "exact", head: true }),
        supabase.from("quiz_results").select("score, total, weak_areas"),
        supabase.from("progress").select("subject, topic, mastery").order("mastery"),
      ]);
      const res = results.data ?? [];
      const totalScore = res.reduce((a, r) => a + r.score, 0);
      const totalPossible = res.reduce((a, r) => a + r.total, 0);
      const avg = totalPossible ? Math.round((totalScore / totalPossible) * 100) : 0;
      const weak = Array.from(
        new Set(res.flatMap((r) => r.weak_areas ?? [])),
      ).slice(0, 4);
      return {
        chatCount: chats.count ?? 0,
        quizzesTaken: res.length,
        avgScore: avg,
        weakAreas: weak,
        progress: progress.data ?? [],
      };
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*").order("name");
      return data ?? [];
    },
  });

  const firstName = (profile?.full_name ?? "there").split(" ")[0];

  const statCards = [
    { label: "Conversations", value: stats?.chatCount ?? 0, icon: MessageCircle },
    { label: "Quizzes taken", value: stats?.quizzesTaken ?? 0, icon: ListChecks },
    { label: "Average score", value: `${stats?.avgScore ?? 0}%`, icon: Trophy },
    { label: "Day streak", value: 1, icon: Flame },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 sm:p-8"
      >
        <div className="pattern-kente absolute inset-0 opacity-25" />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl">
            Hello, {firstName}! 👋
          </h1>
          <p className="mt-1 max-w-lg text-primary-foreground/85">
            Ready to learn something new today? Ask your AI tutor, take a quiz, or revise a topic.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
              <Link to="/chat">
                <MessageCircle className="h-4 w-4" /> Ask Omicron AI
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20">
              <Link to="/quiz">
                <ListChecks className="h-4 w-4" /> Take a quiz
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-3xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Subjects */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Explore subjects</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(subjects ?? []).map((subj, i) => {
              const Icon = subjectIcons[subj.name] ?? BookOpen;
              return (
                <motion.div
                  key={subj.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Link
                    to="/chat"
                    search={{ subject: subj.name }}
                    className="hover-lift group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold">{subj.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {subj.description}
                      </p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Weak areas / focus */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <h2 className="font-display text-lg font-semibold">Focus areas</h2>
            </div>
            {stats?.weakAreas && stats.weakAreas.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {stats.weakAreas.map((w) => (
                  <li key={w}>
                    <p className="mb-1 text-sm font-medium">{w}</p>
                    <Progress value={40} className="h-1.5" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Take a few quizzes and we'll highlight what to focus on. 💪
              </p>
            )}
            <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
              <Link to="/revision">
                <NotebookPen className="h-4 w-4" /> Start revising
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
