-- ===== Roles =====
create type public.app_role as enum ('student', 'teacher', 'parent', 'admin');
create type public.class_level as enum ('S1','S2','S3','S4','S5','S6');

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  class_level public.class_level,
  school text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are viewable by owner" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- ===== User roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ===== Subjects & topics (public reference data) =====
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  color text,
  description text,
  created_at timestamptz not null default now()
);
grant select on public.subjects to anon, authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "Subjects are public" on public.subjects for select to anon, authenticated using (true);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade not null,
  name text not null,
  class_level public.class_level,
  created_at timestamptz not null default now()
);
grant select on public.topics to anon, authenticated;
grant all on public.topics to service_role;
alter table public.topics enable row level security;
create policy "Topics are public" on public.topics for select to anon, authenticated using (true);

-- ===== Documents (knowledge base) =====
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text,
  class_level public.class_level,
  doc_type text not null default 'notes',
  storage_path text not null,
  file_size bigint,
  content_text text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "Authenticated can read documents" on public.documents for select to authenticated using (true);
create policy "Admins can insert documents" on public.documents for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update documents" on public.documents for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete documents" on public.documents for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ===== Chats & messages =====
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New conversation',
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chats to authenticated;
grant all on public.chats to service_role;
alter table public.chats enable row level security;
create policy "Users manage own chats" on public.chats for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "Users manage own messages" on public.messages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Quizzes & results =====
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  topic text,
  difficulty text not null default 'Medium',
  quiz_type text not null default 'MCQ',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "Users manage own quizzes" on public.quizzes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text,
  topic text,
  score integer not null default 0,
  total integer not null default 0,
  answers jsonb not null default '[]'::jsonb,
  weak_areas text[] default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quiz_results to authenticated;
grant all on public.quiz_results to service_role;
alter table public.quiz_results enable row level security;
create policy "Users manage own results" on public.quiz_results for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Progress tracking =====
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  topic text,
  mastery integer not null default 0,
  attempts integer not null default 0,
  last_studied timestamptz not null default now(),
  unique (user_id, subject, topic)
);
grant select, insert, update, delete on public.progress to authenticated;
grant all on public.progress to service_role;
alter table public.progress enable row level security;
create policy "Users manage own progress" on public.progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== updated_at trigger =====
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger chats_updated_at before update on public.chats for each row execute function public.set_updated_at();

-- ===== new user trigger: create profile + default student role =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, class_level)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    (new.raw_user_meta_data ->> 'class_level')::public.class_level
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== Seed subjects =====
insert into public.subjects (name, slug, icon, color, description) values
  ('Mathematics','mathematics','Calculator','chart-1','Numbers, algebra, geometry & calculus'),
  ('Physics','physics','Atom','chart-2','Mechanics, electricity, waves & energy'),
  ('Chemistry','chemistry','FlaskConical','chart-3','Reactions, bonding & organic chemistry'),
  ('Biology','biology','Leaf','chart-4','Life processes, ecology & human body'),
  ('English','english','BookOpen','chart-5','Grammar, comprehension & composition');