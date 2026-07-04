import altrastate from "@/assets/altrastate-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * "Powered by Altrastate" badge shown across the app footers and auth screens.
 * Uses the Altrastate logo asset served from the Lovable CDN.
 */
export function PoweredByAltrastate({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>Powered by</span>
      <img
        src={altrastate.url}
        alt="Altrastate"
        className={cn("h-4 w-4 object-contain", iconClassName)}
        loading="lazy"
      />
      <span className="font-semibold text-foreground">Altrastate</span>
    </span>
  );
}
