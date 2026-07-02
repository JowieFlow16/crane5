-- Harden the trigger functions added for DMs / teacher profiles.
-- Set immutable search_path and revoke direct EXECUTE (trigger use is unaffected).

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.bump_conversation() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;