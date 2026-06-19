import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { z } from "zod";
import {
  SendHorizonal,
  Plus,
  Loader2,
  MessageCircle,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { chatTutor } from "@/lib/ai.functions";
import { OmicronMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English"];

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: z.object({ subject: z.string().optional() }),
  head: () => ({ meta: [{ title: "AI Tutor · Omicron AI" }] }),
  component: ChatPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Explain Newton's second law with a Ugandan example",
  "Help me factorise quadratic equations step by step",
  "What is photosynthesis? Keep it simple",
  "Give me 3 tips to improve my English composition",
];

function ChatPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const callTutor = useServerFn(chatTutor);

  const [subject, setSubject] = useState(search.subject ?? "Mathematics");
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useQuery({
    queryKey: ["chats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("chats")
        .select("id, title, subject, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const openChat = async (id: string) => {
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", id)
      .order("created_at");
    setChatId(id);
    setMessages((data ?? []) as Msg[]);
  };

  const newChat = () => {
    setChatId(null);
    setMessages([]);
  };

  const send = async (text: string) => {
    if (!text.trim() || thinking || !user) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);

    try {
      // Ensure a chat exists
      let id = chatId;
      if (!id) {
        const { data: chat, error } = await supabase
          .from("chats")
          .insert({
            user_id: user.id,
            subject,
            title: text.trim().slice(0, 50),
          })
          .select("id")
          .single();
        if (error) throw error;
        id = chat.id;
        setChatId(id);
      }

      await supabase.from("messages").insert({
        chat_id: id,
        user_id: user.id,
        role: "user",
        content: userMsg.content,
      });

      const res = await callTutor({ data: { messages: nextMessages, subject } });

      setMessages((m) => [...m, { role: "assistant", content: res.content }]);
      await supabase.from("messages").insert({
        chat_id: id,
        user_id: user.id,
        role: "assistant",
        content: res.content,
      });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["chats", user.id] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("RATE_LIMIT")) toast.error("Too many requests — please wait a moment.");
      else if (msg.includes("CREDITS")) toast.error("AI usage limit reached. Please try later.");
      else toast.error("Omicron couldn't respond. Please try again.");
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/50 md:flex">
        <div className="p-3">
          <Button onClick={newChat} variant="hero" className="w-full">
            <Plus className="h-4 w-4" /> New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {(chats ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c.id)}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                chatId === c.id && "bg-muted font-medium",
              )}
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <OmicronMark className="h-8 w-8" />
            <div>
              <p className="text-sm font-semibold leading-tight">Omicron AI Tutor</p>
              <p className="text-xs text-muted-foreground">NCDC-aligned · always learning</p>
            </div>
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-40">
              <BookOpen className="h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl">
            {messages.length === 0 && !thinking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 text-center"
              >
                <OmicronMark className="mx-auto h-14 w-14" />
                <h2 className="mt-4 font-display text-xl font-bold">
                  How can I help you study today?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask me anything about {subject}. I'll explain step by step.
                </p>
                <div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="hover-lift rounded-xl border border-border bg-card p-3 text-left text-sm shadow-card"
                    >
                      <Sparkles className="mb-1.5 h-4 w-4 text-primary" />
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className={cn("flex gap-3", m.role === "user" && "justify-end")}
                  >
                    {m.role === "assistant" && <OmicronMark className="h-8 w-8 shrink-0" />}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                        m.role === "user"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border border-border bg-card",
                      )}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose-chat space-y-2">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {thinking && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <OmicronMark className="h-8 w-8 shrink-0" />
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={`Ask about ${subject}…`}
              rows={1}
              className="max-h-40 min-h-[44px] resize-none rounded-2xl"
            />
            <Button
              onClick={() => send(input)}
              disabled={thinking || !input.trim()}
              variant="hero"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full"
            >
              {thinking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizonal className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-muted-foreground">
            Omicron AI can make mistakes. Always check important facts.
          </p>
        </div>
      </div>
    </div>
  );
}
