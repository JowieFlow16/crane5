import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Moon, Sun, Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      <SidebarTrigger className="shrink-0 text-foreground" />

      <Logo className="min-w-0 md:hidden" />

      <div className="relative hidden max-w-sm flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search topics, subjects…"
          className="h-9 rounded-full border-border bg-muted/50 pl-9"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <button
          onClick={toggleTheme}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button
          className="relative hidden rounded-full p-2 sm:block text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
        </button>
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name ?? "Your profile"}
            className="ml-1 h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
            {(profile?.full_name ?? profile?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
