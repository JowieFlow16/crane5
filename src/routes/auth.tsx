import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { PoweredByAltrastate } from "@/components/PoweredBy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Check, School, BookOpen, Compass } from "lucide-react";
import { SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  mode: z.enum(["login", "register", "reset"]).optional(),
  next: z.string().optional(),
});

/** Only allow same-origin relative paths as a post-login redirect target. */
function safeNext(next?: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}


export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · Crane5 AI" },
      {
        name: "description",
        content: "Sign in or create your Crane5 AI account to start learning.",
      },
    ],
  }),
  component: AuthPage,
});

const CLASS_LEVELS = ["S1", "S2", "S3", "S4", "S5", "S6"];

const HEARD_OPTIONS = [
  { value: "ai", label: "From an AI assistant" },
  { value: "google", label: "Google / search" },
  { value: "friend", label: "A friend" },
  { value: "teacher", label: "My teacher" },
  { value: "school", label: "My school" },
  { value: "social", label: "Social media" },
  { value: "other", label: "Somewhere else" },
];

const STEP_LABELS = ["Your details", "Your school", "Your subjects", "How you found us"];

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "register" | "reset">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [classLevel, setClassLevel] = useState("S4");
  const [school, setSchool] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [heard, setHeard] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const next = safeNext(search.next);

  const goAfterAuth = () => {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    if (!loading && user) {
      if (next) window.location.href = next;
      else navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        goAfterAuth();
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              class_level: classLevel,
              school,
              favorite_subjects: subjects,
              referral_source: heard,
            },
            emailRedirectTo: window.location.origin + (next ?? "/dashboard"),
          },
        });
        if (error) throw error;
        // No email verification — sign the new learner straight in.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        // Persist the onboarding answers on the learner's profile.
        const { data: authed } = await supabase.auth.getUser();
        if (authed.user) {
          await supabase.from("profiles").upsert(
            {
              id: authed.user.id,
              email: authed.user.email ?? email,
              full_name: fullName,
              class_level: classLevel as never,
              school: school.trim() || null,
              favorite_subjects: subjects,
              referral_source: heard || null,
              onboarded: true,
            } as never,
            { onConflict: "id" },
          );
        }
        toast.success("Welcome to Crane5 AI!");
        goAfterAuth();

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset link sent to your email.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-hero p-12 lg:flex">
        <div className="pattern-kente absolute inset-0 opacity-30" />
        <div className="relative">
          <Logo className="[&_span]:text-primary-foreground" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-md"
        >
          <h2 className="font-display text-4xl font-bold leading-tight text-primary-foreground">
            Learn smarter, the Ugandan way.
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/85">
            Your personal AI tutor for the NCDC curriculum — chat, quizzes, revision notes and
            progress, all in one place.
          </p>
        </motion.div>
        <p className="relative text-sm text-primary-foreground/70">
          Trusted by students across Uganda · S1–S6
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-2xl font-bold">
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Create your account"
                : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to continue learning."
              : mode === "register"
                ? "Start your free learning journey."
                : "We'll email you a reset link."}
          </p>

          {mode === "register" && (
            <div className="mt-5 flex items-center gap-2">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex flex-1 flex-col gap-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-colors",
                      i <= step ? "bg-gradient-primary" : "bg-muted",
                    )}
                  />
                  {i === step && (
                    <span className="text-[0.65rem] font-medium text-muted-foreground">
                      {label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && step === 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nakato Aisha"
                  required
                />
              </div>
            )}

            {mode === "register" && step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="school" className="flex items-center gap-1.5">
                    <School className="h-3.5 w-3.5 text-primary" /> Your school
                  </Label>
                  <Input
                    id="school"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="Kampala Secondary School"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class">Your class</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {CLASS_LEVELS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setClassLevel(c)}
                        className={cn(
                          "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                          classLevel === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {mode === "register" && step === 2 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary" /> Subjects you offer
                </Label>
                <p className="text-xs text-muted-foreground">
                  We use these to build your revision timetable. Pick at least one.
                </p>
                <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border p-2.5">
                  {SUBJECTS.map((s) => {
                    const on = subjects.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setSubjects(on ? subjects.filter((x) => x !== s) : [...subjects, s])
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {on && <Check className="h-3 w-3" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "register" && step === 3 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" /> Where did you hear about Crane5?
                </Label>
                <div className="grid gap-2">
                  {HEARD_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setHeard(o.value)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
                        heard === o.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {o.label}
                      {heard === o.value && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(mode !== "register" || step === 0) && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            )}
            {mode !== "reset" && (mode !== "register" || step === 0) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            )}

            {mode === "register" ? (
              <div className="flex gap-2">
                {step > 0 && (
                  <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {step < STEP_LABELS.length - 1 ? (
                  <Button
                    type="button"
                    variant="hero"
                    className="flex-1"
                    onClick={() => {
                      if (step === 0 && (!fullName.trim() || !email.trim() || password.length < 6)) {
                        toast.error("Add your name, email and a password of 6+ characters.");
                        return;
                      }
                      if (step === 2 && subjects.length === 0) {
                        toast.error("Pick at least one subject.");
                        return;
                      }
                      setStep(step + 1);
                    }}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" variant="hero" className="flex-1" disabled={busy || !heard}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                )}
              </div>
            ) : (
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Send reset link"}
              </Button>
            )}
          </form>


          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  onClick={() => setMode("register")}
                  className="font-semibold text-primary hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
          <div className="mt-6 flex justify-center border-t border-border pt-4">
            <PoweredByAltrastate />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
