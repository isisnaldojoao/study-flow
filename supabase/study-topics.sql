-- Rode no SQL Editor do Supabase se o projeto já estava publicado
-- antes da tabela de conteúdos. O app também salva os conteúdos no
-- perfil enquanto esta tabela não existir.

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

create index if not exists study_topics_user_idx on public.study_topics (user_id, subject_id);

alter table public.study_topics enable row level security;

drop policy if exists "topics_own" on public.study_topics;
create policy "topics_own" on public.study_topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
