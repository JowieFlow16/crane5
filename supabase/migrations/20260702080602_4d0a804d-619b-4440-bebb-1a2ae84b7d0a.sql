-- ============================================================================
-- Teacher profiles + Direct Messaging (DMs) for Omicron AI
-- ============================================================================

-- ---------- 1. TEACHER PROFILES ----------
create table if not exists public.teacher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  school text,
  subjects text[] not null default '{}',
  experience_years int not null default 0,
  class_levels text[] not null default '{}',
  contact_note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rating_avg numeric(3,2) not null default 0,
  students_helped int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.teacher_profiles to authenticated;
grant all on public.teacher_profiles to service_role;

alter table public.teacher_profiles enable row level security;

create policy "Teacher profiles: read approved or own or admin"
  on public.teacher_profiles for select
  to authenticated
  using (
    status = 'approved'
    or id = auth.uid()
    or private.has_role(auth.uid(), 'admin')
  );

create policy "Teacher profiles: insert own"
  on public.teacher_profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Teacher profiles: update own"
  on public.teacher_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and status = 'pending');

create policy "Teacher profiles: admin manage"
  on public.teacher_profiles for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'))
  with check (private.has_role(auth.uid(), 'admin'));

create policy "Teacher profiles: admin delete"
  on public.teacher_profiles for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin') or id = auth.uid());

-- ---------- 2. CONVERSATIONS ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_lo uuid not null references auth.users(id) on delete cascade,
  user_hi uuid not null references auth.users(id) on delete cascade,
  lo_name text,
  lo_avatar text,
  lo_role text not null default 'student',
  hi_name text,
  hi_avatar text,
  hi_role text not null default 'student',
  last_message text,
  last_sender uuid,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_pair_order check (user_lo < user_hi),
  constraint conversations_unique_pair unique (user_lo, user_hi)
);

grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;

alter table public.conversations enable row level security;

create policy "Conversations: participants read"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user_lo or auth.uid() = user_hi);

create policy "Conversations: participants insert"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user_lo or auth.uid() = user_hi);

create policy "Conversations: participants update"
  on public.conversations for update
  to authenticated
  using (auth.uid() = user_lo or auth.uid() = user_hi)
  with check (auth.uid() = user_lo or auth.uid() = user_hi);

-- ---------- 3. DIRECT MESSAGES ----------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_conversation_idx on public.direct_messages(conversation_id, created_at);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient_id) where read = false;

grant select, insert, update, delete on public.direct_messages to authenticated;
grant all on public.direct_messages to service_role;

alter table public.direct_messages enable row level security;

create policy "DM: participants read"
  on public.direct_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "DM: sender insert"
  on public.direct_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

create policy "DM: recipient mark read"
  on public.direct_messages for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ---------- 4. TRIGGERS ----------
-- bump conversation summary on new message
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message = new.content,
        last_sender = new.sender_id,
        last_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_direct_message_insert on public.direct_messages;
create trigger on_direct_message_insert
  after insert on public.direct_messages
  for each row execute function public.bump_conversation();

-- keep updated_at fresh on teacher_profiles
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_teacher_profile_update on public.teacher_profiles;
create trigger on_teacher_profile_update
  before update on public.teacher_profiles
  for each row execute function public.touch_updated_at();

-- ---------- 5. REALTIME ----------
alter table public.conversations replica identity full;
alter table public.direct_messages replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.direct_messages;
  exception when duplicate_object then null;
  end;
end $$;