import { Logo } from "@/components/Logo";

/** Branded full-screen loading state used while the app boots. */
export function AppLoader({ label = "Preparing your learning space…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-gradient-subtle px-6 text-center">
      <div className="animate-pulse">
        <Logo />
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-gradient-primary" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{label}</p>
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground/70">
        Altrastate Technologies Ltd
      </p>
    </div>
  );
}
