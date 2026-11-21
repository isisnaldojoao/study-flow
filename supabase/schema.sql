-- Study Flow: rode este arquivo no SQL Editor do Supabase.
-- Em Authentication > Providers > Email, desligue "Confirm email"
-- se quiser entrar logo depois do cadastro, sem abrir o link.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  preferences jsonb not null default '{"theme":"system","defaultReminderDays":1,"notificationsEnabled":true,"browserPushEnabled":false}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  description text not null default '',
  type text not null,
  date date not null,
  time text,
  priority text not null default 'media',
  status text not null default 'pendente',
  reminder_settings jsonb not null default '[1]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  content text not null default '',
  start_date date not null,
  start_time text not null,
  end_time text not null,
  notes text not null default '',
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  content text not null default '',
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  question text not null,
  answer text not null,
  category text not null default 'Geral',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  mime_type text not null,
  size integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  related_activity_id uuid references public.activities (id) on delete cascade,
  related_session_id uuid references public.study_sessions (id) on delete cascade,
  read boolean not null default false,
  scheduled_at date not null,
  created_at timestamptz not null default now(),
  dedupe_key text not null,
  unique (user_id, dedupe_key)
);

create table if not exists public.study_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  title text not null,
  estimated_minutes integer not null default 40,
  difficulty text not null default 'media',
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subjects_user_idx on public.subjects (user_id);
create index if not exists activities_user_idx on public.activities (user_id, date);
create index if not exists sessions_user_idx on public.study_sessions (user_id, start_date);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists study_topics_user_idx on public.study_topics (user_id, subject_id);

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.activities enable row level security;
alter table public.study_sessions enable row level security;
alter table public.review_contents enable row level security;
alter table public.flashcards enable row level security;
alter table public.materials enable row level security;
alter table public.notifications enable row level security;
alter table public.study_topics enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "subjects_own" on public.subjects;
drop policy if exists "activities_own" on public.activities;
drop policy if exists "sessions_own" on public.study_sessions;
drop policy if exists "reviews_own" on public.review_contents;
drop policy if exists "cards_own" on public.flashcards;
drop policy if exists "materials_own" on public.materials;
drop policy if exists "notifications_own" on public.notifications;
drop policy if exists "topics_own" on public.study_topics;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "subjects_own" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activities_own" on public.activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_own" on public.study_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews_own" on public.review_contents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cards_own" on public.flashcards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "materials_own" on public.materials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "topics_own" on public.study_topics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

drop policy if exists "materials_storage_own" on storage.objects;
create policy "materials_storage_own"
  on storage.objects for all
  using (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
