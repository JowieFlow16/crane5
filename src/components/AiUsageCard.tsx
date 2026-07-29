import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Infinity as InfinityIcon, Loader2 } from "lucide-react";
import { getMyAiUsage } from "@/lib/usage.functions";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function Bar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-destructive" : "bg-gradient-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Shows the signed-in user's own daily AI allowance. */
export function AiUsageCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const fetchUsage = useServerFn(getMyAiUsage);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage", user?.id],
    enabled: !!user,
    queryFn: () => fetchUsage(),
    staleTime: 30_000,
  });

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6", className)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Gauge className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate font-display font-semibold">Your daily AI allowance</h2>
        </div>
        {data && (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {data.plan}
          </span>
        )}
      </div>

      {isLoading || !data ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
        </div>
      ) : data.unlimited ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <InfinityIcon className="h-4 w-4 text-primary" />
          Unlimited AI requests on your account.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <span className="text-muted-foreground">AI requests today</span>
              <span className="font-semibold">
                {data.requests_today} / {data.request_limit}
              </span>
            </div>
            <div className="mt-2">
              <Bar used={data.requests_today} limit={data.request_limit} />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <span className="text-muted-foreground">Image generations today</span>
              <span className="font-semibold">
                {data.images_today} / {data.image_limit}
              </span>
            </div>
            <div className="mt-2">
              <Bar used={data.images_today} limit={data.image_limit} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Resets at{" "}
            {new Date(data.resets_at).toLocaleString("en-GB", {
              timeZone: "Africa/Kampala",
              hour: "2-digit",
              minute: "2-digit",
              day: "numeric",
              month: "short",
            })}{" "}
            (EAT). Your allowance is yours alone — it never affects other learners.
          </p>
        </div>
      )}
    </section>
  );
}
