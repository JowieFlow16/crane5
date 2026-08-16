import { cn } from "@/lib/utils";
import crane5Logo from "@/assets/crane5-logo.png.asset.json";

export function Crane5Mark({ className }: { className?: string }) {
  return (
    <img
      src={crane5Logo.url}
      alt="Crane5 AI logo"
      className={cn("shrink-0 rounded-full object-contain", className)}
    />
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
