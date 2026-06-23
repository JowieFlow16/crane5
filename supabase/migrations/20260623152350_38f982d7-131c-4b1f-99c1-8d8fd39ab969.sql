-- Finding 1: SECURITY DEFINER function callable by signed-in users via the API.
-- Move has_role out of the API-exposed public schema. RLS policies reference it
-- by OID, so they keep working after the move.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

alter function public.has_role(uuid, public.app_role) set schema private;

-- Scope EXECUTE to roles that actually need it for RLS evaluation.
revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

-- Finding 2: prevent privilege escalation on user_roles.
-- Only admins may insert, update, or delete roles. (SELECT own-roles policy stays.)
create policy "Only admins can insert roles"
  on public.user_roles for insert to authenticated
  with check (private.has_role(auth.uid(), 'admin'));

create policy "Only admins can update roles"
  on public.user_roles for update to authenticated
  using (private.has_role(auth.uid(), 'admin'))
  with check (private.has_role(auth.uid(), 'admin'));

create policy "Only admins can delete roles"
  on public.user_roles for delete to authenticated
  using (private.has_role(auth.uid(), 'admin'));