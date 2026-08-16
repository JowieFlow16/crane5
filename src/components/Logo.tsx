import { cn } from "@/lib/utils";
import crane5Mark from "@/assets/crane5-mark.png.asset.json";

/**
 * The Crane5 mark, always rendered on its own dark emerald disc so the crane
 * and its white outlines stay crisp in light mode, dark mode and on top of the
 * brand gradients.
 */
export function Crane5Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "logo-badge relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      <img
        src={crane5Mark.url}
        alt="Crane5 AI logo"
        className="h-[82%] w-[82%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
        loading="eager"
        decoding="async"
      />
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
      <Crane5Mark className="h-11 w-11 shrink-0" />
      {showText && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-display text-lg font-bold tracking-tight">
            Crane5 <span className="text-gradient">AI</span>
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
