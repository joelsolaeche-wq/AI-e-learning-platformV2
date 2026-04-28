-- ============================================================
-- Migration: 20260428000002_create_remaining_tables
-- Phase 2: Data Model + Course Catalog
-- Creates 11 tables, enables RLS on all, adds the FK from
-- profiles.org_id to organizations.
-- ============================================================

-- ============================================================
-- Table: public.organizations
-- One org per enterprise customer. Profiles reference this.
-- ============================================================
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Table: public.courses
-- A course belongs to an organization.
-- slug is unique so /catalog/[slug] is human-readable in future.
-- ============================================================
create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  slug            text not null unique,
  description     text,
  thumbnail_url   text,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Table: public.modules
-- Ordered sections inside a course.
-- position determines display order (1-indexed).
-- ============================================================
create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  position    integer not null check (position > 0),
  created_at  timestamptz not null default now(),
  unique (course_id, position)
);

-- ============================================================
-- Table: public.lessons
-- A lesson belongs to a module. Holds video metadata.
-- ============================================================
create table if not exists public.lessons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.modules(id) on delete cascade,
  title             text not null,
  position          integer not null check (position > 0),
  video_url         text,
  mux_playback_id   text,
  transcript        text,
  duration_seconds  integer check (duration_seconds > 0),
  created_at        timestamptz not null default now(),
  unique (module_id, position)
);

-- ============================================================
-- Table: public.quiz_definitions
-- One quiz per lesson. questions is a JSONB array.
-- NEVER expose correct_answer to the client — server-side scoring only.
-- ============================================================
create table if not exists public.quiz_definitions (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null unique references public.lessons(id) on delete cascade,
  questions   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Table: public.cohorts
-- A cohort is a scheduled run of a course for a group.
-- ============================================================
create table if not exists public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  max_seats   integer not null default 0 check (max_seats >= 0),
  status      text not null default 'draft'
                check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Table: public.enrollments
-- Links a user to a cohort.
-- ============================================================
create table if not exists public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status      text not null default 'active'
                check (status in ('active', 'dropped', 'completed')),
  unique (user_id, cohort_id)
);

-- ============================================================
-- Table: public.lesson_progress
-- Tracks how far a user has watched a lesson.
-- ============================================================
create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  last_position integer not null default 0 check (last_position >= 0),
  completed     boolean not null default false,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ============================================================
-- Table: public.quiz_attempts
-- Records a submitted quiz.
-- ============================================================
create table if not exists public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  cohort_id    uuid references public.cohorts(id) on delete set null,
  answers      jsonb not null default '{}'::jsonb,
  score        integer not null default 0 check (score >= 0),
  max_score    integer not null default 0 check (max_score >= 0),
  submitted_at timestamptz not null default now()
);

-- ============================================================
-- Table: public.ai_chat_sessions
-- One session per (user, lesson) pair.
-- ============================================================
create table if not exists public.ai_chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Table: public.ai_chat_messages
-- Individual messages within a session.
-- ============================================================
create table if not exists public.ai_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ALTER TABLE: profiles.org_id → organizations FK
-- ============================================================
alter table public.profiles
  add constraint fk_profiles_org
  foreign key (org_id)
  references public.organizations(id)
  on delete set null;

-- ============================================================
-- RLS: organizations
-- ============================================================
alter table public.organizations enable row level security;

create policy "Authenticated users can view their organization"
  on public.organizations
  for select
  using (
    auth.uid() in (
      select id from public.profiles where org_id = organizations.id
    )
  );

-- ============================================================
-- RLS: courses
-- ============================================================
alter table public.courses enable row level security;

create policy "Authenticated users can view published courses"
  on public.courses
  for select
  using (auth.role() = 'authenticated' and is_published = true);

-- ============================================================
-- RLS: modules
-- ============================================================
alter table public.modules enable row level security;

create policy "Authenticated users can view modules of published courses"
  on public.modules
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.courses
      where courses.id = modules.course_id
        and courses.is_published = true
    )
  );

-- ============================================================
-- RLS: lessons
-- ============================================================
alter table public.lessons enable row level security;

create policy "Authenticated users can view lessons of published courses"
  on public.lessons
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id
        and c.is_published = true
    )
  );

-- ============================================================
-- RLS: quiz_definitions
-- ============================================================
alter table public.quiz_definitions enable row level security;

create policy "Authenticated users can view quiz definitions"
  on public.quiz_definitions
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- RLS: cohorts
-- ============================================================
alter table public.cohorts enable row level security;

create policy "Authenticated users can view cohorts"
  on public.cohorts
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- RLS: enrollments
-- ============================================================
alter table public.enrollments enable row level security;

create policy "Users can view their own enrollments"
  on public.enrollments
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- RLS: lesson_progress
-- ============================================================
alter table public.lesson_progress enable row level security;

create policy "Users can view their own lesson progress"
  on public.lesson_progress
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own lesson progress"
  on public.lesson_progress
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own lesson progress"
  on public.lesson_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- RLS: quiz_attempts
-- ============================================================
alter table public.quiz_attempts enable row level security;

create policy "Users can view their own quiz attempts"
  on public.quiz_attempts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quiz attempts"
  on public.quiz_attempts
  for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- RLS: ai_chat_sessions
-- ============================================================
alter table public.ai_chat_sessions enable row level security;

create policy "Users can view their own chat sessions"
  on public.ai_chat_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat sessions"
  on public.ai_chat_sessions
  for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- RLS: ai_chat_messages
-- ============================================================
alter table public.ai_chat_messages enable row level security;

create policy "Users can view their own chat messages"
  on public.ai_chat_messages
  for select
  using (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = ai_chat_messages.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert their own chat messages"
  on public.ai_chat_messages
  for insert
  with check (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = ai_chat_messages.session_id
        and s.user_id = auth.uid()
    )
  );
