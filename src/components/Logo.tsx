import { cn } from "@/lib/utils";

export function OmicronMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3/5 w-3/5">
        {/* Omega-inspired futuristic mark */}
        <path
          d="M5 19h3.2c-2-1.6-3.2-4-3.2-6.7C5 7.7 8 4.8 12 4.8s7 2.9 7 7.5c0 2.7-1.2 5.1-3.2 6.7H19"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  showText = true,
  byline = true,
}: {
  className?: string;
  showText?: boolean;
  /** Show the "By Altrastate" company byline beneath the wordmark. */
  byline?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <OmicronMark className="h-9 w-9 shrink-0" />
      {showText && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-display text-lg font-bold tracking-tight">
            Omicron <span className="text-gradient">AI</span>
          </span>
          {byline && (
            <span className="mt-1 truncate text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              By Altrastate
            </span>
          )}
        </span>
      )}
    </div>
  );
}
