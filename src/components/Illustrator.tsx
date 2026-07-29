import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { ImagePlus, Loader2, Download } from "lucide-react";
import { generateImage } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { aiErrorMessage } from "@/lib/ai-errors";

interface IllustratorProps {
  prompt: string;
  subject?: string;
  className?: string;
}

/**
 * On-demand AI illustration. Renders a small button that generates a
 * labelled educational diagram/image for the given prompt and shows it inline.
 */
export function Illustrator({ prompt, subject, className }: IllustratorProps) {
  const callGenerate = useServerFn(generateImage);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callGenerate({ data: { prompt: prompt.slice(0, 480), subject } });
      setUrl(res.url);
    } catch (err) {
      toast.error(aiErrorMessage(err, "Couldn't create the illustration."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      {!url && (
        <button
          onClick={run}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-70",
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {busy ? "Drawing…" : "Illustrate"}
        </button>
      )}

      <AnimatePresence>
        {url && (
          <motion.figure
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-2 overflow-hidden rounded-xl border border-border bg-card shadow-card"
          >
            <img src={url} alt={prompt} className="w-full" loading="lazy" />
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
              <span className="line-clamp-1">AI illustration · {prompt}</span>
              <a
                href={url}
                download="omicron-illustration.png"
                className="inline-flex items-center gap-1 font-medium text-primary hover:opacity-80"
              >
                <Download className="h-3 w-3" /> Save
              </a>
            </figcaption>
          </motion.figure>
        )}
      </AnimatePresence>
    </div>
  );
}
