-- Fix mutable search_path on trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Lock down SECURITY DEFINER functions from public/anon exposure
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
-- has_role is referenced by RLS policies evaluated for signed-in users, so keep authenticated execute
grant execute on function public.has_role(uuid, public.app_role) to authenticated;