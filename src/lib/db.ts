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

export type PostKind = "update" | "progress" | "question" | "win";

export interface Post {
  id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  author_class: string | null;
  content: string;
  image_url: string | null;
  kind: PostKind;
  subject: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  /** Client-side: whether the current user has liked this post. */
  liked_by_me?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

export type TeacherStatus = "pending" | "approved" | "rejected";

export interface TeacherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  school: string | null;
  subjects: string[];
  experience_years: number;
  class_levels: string[];
  contact_note: string | null;
  status: TeacherStatus;
  rating_avg: number;
  students_helped: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_lo: string;
  user_hi: string;
  lo_name: string | null;
  lo_avatar: string | null;
  lo_role: string;
  hi_name: string | null;
  hi_avatar: string | null;
  hi_role: string;
  last_message: string | null;
  last_sender: string | null;
  last_at: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

/** Helper: pick the "other" participant's display info from a conversation. */
export function otherParty(c: Conversation, myId: string) {
  const isLo = c.user_lo === myId;
  return {
    id: isLo ? c.user_hi : c.user_lo,
    name: (isLo ? c.hi_name : c.lo_name) ?? "User",
    avatar: isLo ? c.hi_avatar : c.lo_avatar,
    role: isLo ? c.hi_role : c.lo_role,
  };
}
