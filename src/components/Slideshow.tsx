import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Slide {
  id: string;
  content: ReactNode;
}

/**
 * Lightweight, dependency-free slideshow / carousel with autoplay, swipe dots
 * and arrow controls. Used for hero highlights and motivational cards.
 */
export function Slideshow({
  slides,
  className,
  interval = 6000,
  autoPlay = true,
}: {
  slides: Slide[];
  className?: string;
  interval?: number;
  autoPlay?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((dir: number) => setIndex((i) => (i + dir + count) % count), [count]);

  useEffect(() => {
    if (!autoPlay || paused || count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(t);
  }, [autoPlay, paused, count, interval]);

  if (count === 0) return null;

  return (
    <div
      className={cn("relative overflow-hidden rounded-3xl", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s) => (
          <div key={s.id} className="w-full shrink-0">
            {s.content}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1.5 text-foreground shadow-md backdrop-blur transition-opacity hover:bg-background"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1.5 text-foreground shadow-md backdrop-blur transition-opacity hover:bg-background"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/30",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
