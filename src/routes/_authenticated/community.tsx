import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Heart,
  MessageCircle,
  Send,
  Trash2,
  Sparkles,
  ImagePlus,
  Loader2,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db, type Post, type PostComment, type PostKind } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useStats } from "@/lib/useStats";
import { generateImage } from "@/lib/ai.functions";
import { Markdown } from "@/components/Markdown";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "Community · Crane5 AI" },
      {
        name: "description",
        content:
          "Connect with fellow Ugandan students, share your study progress and cheer each other on.",
      },
    ],
  }),
  component: CommunityPage,
});

const KINDS: { value: PostKind; label: string; emoji: string; ring: string }[] = [
  { value: "update", label: "Update", emoji: "💬", ring: "border-primary/40 bg-primary/10 text-primary" },
  { value: "progress", label: "Progress", emoji: "📈", ring: "border-success/40 bg-success/10 text-success" },
  { value: "win", label: "Win", emoji: "🏆", ring: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  { value: "question", label: "Question", emoji: "❓", ring: "border-blue-500/40 bg-blue-500/10 text-blue-600" },
];

function kindMeta(k: PostKind) {
  return KINDS.find((x) => x.value === k) ?? KINDS[0];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string | null | undefined) {
  return (name ?? "S").charAt(0).toUpperCase();
}

function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  return url ? (
    <img
      src={url}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground"
    >
      {initials(name)}
    </div>
  );
}

function CommunityPage() {
  const { user, profile } = useAuth();
  const { stats } = useStats();
  const qc = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["community-feed"],
    queryFn: async (): Promise<Post[]> => {
      const [{ data: rows }, { data: likes }] = await Promise.all([
        db.from("posts").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("post_likes").select("post_id").eq("user_id", user!.id),
      ]);
      const likedSet = new Set(((likes as { post_id: string }[]) ?? []).map((l) => l.post_id));
      return ((rows as Post[]) ?? []).map((p) => ({ ...p, liked_by_me: likedSet.has(p.id) }));
    },
    enabled: !!user,
  });

  // Realtime: refresh the feed whenever anyone posts, likes or comments.
  useEffect(() => {
    const channel = supabase
      .channel("community")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () =>
        qc.invalidateQueries({ queryKey: ["community-feed"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () =>
        qc.invalidateQueries({ queryKey: ["community-feed"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["community-feed"] });
        const pid = (payload.new as { post_id?: string })?.post_id ?? (payload.old as { post_id?: string })?.post_id;
        if (pid) qc.invalidateQueries({ queryKey: ["comments", pid] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Community</h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Share your wins, ask for help and cheer on fellow learners across Uganda. 🇺🇬
      </p>

      <Composer
        userId={user?.id}
        profile={profile}
        streak={stats?.current_streak ?? 0}
        level={stats?.level ?? 1}
        xp={stats?.xp ?? 0}
        onPosted={() => qc.invalidateQueries({ queryKey: ["community-feed"] })}
      />

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (posts ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No posts yet — be the first to share your progress!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {(posts ?? []).map((p) => (
              <PostCard key={p.id} post={p} currentUserId={user?.id} profile={profile} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ---------------- Composer ---------------- */

function Composer({
  userId,
  profile,
  streak,
  level,
  xp,
  onPosted,
}: {
  userId?: string;
  profile: ReturnType<typeof useAuth>["profile"];
  streak: number;
  level: number;
  xp: number;
  onPosted: () => void;
}) {
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<PostKind>("update");
  const [image, setImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [imaging, setImaging] = useState(false);
  const genImage = useServerFn(generateImage);

  const shareProgress = () => {
    setKind("progress");
    setContent(
      `Just hit **Level ${level}** with **${xp} XP** and a **${streak}-day streak** 🔥 on Crane5 AI! Let's keep grinding 💪`,
    );
  };

  const addImage = async () => {
    if (!content.trim()) {
      toast.error("Write something first so the illustration has context.");
      return;
    }
    setImaging(true);
    try {
      const { url } = await genImage({ data: { prompt: content.slice(0, 300) } });
      setImage(url);
      toast.success("Illustration added!");
    } catch {
      toast.error("Couldn't generate an image. Try again.");
    } finally {
      setImaging(false);
    }
  };

  const submit = async () => {
    if (!content.trim() || !userId) return;
    setPosting(true);
    try {
      const { error } = await db.from("posts").insert({
        user_id: userId,
        author_name: profile?.full_name ?? "Student",
        author_avatar: profile?.avatar_url ?? null,
        author_class: profile?.class_level ?? null,
        content: content.trim(),
        image_url: image,
        kind,
        subject: null,
      } as never);
      if (error) throw error;
      setContent("");
      setImage(null);
      setKind("update");
      onPosted();
      toast.success("Posted to the community! 🎉");
    } catch {
      toast.error("Couldn't post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-card">
      <div className="flex gap-3">
        <Avatar url={profile?.avatar_url} name={profile?.full_name} />
        <div className="min-w-0 flex-1">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a win, ask a question, or post your progress…"
            className="min-h-[70px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />

          {image && (
            <div className="relative mt-3 w-fit">
              <img src={image} alt="attachment" className="max-h-56 rounded-xl border border-border" />
              <button
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 shadow"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  kind === k.value ? k.ring : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              onClick={shareProgress}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Share my progress
            </button>
            <button
              onClick={addImage}
              disabled={imaging}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-60"
            >
              {imaging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 text-primary" />}
              AI image
            </button>
            <button
              onClick={submit}
              disabled={posting || !content.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Post card ---------------- */

function PostCard({
  post,
  currentUserId,
  profile,
}: {
  post: Post;
  currentUserId?: string;
  profile: ReturnType<typeof useAuth>["profile"];
}) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const meta = kindMeta(post.kind);
  const mine = post.user_id === currentUserId;

  const toggleLike = async () => {
    if (!currentUserId) return;
    // optimistic
    qc.setQueryData<Post[]>(["community-feed"], (old) =>
      (old ?? []).map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              likes_count: p.likes_count + (p.liked_by_me ? -1 : 1),
            }
          : p,
      ),
    );
    if (post.liked_by_me) {
      await db.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      await db.from("post_likes").insert({ post_id: post.id, user_id: currentUserId } as never);
    }
  };

  const remove = async () => {
    qc.setQueryData<Post[]>(["community-feed"], (old) => (old ?? []).filter((p) => p.id !== post.id));
    await db.from("posts").delete().eq("id", post.id);
    toast.success("Post deleted");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-3xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-start gap-3">
        <Avatar url={post.author_avatar} name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{post.author_name ?? "Student"}</span>
            {post.author_class && (
              <span className="text-xs text-muted-foreground">· {post.author_class}</span>
            )}
            <span className="text-xs text-muted-foreground">· {timeAgo(post.created_at)}</span>
          </div>
          <span
            className={cn(
              "mt-1 inline-block rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
              meta.ring,
            )}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>
        {mine && (
          <button
            onClick={remove}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label="Delete post"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 text-sm">
        <Markdown>{post.content}</Markdown>
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="mt-3 max-h-96 w-full rounded-2xl border border-border object-cover"
        />
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-sm">
        <button
          onClick={toggleLike}
          className={cn(
            "inline-flex items-center gap-1.5 transition-colors",
            post.liked_by_me ? "text-red-500" : "text-muted-foreground hover:text-red-500",
          )}
        >
          <Heart className={cn("h-4 w-4", post.liked_by_me && "fill-current")} />
          {post.likes_count}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comments_count}
        </button>
      </div>

      {showComments && (
        <Comments postId={post.id} currentUserId={currentUserId} profile={profile} />
      )}
    </motion.div>
  );
}

/* ---------------- Comments ---------------- */

function Comments({
  postId,
  currentUserId,
  profile,
}: {
  postId: string;
  currentUserId?: string;
  profile: ReturnType<typeof useAuth>["profile"];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async (): Promise<PostComment[]> => {
      const { data } = await db
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      return (data as PostComment[]) ?? [];
    },
  });

  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    setSending(true);
    try {
      const { error } = await db.from("post_comments").insert({
        post_id: postId,
        user_id: currentUserId,
        author_name: profile?.full_name ?? "Student",
        author_avatar: profile?.avatar_url ?? null,
        content: text.trim(),
      } as never);
      if (error) throw error;
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["community-feed"] });
    } catch {
      toast.error("Couldn't send comment.");
    } finally {
      setSending(false);
    }
  };

  const del = async (id: string) => {
    await db.from("post_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["comments", postId] });
    qc.invalidateQueries({ queryKey: ["community-feed"] });
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {(comments ?? []).map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar url={c.author_avatar} name={c.author_name} size={28} />
          <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">{c.author_name ?? "Student"}</span>
              <span className="text-[0.65rem] text-muted-foreground">{timeAgo(c.created_at)}</span>
              {c.user_id === currentUserId && (
                <button
                  onClick={() => del(c.id)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.content}</p>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Avatar url={profile?.avatar_url} name={profile?.full_name} size={28} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a reply…"
          className="h-9 flex-1 rounded-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          aria-label="Send comment"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
