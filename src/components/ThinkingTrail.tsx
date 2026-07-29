import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Sparkles } from "lucide-react";

export interface TrailStep {
  /** Text shown to the learner. */
  label: string;
  /** Milliseconds after the request started when this step begins. */
  at: number;
}

function buildSteps(subject: string | undefined, hasAttachments: boolean): TrailStep[] {
  const topic = subject ? subject : "the topic";
  const steps: TrailStep[] = [];
  let t = 0;
  const push = (label: string, gap: number) => {
    steps.push({ label, at: t });
    t += gap;
  };

  push("Parsing your question", 350);
  if (hasAttachments) push("Scanning your attachments", 500);
  push(`Mapping the ${topic} concepts`, 450);
  push("Pulling NCDC curriculum notes", 600);
  push("Cross-checking Ugandan examples", 650);
  push("Linking the ideas together", 700);
  push("Reasoning step by step", 1200);
  push("Composing your answer", 2000);
  push("Final polish", 60_000);
  return steps;
}

/**
 * Live "what Omicron is doing right now" trail. Instead of anonymous typing
 * bubbles, learners see each stage of the reasoning as it happens, with
 * completed stages ticked off.
 */
export function ThinkingTrail({
  subject,
  hasAttachments = false,
  className,
}: {
  subject?: string;
  hasAttachments?: boolean;
  className?: string;
}) {
  const [steps] = useState(() => buildSteps(subject, hasAttachments));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      let next = 0;
      for (let i = 0; i < steps.length; i++) {
        if (elapsed >= steps[i].at) next = i;
      }
      setIndex(next);
    }, 80);
    return () => clearInterval(id);
  }, [steps]);

  // Show the current step plus the two before it, so the panel stays compact.
  const visible = steps.slice(Math.max(0, index - 2), index + 1);

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
        {/* Sweeping shimmer to signal live activity */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary/15 to-transparent"
          animate={{ x: ["0%", "400%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        />
        <div className="relative space-y-1.5">
          <AnimatePresence initial={false}>
            {visible.map((s, i) => {
              const isCurrent = i === visible.length - 1;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: isCurrent ? 1 : 0.45, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 text-sm"
                >
                  {isCurrent ? (
                    <motion.span
                      className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </motion.span>
                  ) : (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                  <span
                    className={
                      isCurrent
                        ? "bg-gradient-to-r from-primary via-foreground to-primary bg-[length:200%_100%] bg-clip-text font-medium text-transparent"
                        : "text-muted-foreground"
                    }
                    style={
                      isCurrent
                        ? { animation: "omicron-shimmer 1.6s linear infinite" }
                        : undefined
                    }
                  >
                    {s.label}
                    {isCurrent && <AnimatedDots />}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function AnimatedDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);
  return <span className="inline-block w-4 text-left">{".".repeat(n)}</span>;
}

/** Brief "Done 👍" confirmation shown right after an answer lands. */
export function DoneFlash() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-1.5 text-xs font-medium text-primary"
    >
      <Check className="h-3.5 w-3.5" /> Done 👍
    </motion.div>
  );
}
