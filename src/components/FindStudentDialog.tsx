import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { searchStudents } from "@/lib/tournaments.functions";
import { MessageButton } from "@/components/MessageButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Search every Crane5 student by name, school or class and start a chat. */
export function FindStudentDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const find = useServerFn(searchStudents);

  const { data: results, isFetching } = useQuery({
    queryKey: ["student-search", q],
    enabled: open && q.trim().length >= 2,
    queryFn: () => find({ data: { q } }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full rounded-full">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Find a student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find a student</DialogTitle>
          <DialogDescription>
            Search by name or school, then start a chat and revise together.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Amina, Kampala High School…"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : isFetching ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (results ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No students matched “{q}”.
            </p>
          ) : (
            (results ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                    {(s.full_name ?? "S").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.full_name ?? "Student"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[s.class_level, s.school].filter(Boolean).join(" · ") || "Crane5 learner"}
                  </p>
                </div>
                <MessageButton otherUserId={s.id} label="Chat" />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
