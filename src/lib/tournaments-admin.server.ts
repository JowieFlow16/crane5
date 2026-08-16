// Server-only admin guard for tournament management.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped table access for late-migration tables
type Sb = { from: (t: string) => any };

/** Throws unless the caller holds the admin role (checked as the caller, RLS-safe). */
export async function assertTournamentAdmin(supabase: unknown, userId: string) {
  const { data } = await (supabase as Sb)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}
