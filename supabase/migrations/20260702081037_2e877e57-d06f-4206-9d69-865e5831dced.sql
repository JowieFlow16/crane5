-- Allow teachers to edit their own profile at any status, but prevent
-- non-admins from promoting themselves. Status changes by non-admins are
-- limited to re-applying (-> 'pending').

drop policy if exists "Teacher profiles: update own" on public.teacher_profiles;

create policy "Teacher profiles: update own"
  on public.teacher_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.guard_teacher_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not private.has_role(auth.uid(), 'admin') and new.status <> 'pending' then
      raise exception 'Only admins can change verification status';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_teacher_status() from public, anon, authenticated;

drop trigger if exists on_teacher_status_change on public.teacher_profiles;
create trigger on_teacher_status_change
  before update on public.teacher_profiles
  for each row execute function public.guard_teacher_status();