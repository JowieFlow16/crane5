import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight accessor for tables/functions added in later migrations that are
 * not yet in the generated `types.ts`. Casting keeps call sites ergonomic while
 * the generated types catch up. Prefer the typed `supabase` client for existing
 * tables; use `db` only for the tables modelled below.
 */
type QueryBuilder = ReturnType<typeof supabase.from>;
export const db = supabase as unknown as {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export interface UserStats {
  user_id: string;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_active: string | null;
}

export interface Bookmark {
  id: string;
  user_id: string;
  kind: string;
  title: string | null;
  subject: string | null;
  content: string;
  created_at: string;
}

export interface FlashcardRow {
  id: string;
  user_id: string;
  subject: string | null;
  topic: string | null;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  reps: number;
  due_date: string;
  created_at: string;
}

export interface StudyTask {
  id: string;
  user_id: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

export interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  class_level: string | null;
  xp: number;
  level: number;
  current_streak: number;
}
