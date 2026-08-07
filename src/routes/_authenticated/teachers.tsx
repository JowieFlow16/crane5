import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  GraduationCap,
  Search,
  School,
  BadgeCheck,
  Sparkles,
  Users,
  Star,
} from "lucide-react";
import { db, type TeacherProfile } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { SUBJECTS } from "@/lib/subjects";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/Markdown";
import { MessageButton } from "@/components/MessageButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "Find a Teacher · Crane5 AI" },
      {
        name: "description",
        content: "Connect with verified Ugandan teachers for one-on-one help across every NCDC subject.",
      },
    ],
  }),
  component: TeachersPage,
});

function Avatar({ url, name, size = 56 }: { url?: string | null; name?: string | null; size?: number }) {
  return url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-2xl object-cover" />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-lg font-bold text-primary-foreground"
    >
      {(name ?? "T").charAt(0).toUpperCase()}
    </div>
  );
}

function TeachersPage() {
  const { isTeacher } = useAuth();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<string | null>(null);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teacher-directory"],
    queryFn: async (): Promise<TeacherProfile[]> => {
      const { data } = await db
        .from("teacher_profiles")
        .select("*")
        .eq("status", "approved")
        .order("students_helped", { ascending: false });
      return (data as TeacherProfile[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (teachers ?? []).filter((t) => {
      const matchSubject = !subject || t.subjects?.includes(subject);
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (t.full_name ?? "").toLowerCase().includes(q) ||
        (t.school ?? "").toLowerCase().includes(q) ||
        (t.headline ?? "").toLowerCase().includes(q) ||
        (t.subjects ?? []).some((s) => s.toLowerCase().includes(q));
      return matchSubject && matchSearch;
    });
  }, [teachers, subject, search]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Find a Teacher</h1>
        </div>
        {!isTeacher && (
          <Link
            to="/teach"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Sparkles className="h-4 w-4" /> Become a teacher
          </Link>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Verified Ugandan teachers ready to help you 1-on-1. Pick a subject, then say hello. 🇺🇬
      </p>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, school or subject…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSubject(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !subject ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            All subjects
          </button>
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s === subject ? null : s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                s === subject ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No verified teachers here yet{subject ? ` for ${subject}` : ""}. Check back soon!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <Avatar url={t.avatar_url} name={t.full_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-display font-semibold">{t.full_name ?? "Teacher"}</span>
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                    {t.headline && <p className="truncate text-sm text-muted-foreground">{t.headline}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {t.school && (
                        <span className="inline-flex items-center gap-1">
                          <School className="h-3.5 w-3.5" /> {t.school}
                        </span>
                      )}
                      <span>{t.experience_years} yr{t.experience_years === 1 ? "" : "s"} exp</span>
                      {t.students_helped > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" /> {t.students_helped} helped
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {t.bio && (
                  <div className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                    <Markdown>{t.bio}</Markdown>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(t.subjects ?? []).slice(0, 5).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.7rem] font-medium text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <MessageButton otherUserId={t.id} label="Ask for help" />
                  {t.class_levels?.length > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t.class_levels.join(", ")}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
