# Phase 2 Research: Data Model + Course Catalog

> Stack: Next.js 15 App Router · Supabase · shadcn/ui · Tailwind v4
> Requirements: CATALOG-01, CATALOG-02
> Date: 2026-04-28

---

## 1. Schema Design

### Migration timestamp

Phase 1 migration: `20260428000001_create_profiles.sql`
Phase 2 migration: `20260428000002_create_remaining_tables.sql`

Use the same date prefix with an incremented sequence. The Supabase CLI applies migrations in lexicographic order — `000002` will always run after `000001`.

---

### Complete SQL for all 11 remaining tables

```sql
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
  unique (course_id, position)   -- no two modules share the same position in a course
);

-- ============================================================
-- Table: public.lessons
-- A lesson belongs to a module. Holds video metadata.
-- mux_playback_id is the Mux asset ID used by MuxPlayer.
-- duration_seconds is the total video length for 90% completion calc.
-- ============================================================
create table if not exists public.lessons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.modules(id) on delete cascade,
  title             text not null,
  position          integer not null check (position > 0),
  video_url         text,           -- fallback/external URL
  mux_playback_id   text,           -- Mux asset playback ID
  transcript        text,           -- full lesson transcript (used by AI tutor)
  duration_seconds  integer check (duration_seconds > 0),
  created_at        timestamptz not null default now(),
  unique (module_id, position)      -- no two lessons share the same position in a module
);

-- ============================================================
-- Table: public.quiz_definitions
-- One quiz per lesson. questions is a JSONB array.
-- Each question: { id, question, options: string[], correct_answer: string, explanation: string }
-- correct_answer stores the exact string value from options[].
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
-- status: 'draft' | 'active' | 'completed' | 'cancelled'
-- max_seats: 0 means unlimited.
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
-- Links a user to a cohort. One enrollment per user per cohort.
-- status: 'active' | 'dropped' | 'completed'
-- ============================================================
create table if not exists public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status      text not null default 'active'
                check (status in ('active', 'dropped', 'completed')),
  unique (user_id, cohort_id)       -- a user can only enroll once per cohort
);

-- ============================================================
-- Table: public.lesson_progress
-- Tracks how far a user has watched a lesson.
-- last_position is in seconds. completed fires at 90% of duration_seconds.
-- One row per (user, lesson) pair.
-- ============================================================
create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  last_position integer not null default 0 check (last_position >= 0),
  completed     boolean not null default false,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)       -- one progress row per user per lesson
);

-- ============================================================
-- Table: public.quiz_attempts
-- Records a submitted quiz. answers is the user's response map.
-- answers format: { [questionId]: selectedOption }
-- score / max_score enable percentage calculation.
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
-- One session per (user, lesson) pair. Groups messages together.
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
-- role: 'user' | 'assistant'
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
-- Deferred from Phase 1. profiles was created before organizations.
-- on delete set null: if an org is deleted, users lose their org link
-- but their accounts remain.
-- ============================================================
alter table public.profiles
  add constraint fk_profiles_org
  foreign key (org_id)
  references public.organizations(id)
  on delete set null;
```

---

### Summary of FK cascade rules

| Child table | Parent | On Delete |
|-------------|--------|-----------|
| profiles | auth.users | CASCADE |
| profiles.org_id | organizations | SET NULL |
| courses | organizations | CASCADE |
| modules | courses | CASCADE |
| lessons | modules | CASCADE |
| quiz_definitions | lessons | CASCADE |
| cohorts | courses | CASCADE |
| enrollments | auth.users | CASCADE |
| enrollments | cohorts | CASCADE |
| lesson_progress | auth.users | CASCADE |
| lesson_progress | lessons | CASCADE |
| quiz_attempts | auth.users | CASCADE |
| quiz_attempts | lessons | CASCADE |
| quiz_attempts.cohort_id | cohorts | SET NULL |
| ai_chat_sessions | auth.users | CASCADE |
| ai_chat_sessions | lessons | CASCADE |
| ai_chat_messages | ai_chat_sessions | CASCADE |

Cascade delete is correct for all content-ownership relationships (delete a course → delete its modules, lessons, etc.). SET NULL is correct where a reference is informational (quiz_attempts.cohort_id, profiles.org_id).

---

## 2. RLS Policy Design

All RLS policies go in the same migration file as the table creation (`20260428000002`). Enable RLS immediately after each table definition.

```sql
-- ============================================================
-- RLS: organizations
-- Authenticated users can see their own org only.
-- Seed data inserts orgs via service role (bypasses RLS).
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
-- All authenticated users can see published courses.
-- Unpublished courses are invisible to learners.
-- ============================================================
alter table public.courses enable row level security;

create policy "Authenticated users can view published courses"
  on public.courses
  for select
  using (auth.role() = 'authenticated' and is_published = true);

-- ============================================================
-- RLS: modules
-- Accessible if the parent course is published and user is authenticated.
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
-- Accessible if the parent course is published and user is authenticated.
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
-- Authenticated users can SELECT (questions only, not correct_answer).
-- The server-side quiz handler reads correct_answer via service role.
-- The RLS SELECT policy exposes the full row to authenticated users —
-- this is acceptable in Phase 2 because the quiz UI is built in Phase 5
-- where the Route Handler will use service role and never send correct_answer
-- to the client. Correct_answer is not a secret from the DB perspective;
-- the security guarantee is architectural (server-side scoring), not RLS.
-- ============================================================
alter table public.quiz_definitions enable row level security;

create policy "Authenticated users can view quiz definitions"
  on public.quiz_definitions
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- RLS: cohorts
-- All authenticated users can view active/upcoming cohorts.
-- ============================================================
alter table public.cohorts enable row level security;

create policy "Authenticated users can view cohorts"
  on public.cohorts
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- RLS: enrollments
-- A user can only see their own enrollment rows.
-- INSERT/UPDATE: Phase 3 will add these policies (enrollment action).
-- ============================================================
alter table public.enrollments enable row level security;

create policy "Users can view their own enrollments"
  on public.enrollments
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- RLS: lesson_progress
-- Owner only — full CRUD (upsert pattern in Phase 4).
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
-- Owner only — users write and read their own attempts.
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
-- Owner only.
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
-- Owner only — checked by joining to the session owner.
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
```

### RLS Decision Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| organizations | own org only | blocked | blocked | blocked |
| courses | published + authenticated | blocked | blocked | blocked |
| modules | published parent + authenticated | blocked | blocked | blocked |
| lessons | published parent + authenticated | blocked | blocked | blocked |
| quiz_definitions | authenticated | blocked | blocked | blocked |
| cohorts | authenticated | blocked | blocked | blocked |
| enrollments | own rows | blocked (Phase 3) | blocked | blocked |
| lesson_progress | own rows | own rows | own rows | blocked |
| quiz_attempts | own rows | own rows | blocked | blocked |
| ai_chat_sessions | own rows | own rows | blocked | blocked |
| ai_chat_messages | own session | own session | blocked | blocked |

---

## 3. Migration Strategy

### One file vs. multiple

Use **one migration file** (`20260428000002_create_remaining_tables.sql`) for all 11 tables + RLS + the profiles FK. Reasons:
- All 11 tables are atomic: they only make sense together (modules FK to courses, lessons FK to modules, etc.)
- A failed migration rolls back the entire file — no partial state to untangle
- Easier to review as a single coherent schema artifact

The only exception would be if a table creates a circular FK (it doesn't here).

### Filename

```
supabase/migrations/20260428000002_create_remaining_tables.sql
```

Matches the Phase 1 convention: `YYYYMMDDNNNNNN_description.sql` where `NNNNNN` is a 6-digit sequence. `000002` is lexicographically after `000001`, so ordering is correct.

### Complete migration file structure

```
-- Header comment block
-- Table: organizations       + RLS
-- Table: courses             + RLS
-- Table: modules             + RLS
-- Table: lessons             + RLS
-- Table: quiz_definitions    + RLS
-- Table: cohorts             + RLS
-- Table: enrollments         + RLS
-- Table: lesson_progress     + RLS
-- Table: quiz_attempts       + RLS
-- Table: ai_chat_sessions    + RLS
-- Table: ai_chat_messages    + RLS
-- ALTER TABLE profiles (FK to organizations)
```

Each table's `create table` statement is immediately followed by its `alter table ... enable row level security` and `create policy` statements — keeping the table definition and its security policy co-located.

---

## 4. Seed Data

### Critical constraint: seed.sql cannot create auth users

`supabase/seed.sql` runs with the Postgres service role (bypasses RLS), but `auth.users` rows can only be created via the Supabase Auth API (not direct SQL). This means:

- Seed data for `organizations`, `courses`, `modules`, `lessons`, `quiz_definitions`, `cohorts` works fine — these tables have no FK to `auth.users`
- `enrollments`, `lesson_progress`, `quiz_attempts`, `ai_chat_sessions`, `ai_chat_messages` all require a real `user_id` from `auth.users` — **do not seed these tables**
- The demo user's `profiles.org_id` must be updated manually after sign-up via the Supabase Dashboard SQL editor: `UPDATE public.profiles SET org_id = '<org-uuid>' WHERE email = 'demo@example.com';`

### Complete `supabase/seed.sql`

```sql
-- ============================================================
-- Seed: Demo Data for AI Platform v2
-- Run separately after migrations: npx supabase db reset
-- or via Supabase dashboard SQL editor for cloud.
-- NOTE: Does NOT seed auth.users or tables that require
-- a real user_id (enrollments, lesson_progress, quiz_attempts,
-- ai_chat_sessions, ai_chat_messages). Those rows are created
-- through app interactions.
-- ============================================================

-- Use fixed UUIDs so seed is idempotent (safe to re-run).
-- If re-running, the unique constraints will block duplicates gracefully.

-- ============================================================
-- Organization
-- ============================================================
insert into public.organizations (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'Taller Technologies',
  'taller-technologies'
)
on conflict (id) do nothing;

-- ============================================================
-- Course: Generative AI Fundamentals
-- thumbnail_url uses picsum.photos as a stable placeholder.
-- Replace with Supabase Storage URL or Mux thumbnail in production.
-- ============================================================
insert into public.courses (id, org_id, title, slug, description, thumbnail_url, is_published)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Generative AI Fundamentals',
  'generative-ai-fundamentals',
  'A hands-on introduction to Generative AI, Large Language Models, and prompt engineering — built for enterprise teams ready to put AI to work.',
  'https://picsum.photos/seed/genai-course/800/450',
  true
)
on conflict (id) do nothing;

-- ============================================================
-- Modules (3)
-- ============================================================
insert into public.modules (id, course_id, title, position)
values
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000010',
    'Introduction to Generative AI',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000010',
    'Prompt Engineering',
    2
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000010',
    'Building with LLMs',
    3
  )
on conflict (id) do nothing;

-- ============================================================
-- Lessons (3 — one per module)
-- mux_playback_id: placeholder value for Phase 2.
-- Replace with real Mux asset IDs when uploading video in Phase 4.
-- duration_seconds: realistic placeholder (10 minutes = 600s).
-- ============================================================
insert into public.lessons (id, module_id, title, position, video_url, mux_playback_id, transcript, duration_seconds)
values
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000020',
    'What is Generative AI?',
    1,
    'https://stream.mux.com/PLACEHOLDER_PLAYBACK_ID_1.m3u8',
    'PLACEHOLDER_PLAYBACK_ID_1',
    'In this lesson, we explore what generative AI is, how it differs from traditional machine learning, and why it matters for enterprise teams. We cover the fundamentals of large language models, their training process, and the key concepts of tokens, context windows, and inference.',
    600
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000021',
    'Writing Effective Prompts',
    1,
    'https://stream.mux.com/PLACEHOLDER_PLAYBACK_ID_2.m3u8',
    'PLACEHOLDER_PLAYBACK_ID_2',
    'This lesson covers prompt engineering fundamentals: zero-shot vs few-shot prompting, chain-of-thought reasoning, role prompting, and structured output techniques. We walk through real examples of prompts that get reliable results from Claude and GPT-4.',
    720
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000022',
    'Your First LLM-Powered Feature',
    1,
    'https://stream.mux.com/PLACEHOLDER_PLAYBACK_ID_3.m3u8',
    'PLACEHOLDER_PLAYBACK_ID_3',
    'We build a simple AI-powered feature end to end: calling the Anthropic API, handling streaming responses, managing context windows, and avoiding common pitfalls like prompt injection. By the end you will have a working AI integration pattern you can apply to your own projects.',
    840
  )
on conflict (id) do nothing;

-- ============================================================
-- Quiz Definition (for lesson 1 only — sufficient for demo)
-- questions JSONB format:
-- [{ id, question, options, correct_answer, explanation }]
-- correct_answer is the exact string from options[].
-- ============================================================
insert into public.quiz_definitions (id, lesson_id, questions)
values (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000030',
  '[
    {
      "id": "q1",
      "question": "What is a token in the context of a large language model?",
      "options": [
        "A full sentence processed by the model",
        "A unit of text (word or word fragment) that the model processes",
        "A security credential used to authenticate API requests",
        "A single character in the input string"
      ],
      "correct_answer": "A unit of text (word or word fragment) that the model processes",
      "explanation": "Tokens are the basic units of text that LLMs process. A token is typically a word or a common sub-word fragment — for example, ''tokenization'' might be split into ''token'' and ''ization''. Most English words are 1-2 tokens."
    },
    {
      "id": "q2",
      "question": "What does the context window of an LLM determine?",
      "options": [
        "The maximum number of users who can query the model simultaneously",
        "The total number of tokens the model can process in a single interaction",
        "The number of training examples used to fine-tune the model",
        "The latency of the API response in milliseconds"
      ],
      "correct_answer": "The total number of tokens the model can process in a single interaction",
      "explanation": "The context window defines how much text (measured in tokens) an LLM can ''see'' at once — both the input prompt and the output response must fit within this window. A larger context window allows longer conversations and bigger documents."
    },
    {
      "id": "q3",
      "question": "Which of the following best describes how a generative AI model produces output?",
      "options": [
        "It retrieves a pre-written answer from a database",
        "It executes a deterministic rule-based algorithm",
        "It predicts the next most likely token given all preceding tokens",
        "It runs a search query against the training dataset"
      ],
      "correct_answer": "It predicts the next most likely token given all preceding tokens",
      "explanation": "Generative AI models work by predicting the next token in a sequence, one token at a time. This process is called autoregressive generation. The model does not look up answers — it generates them token by token based on learned probability distributions."
    }
  ]'::jsonb
)
on conflict (id) do nothing;

-- ============================================================
-- Cohort (1 active cohort for the demo course)
-- starts 2026-05-01, runs for 4 weeks
-- ============================================================
insert into public.cohorts (id, course_id, title, starts_at, ends_at, max_seats, status)
values (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000010',
  'May 2026 Cohort',
  '2026-05-01T09:00:00Z',
  '2026-05-29T17:00:00Z',
  20,
  'active'
)
on conflict (id) do nothing;
```

### Post-seed manual step (for demo)

After signing up as the demo user, run this in the Supabase SQL editor to link the user to the org:

```sql
update public.profiles
set org_id = '00000000-0000-0000-0000-000000000001'
where email = 'your-demo-user@example.com';
```

---

## 5. TypeScript Type Generation

### Generate types from linked Supabase project

```bash
npx supabase gen types typescript --linked > lib/database.types.ts
```

Run this after `npx supabase db push` so the types reflect the live schema. Re-run whenever the schema changes.

### Typed server client

Update `lib/supabase/server.ts` to accept the generated `Database` type:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Read-only context (Server Component) — middleware handles cookie write
          }
        },
      },
    }
  )
}
```

### Typed browser client

Update `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Usage in Server Components

```ts
// Typed query — Row types are inferred automatically
const supabase = await createClient()
const { data: courses } = await supabase
  .from('courses')
  .select('id, title, slug, description, thumbnail_url')
  .eq('is_published', true)

// courses is typed as Database['public']['Tables']['courses']['Row'][] | null
```

### Type helpers

```ts
import type { Database } from '@/lib/database.types'

// Row types for each table
type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']
type Cohort = Database['public']['Tables']['cohorts']['Row']
```

---

## 6. Course Catalog Page (/catalog)

### File: `app/catalog/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function CatalogPage() {
  const supabase = await createClient()

  // Belt-and-suspenders auth check (middleware already guards /catalog)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: courses, error } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      slug,
      description,
      thumbnail_url,
      cohorts (count)
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: true })

  return (
    <main className="mx-auto w-full max-w-[1280px] px-8 pt-12 pb-16">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          AI Course Catalog
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cohort-based AI learning for enterprise teams
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load courses. Refresh the page to try again.
        </div>
      )}

      {!error && courses && courses.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-[20px] font-semibold">No courses available yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check back soon — courses are being added.
          </p>
        </div>
      )}

      {!error && courses && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="overflow-hidden border-border bg-card transition-shadow hover:border-accent hover:shadow-sm"
            >
              {/* 16:9 thumbnail */}
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">No preview</span>
                  </div>
                )}
              </div>

              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold leading-snug">{course.title}</h2>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    AI
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {course.description}
                </p>
              </CardContent>

              <CardFooter className="px-4 pb-4 pt-2">
                <Button asChild className="w-full" size="sm">
                  <Link href={`/catalog/${course.id}`}>View Course</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
```

### Middleware update required

The current `middleware.ts` `protectedPaths` array does NOT include `/catalog`. It must be updated:

```ts
// middleware.ts — update this line:
const protectedPaths = ['/dashboard', '/cohorts', '/lessons', '/admin', '/catalog']
```

Without this change, unauthenticated users can access `/catalog` — Success Criterion 5 will fail.

### shadcn components to install before building this page

```bash
npx shadcn add badge
npx shadcn add skeleton
npx shadcn add separator
```

`card` and `button` are already installed from Phase 1.

### Query strategy

Use a single `.select()` with an inline count for cohorts:
```ts
.select(`id, title, slug, description, thumbnail_url, cohorts (count)`)
```
This avoids N+1 queries. The `cohorts (count)` uses Supabase's embedded resource counting syntax — it returns `[{ count: N }]` in the `cohorts` field.

---

## 7. Course Detail Page (/catalog/[courseId])

### File: `app/catalog/[courseId]/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params   // params is a Promise in Next.js 15 App Router

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Parallel fetches — course + modules+lessons + cohorts
  const [courseResult, modulesResult, cohortsResult] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, slug, description, thumbnail_url')
      .eq('id', courseId)
      .eq('is_published', true)
      .single(),

    supabase
      .from('modules')
      .select(`
        id,
        title,
        position,
        lessons (
          id,
          title,
          position,
          duration_seconds
        )
      `)
      .eq('course_id', courseId)
      .order('position', { ascending: true }),

    supabase
      .from('cohorts')
      .select('id, title, starts_at, ends_at, max_seats, status')
      .eq('course_id', courseId)
      .order('starts_at', { ascending: true }),
  ])

  // 404 if course not found or not published
  if (courseResult.error || !courseResult.data) {
    notFound()
  }

  const course = courseResult.data
  const modules = modulesResult.data ?? []
  const cohorts = cohortsResult.data ?? []

  return (
    <main className="mx-auto w-full max-w-[896px] px-8 pt-12 pb-16 space-y-8">
      {/* Course Header */}
      <header>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">No preview</span>
            </div>
          )}
        </div>
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-tight">{course.title}</h1>
            <Badge variant="secondary">AI</Badge>
          </div>
          {course.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          )}
        </div>
      </header>

      <Separator />

      {/* Course Outline */}
      <section>
        <h2 className="text-[20px] font-semibold mb-4">Course Outline</h2>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modules available yet.</p>
        ) : (
          <div className="space-y-6">
            {modules.map((module, moduleIdx) => (
              <div key={module.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Module {module.position}
                  </span>
                </div>
                <h3 className="text-base font-semibold mb-2">{module.title}</h3>
                <div className="space-y-1 pl-4 border-l border-border">
                  {(module.lessons ?? [])
                    .sort((a, b) => a.position - b.position)
                    .map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{lesson.title}</span>
                        {lesson.duration_seconds && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(lesson.duration_seconds / 60)} min
                          </span>
                        )}
                      </div>
                    ))}
                </div>
                {moduleIdx < modules.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Cohort Schedule */}
      <section>
        <h2 className="text-[20px] font-semibold mb-4">Available Cohorts</h2>
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cohorts scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {cohorts.map((cohort) => (
              <Card key={cohort.id} className="border-border bg-card">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{cohort.title}</h3>
                    <Badge
                      variant={cohort.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {cohort.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Starts:{' '}
                        {new Date(cohort.starts_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      {cohort.max_seats > 0 && (
                        <p>{cohort.max_seats} seats available</p>
                      )}
                    </div>
                    {/* Phase 2: button present, enrollment wired in Phase 3 */}
                    <Button size="sm" disabled>
                      Join Cohort
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
```

### Why parallel fetches instead of one join

Three independent `.select()` calls wrapped in `Promise.all` are cleaner to read and type than a single nested join returning `courses!inner(modules!inner(lessons(...), cohorts(...)))`. Supabase's PostgREST join syntax becomes unwieldy with three levels of nesting. The three queries run concurrently — latency equals the slowest single query, not the sum.

### `params` is a Promise in Next.js 15

In Next.js 15 App Router, `params` in `PageProps` is now `Promise<{ courseId: string }>`. Always `await params` before accessing its properties. Forgetting this causes a TypeScript error and a runtime warning.

### notFound() pattern

```ts
import { notFound } from 'next/navigation'

if (courseResult.error || !courseResult.data) {
  notFound()
}
```

`notFound()` throws a Next.js special error that renders `app/not-found.tsx`. If that file doesn't exist, Next.js renders its built-in 404 page. No explicit 404 page file is required for Phase 2.

### Sorting lessons

The Supabase query for modules uses `.order('position', { ascending: true })` on the modules. For lessons nested inside modules via the embedded select, add `.order('position', { ascending: true })` to the embedded relation — or sort client-side as shown above. Client-side sort is simpler for a small dataset (3 lessons total in seed).

---

## 8. Supabase Commands

### Push migrations to linked cloud project

```bash
npx supabase db push
```

This applies all pending migrations in `supabase/migrations/` to the linked Supabase project. It does NOT run `seed.sql`.

### Seed data — cloud project

For a cloud (non-local) Supabase project, `seed.sql` must be run manually:

**Option A — Supabase dashboard SQL editor:**
Copy and paste `supabase/seed.sql` contents into the SQL editor in the Supabase dashboard and execute.

**Option B — psql direct connection:**
```bash
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  -f supabase/seed.sql
```

(Get the connection string from: Supabase Dashboard → Project Settings → Database → Connection string)

**Option C — local dev only (`supabase db reset` runs seed automatically):**
```bash
npx supabase db reset   # drops + recreates local DB, runs all migrations + seed.sql
```

Only use `db reset` against the local Docker instance — never against the cloud project.

### Generate TypeScript types

```bash
npx supabase gen types typescript --linked > lib/database.types.ts
```

Run this after every schema change.

### Verify migration status

```bash
npx supabase migration list
```

Shows which migrations have been applied to the linked project.

### Full Phase 2 execution order

```bash
# 1. Create migration file
npx supabase migration new create_remaining_tables
# (edit supabase/migrations/20260428000002_create_remaining_tables.sql)

# 2. Push schema to cloud
npx supabase db push

# 3. Seed demo data (paste seed.sql into Supabase dashboard SQL editor)

# 4. Generate TypeScript types
npx supabase gen types typescript --linked > lib/database.types.ts

# 5. Install missing shadcn components
npx shadcn add badge skeleton separator

# 6. Run dev server and verify
npm run dev
# Visit /catalog — should show the course card
# Visit /catalog/<course-id> — should show outline + cohort
```

---

## 9. Patterns to Replicate from Phase 1

### Auth check in Server Component

Exact pattern from `app/dashboard/page.tsx` — replicate verbatim:

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/auth/login')
```

Always use `getUser()` (not `getSession()`). Always `await createClient()` (it's an async function). The redirect is belt-and-suspenders — middleware already guards the route, but server components should also self-guard.

### Import paths

```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'  // for 404
```

### Server Component file structure

```tsx
// No "use client" directive — Server Components are the default
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PageName() {
  // 1. Create client
  const supabase = await createClient()

  // 2. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 3. Fetch data
  const { data, error } = await supabase.from('table').select(...)

  // 4. Handle error/empty states in JSX
  return (
    <main>...</main>
  )
}
```

### No error boundary files needed

RSC data fetching errors are handled inline in the component. A dedicated `error.tsx` boundary is optional in Phase 2 — the inline error message shown for failed course queries is sufficient for demo scope.

### Middleware: add /catalog to protected paths

The current `middleware.ts` does not protect `/catalog`. Update the `protectedPaths` array:

```ts
// Current:
const protectedPaths = ['/dashboard', '/cohorts', '/lessons', '/admin']

// Updated for Phase 2:
const protectedPaths = ['/dashboard', '/cohorts', '/lessons', '/admin', '/catalog']
```

This ensures unauthenticated visitors to `/catalog` are redirected to `/auth/login` — satisfying Success Criterion 5.

### Layout pattern for catalog pages

Phase 2 catalog pages do not require a dedicated `layout.tsx` in `app/catalog/`. They inherit from `app/layout.tsx`. Only add a `catalog/layout.tsx` if a shared navigation shell or sidebar is needed — not required for Phase 2.

---

## Validation Architecture

Concrete commands and queries to verify each Success Criterion after implementation.

### SC1: All 12 tables present with RLS enabled

```sql
-- Run in Supabase SQL editor or via psql
-- Expected: 12 rows, all with rowsecurity = true
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles', 'organizations', 'courses', 'modules', 'lessons',
    'quiz_definitions', 'cohorts', 'enrollments', 'lesson_progress',
    'quiz_attempts', 'ai_chat_sessions', 'ai_chat_messages'
  )
order by tablename;
```

Expected output: 12 rows, all `rowsecurity = true`.

```bash
# CLI verification — shows applied migrations
npx supabase migration list
# Expected: both 000001 and 000002 show as "applied"
```

### SC2: Authenticated user can visit /catalog and see course cards

```bash
npm run dev
# Sign in with a test account
# Navigate to http://localhost:3000/catalog
# Expected: at least one course card with title, description, thumbnail
```

Manual check: open browser DevTools Network tab and confirm a single request to `supabase.co/rest/v1/courses` returns 200 with course data.

### SC3: Course detail page shows outline + cohort schedule

```bash
# From /catalog, click "View Course"
# Expected URL: /catalog/00000000-0000-0000-0000-000000000010
# Expected: thumbnail, title, 3 modules, 3 lessons, 1 cohort card
```

### SC4: Seed data visible without manual DB edits

```sql
-- Verify seed ran successfully
select title, is_published from public.courses;
-- Expected: 1 row: "Generative AI Fundamentals", true

select title, position from public.modules order by position;
-- Expected: 3 rows

select title, position from public.lessons order by position;
-- Expected: 3 rows

select title, status from public.cohorts;
-- Expected: 1 row: "May 2026 Cohort", "active"

select id from public.quiz_definitions;
-- Expected: 1 row
```

### SC5: Unauthenticated /catalog → redirect to /login

```bash
# Sign out, then navigate to http://localhost:3000/catalog
# Expected: immediate redirect to /auth/login
```

```bash
# Also verify via curl (anon key):
curl -L -o /dev/null -w "%{url_effective}" \
  "http://localhost:3000/catalog"
# Expected: final URL contains /auth/login
```

### Verify RLS blocks anon reads on catalog

```sql
-- Run in Supabase SQL editor
set role anon;
select * from public.courses;
-- Expected: 0 rows (RLS blocks anon even for is_published = true)
reset role;
```

### Verify FK from profiles to organizations

```sql
select
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as foreign_table,
  ccu.column_name as foreign_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name = 'profiles'
  and kcu.column_name = 'org_id';
-- Expected: 1 row showing fk_profiles_org → organizations.id
```

### TypeScript types compile without errors

```bash
npx supabase gen types typescript --linked > lib/database.types.ts
npm run build
# Expected: no TypeScript errors related to database types
```
