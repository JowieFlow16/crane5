import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OFFICIAL_ADMIN_EMAIL = "admin@omicron.ai";

/**
 * Makes sure a signed-in account has a profile row and at least the student
 * role. The official admin address is always granted the admin role.
 */
export const provisionAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const claims = (context.claims ?? {}) as {
      email?: string;
      user_metadata?: Record<string, unknown>;
    };
    const email = claims.email ?? null;
    const meta = claims.user_metadata ?? {};

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
        class_level: (meta.class_level as string) ?? null,
      } as never,
      { onConflict: "id", ignoreDuplicates: true },
    );

    const roles: string[] = ["student"];
    if (email && email.toLowerCase() === OFFICIAL_ADMIN_EMAIL) roles.push("admin");

    for (const role of roles) {
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", role as never)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: role as never } as never);
      }
    }

    return { ok: true, roles };
  });
