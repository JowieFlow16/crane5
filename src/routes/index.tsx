import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  MessageCircle,
  ListChecks,
  NotebookPen,
  Sparkles,
  BookOpen,
  Atom,
  FlaskConical,
  Leaf,
  Calculator,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { PoweredByAltrastate } from "@/components/PoweredBy";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crane5 AI — AI Tutor for Ugandan NCDC Students" },
      {
        name: "description",
        content:
          "Master the Ugandan NCDC curriculum with Crane5 AI — your personal AI tutor for chat help, instant quizzes, smart revision notes and progress tracking. Free to start.",
      },
      { property: "og:title", content: "Crane5 AI — Learn smarter, the Ugandan way" },
      {
        property: "og:description",
        content:
          "AI-powered tutoring for Ugandan secondary students. Chat, quizzes and revision aligned to the NCDC curriculum.",
      },
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessageCircle,
    title: "AI Tutor Chat",
    desc: "Ask anything across Maths, Sciences and English. Step-by-step explanations in language you actually get.",
  },
  {
    icon: ListChecks,
    title: "Instant Quizzes",
    desc: "Generate MCQ or short-answer quizzes by topic and difficulty, with auto-marking and corrections.",
  },
  {
    icon: NotebookPen,
    title: "Smart Revision",
    desc: "Topic summaries, key concepts and likely exam questions — built straight from the NCDC syllabus.",
  },
  {
    icon: TrendingUp,
    title: "Progress Insights",
    desc: "Track mastery and spot weak areas so you study exactly what matters before exams.",
  },
];

const subjects = [
  { name: "Mathematics", icon: Calculator },
  { name: "Physics", icon: Atom },
  { name: "Chemistry", icon: FlaskConical },
  { name: "Biology", icon: Leaf },
  { name: "English", icon: BookOpen },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth" search={{ mode: "login" }}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="hero" size="sm">
              <Link to="/auth" search={{ mode: "register" }}>
                Get started
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pattern-kente absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Built for the Ugandan NCDC curriculum
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Your personal <span className="text-gradient">AI tutor</span> for every subject.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Crane5 AI helps Ugandan students from S1 to S6 understand tough topics, practice with
              quizzes and revise smarter — anytime, on any device.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/auth" search={{ mode: "register" }}>
                  Start learning free <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link to="/auth" search={{ mode: "login" }}>
                  I have an account
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Curriculum-grounded answers · No credit card needed
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-primary opacity-20 blur-2xl" />
            <img
              src={heroImg}
              alt="Ugandan students learning with Crane5 AI"
              width={1280}
              height={960}
              className="relative w-full rounded-3xl border border-border shadow-elegant"
            />
          </motion.div>
        </div>
      </section>

      {/* Subjects strip */}
      <section id="subjects" className="scroll-mt-20 border-y border-border bg-secondary/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-6 sm:gap-6 sm:px-6">
          {subjects.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <s.icon className="h-4 w-4 text-primary" />
              {s.name}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Everything you need to ace your exams
          </h2>
          <p className="mt-3 text-muted-foreground">
            One platform that teaches, tests and tracks — all aligned to your syllabus.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="hover-lift rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero px-6 py-14 text-center sm:px-12">
          <div className="pattern-kente absolute inset-0 opacity-30" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-primary-foreground sm:text-4xl">
              Ready to study smarter?
            </h2>
            <p className="mt-3 text-lg text-primary-foreground/85">
              Join Crane5 AI today and turn confusion into confidence.
            </p>
            <Button
              asChild
              size="xl"
              className="mt-8 bg-background text-foreground hover:bg-background/90"
            >
              <Link to="/auth" search={{ mode: "register" }}>
                Create your free account <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="mt-16 border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 lg:col-span-2">
              <Logo />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Crane5 AI is an AI-powered learning companion built around the Ugandan NCDC
                curriculum — tutoring, quizzes, revision and progress tracking in one place.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                A product of{" "}
                <span className="font-medium text-foreground">Altrastate Technologies Ltd</span>,
                Kampala, Uganda.
              </p>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Product</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="transition-colors hover:text-foreground">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#subjects" className="transition-colors hover:text-foreground">
                    Subjects
                  </a>
                </li>
                <li>
                  <Link
                    to="/auth"
                    search={{ mode: "register" }}
                    className="transition-colors hover:text-foreground"
                  >
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link
                    to="/auth"
                    search={{ mode: "login" }}
                    className="transition-colors hover:text-foreground"
                  >
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Company</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="mailto:hello@altrastate.com"
                    className="break-all transition-colors hover:text-foreground"
                  >
                    hello@altrastate.com
                  </a>
                </li>
                <li>Support: Mon–Sat, 8am–8pm EAT</li>
                <li>Kampala, Uganda</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 grid gap-4 border-t border-border pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Altrastate Technologies Ltd. Crane5 AI and the Crane5 AI
              logo are trademarks of Altrastate Technologies Ltd. All rights reserved.
            </p>
            <div className="sm:justify-self-end">
              <PoweredByAltrastate />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
