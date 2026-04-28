# Architecture Research
## AI-Native E-Learning Platform — Enterprise Cohort Model

**Stack:** Next.js 14+ (App Router) · Supabase (Auth, Postgres, Storage) · Claude API  
**Date:** 2026-04-28  
**Scope:** Full system design from data model through build order

---

## Component Map

### Client Layer (Browser)

| Component | Responsibility |
|---|---|
| `AuthShell` | Wraps unauthenticated routes; handles Supabase OAuth / magic-link redirects |
| `AppShell` | Authenticated layout: sidebar nav, cohort switcher, user menu |
| `VideoPlayer` | Custom wrapper around hosted video iframe/SDK; emits progress events at 5 s intervals and on pause/seek |
| `QuizRunner` | Renders question sequences, validates answers client-side, submits attempt to server action |
| `AIChatPanel` | Streaming chat UI — renders SSE chunks from `/api/ai/chat`; maintains local message history |
| `CohortDashboard` | Aggregated view: cohort progress, peer list, upcoming deadlines |
| `LessonPage` | Composes VideoPlayer + transcript + QuizRunner + AIChatPanel |

### Server Layer (Next.js)

| Component | Responsibility |
|---|---|
| Server Components | Data fetching directly from Supabase (no waterfall); render initial HTML |
| Server Actions | Mutations: enroll in cohort, submit quiz attempt, upsert lesson progress |
| Route Handlers (`/api`) | Streaming endpoints only — AI chat SSE, video progress webhooks from CDN |

### Supabase Layer

| Component | Responsibility |
|---|---|
| Auth | JWT issuance, session refresh, OAuth providers; Row Level Security on every table |
| Postgres | Single source of truth for all relational data |
| Storage | Video files (private bucket, signed URLs) or CDN origin proxy; course assets |
| Edge Functions (optional) | Heavy background jobs: quiz scoring pipeline, cohort analytics rollups |
| Realtime (optional Phase 3) | Broadcast cohort peer progress updates to connected clients |

### AI Layer

| Component | Responsibility |
|---|---|
| Claude API (claude-sonnet-4-6) | AI tutor responses, streamed |
| Context Injector | Server-side module that fetches lesson transcript + quiz results + user history, builds system prompt |
| Session Store | `ai_chat_sessions` + `ai_chat_messages` tables; maintains conversation continuity |

---

## Core Data Model

All tables use `uuid` primary keys with `gen_random_uuid()` defaults. `created_at` / `updated_at` default to `now()` on every table unless noted.

### `users`
Managed by Supabase Auth (`auth.users`). Extend with a public profile table:

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  avatar_url   text,
  role         text not null default 'learner',  -- 'learner' | 'instructor' | 'admin'
  org_id       uuid references organizations(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

### `organizations`
```sql
create table organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  created_at   timestamptz not null default now()
);
```

### `courses`
```sql
create table courses (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id),
  title        text not null,
  slug         text unique not null,
  description  text,
  thumbnail_url text,
  is_published boolean not null default false,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

### `modules`
Ordered sections within a course.

```sql
create table modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  title        text not null,
  position     integer not null,  -- display order
  created_at   timestamptz not null default now()
);
```

### `lessons`
Each lesson belongs to a module. A lesson has exactly one video and optionally one quiz.

```sql
create table lessons (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null references modules(id) on delete cascade,
  title           text not null,
  position        integer not null,
  video_url       text,             -- signed storage URL or external CDN URL
  video_duration  integer,          -- seconds
  transcript_text text,             -- plain text, fed to AI context
  has_quiz        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### `quiz_definitions`
One quiz per lesson (1:1). Questions stored as JSONB for schema flexibility.

```sql
create table quiz_definitions (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null unique references lessons(id) on delete cascade,
  title      text,
  questions  jsonb not null,
  -- questions shape:
  -- [{ id: uuid, type: 'mcq'|'true_false'|'short', text: string,
  --    options?: string[], correct_answer: string|string[], explanation: string }]
  pass_score integer not null default 70,  -- percentage
  created_at timestamptz not null default now()
);
```

### `cohorts`
A cohort is a scheduled run of a course for a group of learners.

```sql
create table cohorts (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  name         text not null,
  start_date   date not null,
  end_date     date,
  max_learners integer,
  is_open      boolean not null default true,  -- accepting enrollments
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

### `enrollments`
Junction between a profile and a cohort. One enrollment per user per cohort.

```sql
create table enrollments (
  id           uuid primary key default gen_random_uuid(),
  cohort_id    uuid not null references cohorts(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  status       text not null default 'active',  -- 'active' | 'completed' | 'dropped'
  unique (cohort_id, user_id)
);
```

### `lesson_progress`
Tracks per-user, per-lesson video watch state. Upserted on every progress heartbeat.

```sql
create table lesson_progress (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  lesson_id        uuid not null references lessons(id) on delete cascade,
  enrollment_id    uuid not null references enrollments(id) on delete cascade,
  watch_percent    numeric(5,2) not null default 0,   -- 0.00 – 100.00
  last_position    integer not null default 0,         -- seconds
  completed        boolean not null default false,
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  unique (user_id, lesson_id)
);
```

### `quiz_attempts`
Each submission by a user. Multiple attempts allowed; best score used for progress.

```sql
create table quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  quiz_id         uuid not null references quiz_definitions(id) on delete cascade,
  enrollment_id   uuid not null references enrollments(id) on delete cascade,
  answers         jsonb not null,   -- [{ question_id, selected_answer }]
  score           integer not null, -- percentage 0-100
  passed          boolean not null,
  submitted_at    timestamptz not null default now()
);
```

### `ai_chat_sessions`
One session per user per lesson (can be reopened across visits).

```sql
create table ai_chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  lesson_id     uuid not null references lessons(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id),
  context_hash  text,   -- hash of lesson context used; detect stale prompts
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);
```

### `ai_chat_messages`
Individual turns within a session.

```sql
create table ai_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references ai_chat_sessions(id) on delete cascade,
  role        text not null,  -- 'user' | 'assistant'
  content     text not null,
  created_at  timestamptz not null default now()
);
```

---

## Data Flow: Demo Path

### Step 1 — Sign Up

1. User hits `/auth/signup`; submits email + password.
2. Supabase Auth creates `auth.users` record and sends confirmation email.
3. A Postgres trigger fires: `after insert on auth.users` → inserts a matching row into `public.profiles`.
4. On email confirmation, Supabase redirects to `/auth/callback?code=...`.
5. Next.js route handler at `/app/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`, sets the session cookie.
6. User is redirected to `/dashboard`.

### Step 2 — Join Cohort

1. User navigates to `/cohorts` — server component queries `cohorts` where `is_open = true`, joined with `courses`.
2. User clicks "Enroll" → triggers a Server Action `enrollInCohort(cohortId)`.
3. Server Action:
   a. Reads `userId` from Supabase session (server-side).
   b. Checks `enrollments` for an existing record (idempotent).
   c. Inserts into `enrollments` (`cohort_id`, `user_id`, `status: 'active'`).
   d. Returns `{ enrollmentId }`.
4. Client is redirected to `/cohorts/[cohortId]/dashboard`.

### Step 3 — Watch Video

1. User navigates to `/cohorts/[cohortId]/lessons/[lessonId]`.
2. Server component:
   a. Fetches `lesson` row (title, `video_url`, `video_duration`).
   b. Fetches existing `lesson_progress` row for this user+lesson (to resume position).
   c. Fetches user's `quiz_attempts` for this lesson's quiz.
3. `video_url` is a Supabase Storage signed URL with 1-hour TTL generated server-side.
4. `VideoPlayer` component mounts; sets initial seek position to `last_position`.
5. Every 5 seconds while playing, client fires `POST /api/video/progress`:
   - Body: `{ lessonId, enrollmentId, position, watchPercent }`.
   - Route handler upserts `lesson_progress` (updates `watch_percent`, `last_position`, sets `completed = true` when `watch_percent >= 90`).
6. No real-time fan-out in Phase 1; cohort peers see each other's progress on next page load.

### Step 4 — Take Quiz

1. After video completes (or at any time), `QuizRunner` component renders if `lesson.has_quiz`.
2. Questions come from `quiz_definitions` fetched in the same server component load.
3. User submits answers → Server Action `submitQuizAttempt({ quizId, enrollmentId, answers })`:
   a. Loads `quiz_definitions.questions` server-side (never trust client-side scoring).
   b. Scores each answer; computes total percentage.
   c. Inserts into `quiz_attempts`.
   d. Returns `{ score, passed, explanations }`.
4. Client renders per-question feedback and pass/fail banner.

### Step 5 — Chat with AI Tutor

1. User opens the `AIChatPanel` on the lesson page.
2. Client fetches or creates session via Server Action `getOrCreateChatSession({ lessonId, enrollmentId })`:
   - Upserts `ai_chat_sessions`; returns `sessionId` and prior `ai_chat_messages`.
3. User types a message; client sends `POST /api/ai/chat` with:
   - `{ sessionId, message, lessonId }`.
4. Route handler (`/app/api/ai/chat/route.ts`):
   a. Validates session ownership via Supabase JWT.
   b. Loads context: `lessons.transcript_text`, last `quiz_attempts` score, last 10 `ai_chat_messages` for this session.
   c. Builds system prompt (see Claude API Integration section).
   d. Calls `anthropic.messages.stream(...)`.
   e. Inserts user message into `ai_chat_messages` immediately.
   f. Streams Claude response back as `text/event-stream` (SSE).
   g. On stream end, inserts assistant message into `ai_chat_messages`.
5. `AIChatPanel` renders each SSE chunk as it arrives.

---

## Next.js App Router Structure

```
app/
├── layout.tsx                         # Root layout: font, Supabase provider
├── page.tsx                           # Marketing / landing page
│
├── auth/
│   ├── login/page.tsx                 # Email/password + OAuth buttons
│   ├── signup/page.tsx
│   ├── callback/route.ts              # POST: exchange code for session
│   └── logout/route.ts               # POST: sign out, clear cookies
│
├── dashboard/
│   └── page.tsx                       # Authenticated home: enrolled cohorts list
│
├── cohorts/
│   ├── page.tsx                       # Browse open cohorts
│   ├── [cohortId]/
│   │   ├── layout.tsx                 # Cohort shell: sidebar with module/lesson tree
│   │   ├── dashboard/page.tsx         # Cohort home: peer progress, deadlines
│   │   └── lessons/
│   │       └── [lessonId]/
│   │           └── page.tsx           # Video + quiz + AI chat (main learning page)
│
├── admin/                             # Role-gated: role === 'admin' | 'instructor'
│   ├── layout.tsx                     # Admin shell
│   ├── courses/
│   │   ├── page.tsx                   # Course list
│   │   ├── new/page.tsx
│   │   └── [courseId]/
│   │       ├── page.tsx               # Edit course metadata
│   │       └── modules/[moduleId]/
│   │           └── lessons/[lessonId]/page.tsx
│   └── cohorts/
│       ├── page.tsx
│       └── [cohortId]/page.tsx        # Manage enrollments
│
└── api/
    ├── video/
    │   └── progress/route.ts          # POST: upsert lesson_progress (5 s heartbeat)
    └── ai/
        └── chat/route.ts              # POST: SSE streaming AI tutor response
```

### Server Actions (in `lib/actions/`)

| File | Actions |
|---|---|
| `auth.actions.ts` | `signUp`, `signIn`, `signOut` |
| `cohort.actions.ts` | `enrollInCohort`, `dropFromCohort` |
| `quiz.actions.ts` | `submitQuizAttempt` |
| `chat.actions.ts` | `getOrCreateChatSession` |
| `admin.actions.ts` | `createCourse`, `publishCourse`, `createCohort`, `updateCohort` |

**Rule:** Server Actions handle all writes. Route Handlers handle only streaming (AI) and high-frequency writes (video progress heartbeat) where streaming or direct HTTP semantics are needed.

---

## Supabase Patterns

### Auth Setup

```ts
// lib/supabase/server.ts  — server component / server action client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(),
                 setAll: (c) => c.forEach(({ name, value, options }) =>
                   cookieStore.set(name, value, options)) } }
  )
}

// lib/supabase/client.ts  — client components
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Profile auto-creation trigger (run once in Supabase SQL editor):

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### RLS Policies

**Core principle:** users can only see and modify their own data; instructors/admins can see their org's data.

```sql
-- profiles: users read/update their own row
alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (auth.uid() = id);

-- courses: anyone can read published courses; instructors manage their own
alter table courses enable row level security;
create policy "read published" on courses
  for select using (is_published = true);
create policy "instructor manage" on courses
  for all using (created_by = auth.uid());

-- cohorts: learners can read open cohorts; instructors manage their own
alter table cohorts enable row level security;
create policy "read open cohorts" on cohorts
  for select using (is_open = true);

-- enrollments: users see and create their own
alter table enrollments enable row level security;
create policy "own enrollments" on enrollments
  for all using (user_id = auth.uid());

-- lesson_progress: users manage their own rows only
alter table lesson_progress enable row level security;
create policy "own progress" on lesson_progress
  for all using (user_id = auth.uid());

-- quiz_attempts: users manage their own
alter table quiz_attempts enable row level security;
create policy "own attempts" on quiz_attempts
  for all using (user_id = auth.uid());

-- ai_chat_sessions + ai_chat_messages: user-scoped
alter table ai_chat_sessions enable row level security;
create policy "own sessions" on ai_chat_sessions
  for all using (user_id = auth.uid());

alter table ai_chat_messages enable row level security;
create policy "own messages via session" on ai_chat_messages
  for all using (
    session_id in (select id from ai_chat_sessions where user_id = auth.uid())
  );
```

### Storage

- Bucket: `course-videos` — **private** (no public access).
- Signed URL generation (server-side only, never expose in client code):

```ts
const { data } = await supabase.storage
  .from('course-videos')
  .createSignedUrl(lesson.video_path, 3600)  // 1-hour TTL
```

- Bucket policy (Storage RLS): only authenticated users belonging to an active enrollment for the course can read. Implement via a Postgres function called from a Storage policy:

```sql
-- Storage policy on course-videos bucket
create policy "enrolled users can read videos"
on storage.objects for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1 from enrollments e
    join cohorts c on c.id = e.cohort_id
    join courses co on co.id = c.course_id
    where e.user_id = auth.uid()
    and e.status = 'active'
    -- match bucket path prefix: course-videos/{courseId}/...
    and (storage.foldername(name))[1] = co.id::text
  )
);
```

### Realtime (Phase 3 — Optional)

Enable on `lesson_progress` table for cohort peer progress:

```ts
supabase.channel(`cohort-${cohortId}`)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'lesson_progress' },
      (payload) => updatePeerProgress(payload.new))
  .subscribe()
```

Restrict realtime to rows the subscriber is enrolled in via a realtime filter policy.

---

## Claude API Integration

### Streaming Route Handler

```ts
// app/api/ai/chat/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/ai/prompt-builder'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { sessionId, message, lessonId } = await req.json()

  // Verify session ownership
  const { data: session } = await supabase
    .from('ai_chat_sessions')
    .select('id, lesson_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (!session) return new Response('Forbidden', { status: 403 })

  // Build context
  const systemPrompt = await buildSystemPrompt({ supabase, userId: user.id, lessonId })

  // Load conversation history (last 10 turns)
  const { data: history } = await supabase
    .from('ai_chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  // Persist user message
  await supabase.from('ai_chat_messages')
    .insert({ session_id: sessionId, role: 'user', content: message })

  // Stream from Claude
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...(history ?? []),
      { role: 'user', content: message }
    ]
  })

  // Collect full response for DB insert
  let fullResponse = ''

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullResponse += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
      }
      // Persist assistant message after stream ends
      await supabase.from('ai_chat_messages')
        .insert({ session_id: sessionId, role: 'assistant', content: fullResponse })
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### System Prompt Builder

```ts
// lib/ai/prompt-builder.ts
export async function buildSystemPrompt({ supabase, userId, lessonId }) {
  const [lessonRes, progressRes, attemptsRes] = await Promise.all([
    supabase.from('lessons').select('title, transcript_text').eq('id', lessonId).single(),
    supabase.from('lesson_progress').select('watch_percent, completed')
      .eq('user_id', userId).eq('lesson_id', lessonId).maybeSingle(),
    supabase.from('quiz_attempts')
      .select('score, passed, submitted_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
  ])

  const lesson = lessonRes.data
  const progress = progressRes.data
  const lastAttempt = attemptsRes.data?.[0]

  return `You are an expert AI tutor for an enterprise e-learning platform.

## Current Lesson
Title: ${lesson.title}

## Lesson Transcript
${lesson.transcript_text ?? 'No transcript available.'}

## Learner Context
- Video progress: ${progress?.watch_percent ?? 0}% watched (${progress?.completed ? 'completed' : 'in progress'})
- Latest quiz score: ${lastAttempt ? `${lastAttempt.score}% (${lastAttempt.passed ? 'passed' : 'not yet passed'})` : 'no attempt yet'}

## Instructions
- Answer questions about the lesson content above.
- If asked something outside this lesson's scope, briefly redirect to relevant lesson content.
- Be concise; learners are mid-session.
- When the learner struggles with a concept, ask a Socratic follow-up before explaining directly.
- Do not reveal quiz answers verbatim; guide understanding instead.`
}
```

### Session Management

- One `ai_chat_sessions` row per (user, lesson) pair — created lazily on first message.
- Session persists across page reloads (fetched by `user_id + lesson_id` on lesson page load).
- `context_hash`: SHA-256 of `lesson.transcript_text`. If transcript is updated, old sessions can be detected as stale and soft-reset.
- History window: last 20 messages (10 turns) passed to Claude to bound token cost. Older messages remain in DB for audit/analytics but are not sent to the API.

---

## Build Order

Each phase depends on everything above it. Do not begin a phase until its dependencies are stable and tested.

```
Phase 0: Foundation
  ├── Supabase project init (Auth, DB, Storage)
  ├── Next.js project scaffold (App Router, TypeScript, Tailwind)
  ├── Supabase SSR client wiring (server + browser clients)
  └── CI/CD pipeline (GitHub Actions → Vercel preview deploys)
        │
        ▼
Phase 1: Auth + Data Model
  ├── All Postgres tables (migration files via Supabase CLI)
  ├── RLS policies on all tables
  ├── Profile auto-create trigger
  ├── /auth/signup, /auth/login, /auth/callback, /auth/logout routes
  └── Dashboard skeleton (authenticated gate, redirect logic)
        │
        ▼
Phase 2: Course Content (Read-Only)
  ├── Admin: create course, modules, lessons (forms + server actions)
  ├── Storage bucket + signed URL generation
  ├── Public: browse courses and cohorts
  └── Cohort enrollment (Server Action + enrollments table)
        │
        ▼
Phase 3: Video + Progress Tracking
  ├── VideoPlayer component with 5 s heartbeat
  ├── POST /api/video/progress route handler
  ├── lesson_progress upsert + completion detection
  └── Lesson page layout (/cohorts/[cohortId]/lessons/[lessonId])
        │
        ▼
Phase 4: Quizzes
  ├── quiz_definitions seeding (admin UI or SQL)
  ├── QuizRunner component (client-side render)
  ├── submitQuizAttempt Server Action (server-side scoring)
  └── Results display + retry logic
        │
        ▼
Phase 5: AI Tutor
  ├── anthropic SDK install + ANTHROPIC_API_KEY env var
  ├── buildSystemPrompt context builder
  ├── POST /api/ai/chat SSE route handler
  ├── ai_chat_sessions + ai_chat_messages persistence
  └── AIChatPanel streaming UI component
        │
        ▼
Phase 6: Cohort Social Layer (optional / Phase 3+)
  ├── Supabase Realtime on lesson_progress
  ├── Peer progress display in CohortDashboard
  └── Cohort completion certificates (PDF generation or static)
        │
        ▼
Phase 7: Admin & Analytics
  ├── Admin course/cohort management UI
  ├── Enrollment management
  ├── Per-cohort completion reports (aggregation queries)
  └── Quiz performance analytics
```

### Dependency Constraints

| Cannot build | Until |
|---|---|
| Video progress tracking | `lesson_progress` table + `enrollments` exist |
| Quiz submission | `quiz_definitions` seeded + `enrollments` exist |
| AI tutor | Lesson transcript data populated + `ai_chat_sessions` table + quiz data available for context |
| Cohort dashboard | Enrollments + lesson_progress both exist |
| Realtime peer progress | `lesson_progress` table + Supabase Realtime enabled on it |
| Storage signed URLs | Storage bucket created + RLS policy deployed |

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mutations | Server Actions (not API routes) | Automatic CSRF protection, co-located with components, type-safe |
| Streaming | Route Handler (`/api/ai/chat`) | Server Actions do not support streaming responses |
| Video progress | Route Handler at 5 s interval | High-frequency write; no need for full Server Action overhead |
| AI history window | Last 20 messages | Balances context quality vs. token cost; full history in DB |
| Quiz scoring | Server-side only | Prevents client manipulation of scores |
| Video access control | Signed URLs (1 h TTL) + Storage RLS | Videos never publicly accessible; TTL limits credential leakage |
| Cohort model | `cohorts` separate from `courses` | One course can run as multiple cohorts; enrollment is to cohort, not course |
