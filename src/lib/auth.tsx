import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { provisionAccount } from "@/lib/account.functions";

export type AppRole = "student" | "teacher" | "parent" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  class_level: string | null;
  school: string | null;
  bio: string | null;
  learning_goal: string | null;
  favorite_subjects: string[] | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string) => {
    // Make sure the account has a profile + role row (no database trigger runs
    // on sign-up, so this is what provisions new learners).
    try {
      await provisionAccount({ data: undefined });
    } catch {
      /* non-fatal — the client-side fallback below still applies */
    }

    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    let resolved = (prof as Profile | null) ?? null;

    // Self-heal: some accounts have no profile row yet (e.g. created before the
    // profile was provisioned). Create it on first load so the settings page,
    // dashboard greeting and leaderboard all work.
    if (!resolved) {
      const { data: authUser } = await supabase.auth.getUser();
      const meta = (authUser.user?.user_metadata ?? {}) as Record<string, unknown>;
      const { data: created } = await supabase
        .from("profiles")
        .upsert(
          {
            id: uid,
            email: authUser.user?.email ?? null,
            full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
            class_level: (meta.class_level as string) ?? null,
          } as never,
          { onConflict: "id" },
        )
        .select("*")
        .maybeSingle();
      resolved = (created as Profile | null) ?? null;
    }

    setProfile(resolved);

    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer Supabase calls to avoid auth deadlocks
        setTimeout(() => loadExtras(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadExtras(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    isAdmin: roles.includes("admin"),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshProfile: async () => {
      if (user) await loadExtras(user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
