import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { motion } from "motion/react";
import {
  MessagesSquare,
  Send,
  Loader2,
  ArrowLeft,
  Search,
  MoreVertical,
  Ban,
  Flag,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db, otherParty, type Conversation, type DirectMessage } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FindStudentDialog } from "@/components/FindStudentDialog";
import { ReportDialog } from "@/components/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, listMyBlocks, unblockUser } from "@/lib/moderation";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: z.object({ c: z.string().optional() }),
  head: () => ({ meta: [{ title: "Messages · Crane5 AI" }] }),
  component: MessagesPage,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({
  url,
  name,
  size = 44,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
}) {
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
      {(name ?? "U").charAt(0).toUpperCase()}
    </div>
  );
}

function MessagesPage() {
  const { user } = useAuth();
  const { c: activeId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Conversation[]> => {
      const { data } = await db
        .from("conversations")
        .select("*")
        .order("last_at", { ascending: false });
      return (data as Conversation[]) ?? [];
    },
  });

  // Realtime: refresh list + open thread on any DM change.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dm")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        qc.invalidateQueries({ queryKey: ["conversations", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        (payload) => {
          const cid =
            (payload.new as { conversation_id?: string })?.conversation_id ??
            (payload.old as { conversation_id?: string })?.conversation_id;
          if (cid) qc.invalidateQueries({ queryKey: ["dm-thread", cid] });
          qc.invalidateQueries({ queryKey: ["conversations", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, user]);

  const active = useMemo(
    () => (conversations ?? []).find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const filtered = (conversations ?? []).filter((c) => {
    if (!user) return false;
    const o = otherParty(c, user.id);
    return !search || o.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl gap-0 px-0 sm:px-4 sm:py-4">
      {/* Conversation list */}
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border bg-card sm:w-80 sm:rounded-l-2xl sm:border",
          active && "hidden sm:flex",
        )}
      >
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg font-bold">Messages</h1>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="pl-9"
            />
          </div>
          <div className="mt-2">
            <FindStudentDialog />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No chats yet. Meet other students on the Community or Leaderboard, then tap “Message”.
            </div>
          ) : (
            filtered.map((c) => {
              const o = otherParty(c, user!.id);
              return (
                <button
                  key={c.id}
                  onClick={() => navigate({ search: { c: c.id } })}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    c.id === activeId && "bg-muted",
                  )}
                >
                  <Avatar url={o.avatar} name={o.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{o.name}</span>
                      <span className="ml-auto shrink-0 text-[0.65rem] text-muted-foreground">
                        {timeAgo(c.last_at)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_message ?? "Say hello 👋"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-background sm:rounded-r-2xl sm:border sm:border-l-0 sm:border-border",
          !active && "hidden sm:flex",
        )}
      >
        {active && user ? (
          <Thread
            conversation={active}
            myId={user.id}
            onBack={() => navigate({ search: {} })}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessagesSquare className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm">Select a conversation to start chatting.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({
  conversation,
  myId,
  onBack,
}: {
  conversation: Conversation;
  myId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const other = otherParty(conversation, myId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["dm-thread", conversation.id],
    queryFn: async (): Promise<DirectMessage[]> => {
      const { data } = await db
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      return (data as DirectMessage[]) ?? [];
    },
  });

  // Mark incoming messages read.
  useEffect(() => {
    const unread = (messages ?? []).filter((m) => m.recipient_id === myId && !m.read);
    if (unread.length) {
      db.from("direct_messages")
        .update({ read: true } as never)
        .eq("conversation_id", conversation.id)
        .eq("recipient_id", myId)
        .eq("read", false)
        .then(() => {});
    }
  }, [messages, myId, conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText("");
    const { error } = await db.from("direct_messages").insert({
      conversation_id: conversation.id,
      sender_id: myId,
      recipient_id: other.id,
      content: body,
    } as never);
    if (error) {
      toast.error("Message failed to send.");
      setText(body);
    } else {
      qc.invalidateQueries({ queryKey: ["dm-thread", conversation.id] });
    }
    setSending(false);
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 sm:rounded-tr-2xl">
        <button
          onClick={onBack}
          className="rounded-md p-1 hover:bg-muted sm:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar url={other.avatar} name={other.name} size={38} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium">{other.name}</p>
          </div>
          <p className="text-xs text-muted-foreground">Student</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {(messages ?? []).length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            This is the start of your conversation with {other.name}.
          </div>
        )}
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === myId;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                  mine
                    ? "rounded-br-md bg-gradient-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground",
                )}
              >
                {m.content}
                <span
                  className={cn(
                    "mt-1 block text-[0.6rem]",
                    mine ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {timeAgo(m.created_at)}
                </span>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card p-3 sm:rounded-br-2xl">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${other.name}…`}
            className="min-h-[44px] max-h-40 resize-none"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </>
  );
}
