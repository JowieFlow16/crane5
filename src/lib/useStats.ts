import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { db, type UserStats } from "@/lib/db";

/** Award XP (and update streak) for the current user. Safe to fire-and-forget. */
export async function awardXp(amount: number): Promise<void> {
  try {
    await db.rpc("award_xp", { p_amount: amount });
  } catch {
    /* non-blocking */
  }
}

export function useStats() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-stats", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserStats | null> => {
      const { data } = await db
        .from("user_stats")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as UserStats) ?? null;
    },
  });

  const award = async (amount: number) => {
    await awardXp(amount);
    qc.invalidateQueries({ queryKey: ["user-stats", user?.id] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  };

  return { stats: query.data ?? null, ...query, award };
}
