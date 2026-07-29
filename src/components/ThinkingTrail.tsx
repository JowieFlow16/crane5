import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Loader2 } from "lucide-react";

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

  push("Reading your question", 700);
  if (hasAttachments) push("Looking at what you attached", 1100);
  push(`Identifying the ${topic} concepts involved`, 900);
  push("Searching the NCDC curriculum notes", 1400);
  push("Searching the Ugandan web for real examples", 1600);
  push("Connecting the ideas", 1500);
  push("Working through it step by step", 2600);
  push("Almost done", 4000);
  push("Polishing the explanation", 60_000);
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
    }, 150);
    return () => clearInterval(id);
  }, [steps]);

  // Show the current step plus the two before it, so the panel stays compact.
  const visible = steps.slice(Math.max(0, index - 2), index + 1);

  return (
    <div className={className}>
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visible.map((s, i) => {
            const isCurrent = i === visible.length - 1;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: isCurrent ? 1 : 0.55, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 text-sm"
              >
                {isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
                <span className={isCurrent ? "font-medium" : "text-muted-foreground"}>
                  {s.label}
                  {isCurrent && <AnimatedDots />}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
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
