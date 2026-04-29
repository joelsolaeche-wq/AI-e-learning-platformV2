# Phase 5: Quiz Engine — Research

**Researched:** 2026-04-28
**Domain:** Quiz delivery, server-side scoring, answer-key security, Supabase RLS, Next.js Route Handler pattern
**Confidence:** HIGH

---

## Summary

Phase 5 builds on a fully-wired lesson experience (Phase 4 complete). The codebase already has the `quiz_definitions` and `quiz_attempts` tables with RLS in migrations, quiz seed data for lesson 1, and established patterns for Route Handlers (`/api/video/progress/route.ts`) and Server Actions (`enrollment.actions.ts`). The core engineering challenge is security: the `questions` JSONB column stores `correct_answer` directly alongside display fields — the server must strip answer keys before sending questions to the client, and must fetch them again server-side at submission time for scoring.

The quiz submission flow maps cleanly to the existing Route Handler pattern used for video progress: a `POST /api/quiz/submit` endpoint that authenticates the user, verifies lesson completion, fetches the full question set server-side, scores the submission, writes `quiz_attempts`, and returns the result in one response. The quiz UI is a Client Component that manages a four-state machine (LOCKED → ACTIVE → SUBMITTED → RESULTS) driven by `lesson_progress.completed` read from the Server Component at page load, then fed as a prop.

One schema gap exists: `quiz_definitions` has a permissive `auth.role() = 'authenticated'` SELECT policy rather than enrollment-scoped access. This is a low-severity risk for the demo (the questions without `correct_answer` are not sensitive), but a migration that tightens this to enrolled users is recommended.

**Primary recommendation:** Use a `POST /api/quiz/submit` Route Handler (not a Server Action) — matching the `/api/video/progress` precedent — with the quiz UI as a Client Component that fetches questions via a Server Component prop and submits via `fetch`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUIZ-01 | User can take a quiz after completing a lesson | Gate via `lesson_progress.completed` checked in Server Component at page load; pass `isLessonComplete` prop to `QuizSection` Client Component. No client-side bypass possible since prop comes from server. |
| QUIZ-02 | Quiz is scored server-side (quiz definitions never sent to client) | Server Component strips `correct_answer` before passing questions to client. Scoring route fetches full definition independently. DevTools will never show `correct_answer`. |
| QUIZ-03 | User sees score and per-question answer review immediately after submission | Route Handler returns `{ score, total, pct, breakdown }` in one response — no second round trip. Client renders results card from this response payload. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quiz access gate (lesson completion check) | API / Backend (Server Component) | — | `lesson_progress.completed` is read server-side at page load; result passed as prop to quiz Client Component so it cannot be tampered with |
| Quiz question display (sans answer key) | Frontend (Client Component) | API / Backend (Server Component strips keys) | Questions are fetched in Server Component, `correct_answer` stripped, then passed down as props |
| Quiz submission and scoring | API / Backend (Route Handler) | — | Server fetches full quiz definition including `correct_answer`, scores, inserts `quiz_attempts`, returns breakdown |
| Results display | Frontend (Client Component) | — | Client renders breakdown returned by Route Handler in RESULTS state |
| Answer attempt persistence | Database (Supabase) | API / Backend | Route Handler writes `quiz_attempts` row; RLS enforces `user_id = auth.uid()` on INSERT |

---

## Standard Stack

### Core (Already Installed — No New Installs Needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | `^0.5.2` | Server-side Supabase client for Route Handler and Server Component | Established in Phases 1–4; `createClient()` from `@/lib/supabase/server` |
| `next` | `^15.5.15` | Route Handlers, Server Components, `revalidatePath` | All quiz logic fits existing App Router patterns |
| `react-hook-form` | `^7.74.0` | Already installed — NOT used for quiz | Quiz uses controlled RadioGroup state, not RHF (quiz is not a traditional form) |
| `zod` | `^4.3.6` | Input validation in Route Handler | Already used in project; validate `{ lessonId, answers }` payload |

### New shadcn Components (Install Required)

| Component | Version | Purpose | Install |
|-----------|---------|---------|---------|
| `radio-group` | shadcn official | Accessible single-select answer options | `npx shadcn add radio-group` |
| `progress` | shadcn official | Score percentage bar in results | `npx shadcn add progress` |

These install `@radix-ui/react-radio-group` and `@radix-ui/react-progress` as peer deps. Neither is currently in `node_modules` (confirmed via `package-lock.json` scan — only `@radix-ui/react-label`, `react-slot`, `react-primitive`, `react-compose-refs` are present). [VERIFIED: package-lock.json scan]

**Installation:**
```bash
npx shadcn add radio-group
npx shadcn add progress
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route Handler POST | Server Action | Server Actions work but have different return-value ergonomics — they cannot return arbitrary JSON objects as cleanly. The video progress pattern already uses a Route Handler; consistency wins. |
| Client `fetch` for quiz load | TanStack Query | For a single quiz fetch on mount with no background refetching, plain `fetch` from Server Component is simpler and avoids adding another loading layer |
| Controlled RadioGroup state | `react-hook-form` | RHF adds indirection for a fixed-question quiz. Direct `useState` per `questionId → selectedOption` is sufficient and matches the ACTIVE/RESULTS state machine |

---

## Architecture Patterns

### System Architecture Diagram

```
LessonPage (Server Component)
├── fetch lesson_progress (user_id, lesson_id)   ← Supabase server client
│   └── isLessonComplete = progress?.completed ?? false
├── fetch quiz_definitions (lesson_id)            ← Supabase server client
│   └── strip correct_answer from each question   ← SERVER ONLY
│       → clientQuestions: { id, question, options }[]
│
└── render QuizSection (Client Component)
       props: { isLessonComplete, clientQuestions, lessonId }
       │
       ├── State: LOCKED  (isLessonComplete = false)
       │   └── disabled "Take Quiz" button + lock label
       │
       ├── State: ACTIVE  (user clicked "Take Quiz")
       │   └── RadioGroup per question (controlled state Map<questionId, selectedOption>)
       │       └── "Submit Quiz" button (disabled until all answered)
       │
       ├── State: SUBMITTED (POST /api/quiz/submit)
       │   └── optimistic "Submitting..." on button
       │
       └── State: RESULTS (Route Handler returns breakdown)
           └── score banner + per-question review + "Retake Quiz"


POST /api/quiz/submit  (Route Handler)
├── auth check → supabase.auth.getUser()
├── validate body: { lessonId, answers: Record<questionId, selectedOption> }
├── verify lesson_progress.completed = true (re-check server-side)
├── fetch quiz_definitions (lessonId) — full row with correct_answer
├── score: count matches between answers[q.id] and q.correct_answer
├── insert quiz_attempts row (user_id, lesson_id, cohort_id, answers, score, max_score)
└── return { score, total, pct, breakdown: QuestionBreakdown[] }
```

### Recommended Project Structure

```
app/
├── api/
│   ├── video/progress/route.ts     (existing)
│   └── quiz/
│       └── submit/
│           └── route.ts            (new — quiz submission + scoring)
├── dashboard/
│   └── lesson/[lessonId]/
│       └── page.tsx                (extend — add quiz data fetch + QuizSection)
components/
└── QuizSection.tsx                 (new — Client Component, owns quiz state machine)
lib/
└── actions/                        (no new Server Actions — use Route Handler)
supabase/migrations/
└── 20260428000008_quiz_rls.sql     (new — tighten quiz_definitions + quiz_attempts RLS)
```

### Pattern 1: Answer-Key Stripping in Server Component

**What:** Fetch full `quiz_definitions` row server-side, map to a client-safe shape that omits `correct_answer` and `explanation` before passing as props.

**When to use:** Any time server-held secrets must drive client UI without exposure.

```typescript
// Source: derived from established lesson page pattern (app/dashboard/lesson/[lessonId]/page.tsx)
// Full quiz definition shape from DB (server only)
type QuizQuestion = {
  id: string
  question: string
  options: string[]
  correct_answer: string   // NEVER sent to client
  explanation: string      // NEVER sent to client
}

// Client-safe shape (props to QuizSection)
type ClientQuestion = {
  id: string
  question: string
  options: string[]
  // correct_answer and explanation intentionally omitted
}

// In LessonPage Server Component:
const { data: quizDef } = await supabase
  .from('quiz_definitions')
  .select('questions')
  .eq('lesson_id', lessonId)
  .maybeSingle()

const rawQuestions = (quizDef?.questions ?? []) as QuizQuestion[]
const clientQuestions: ClientQuestion[] = rawQuestions.map(({ id, question, options }) => ({
  id,
  question,
  options,
}))
// Pass clientQuestions (not rawQuestions) to <QuizSection>
```

### Pattern 2: Route Handler for Quiz Submission

**What:** `POST /api/quiz/submit` following the exact same structure as `POST /api/video/progress`.

**When to use:** Mutation that requires auth + business logic + DB write + structured JSON response.

```typescript
// Source: mirrors app/api/video/progress/route.ts pattern exactly
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse + validate body
  let body: { lessonId?: string; answers?: Record<string, string> }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { lessonId, answers } = body
  if (!lessonId || !answers) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Server-side completion gate (re-verified, not trusted from client)
  type ProgressRow = { completed: boolean }
  const { data: rawProgress } = await supabase
    .from('lesson_progress')
    .select('completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle()
  const progress = rawProgress as unknown as ProgressRow | null
  if (!progress?.completed) {
    return NextResponse.json({ error: 'Lesson not completed' }, { status: 403 })
  }

  // Fetch full quiz definition (answer key — server only)
  type QuizDefRow = { id: string; questions: unknown }
  const { data: rawDef } = await supabase
    .from('quiz_definitions')
    .select('id, questions')
    .eq('lesson_id', lessonId)
    .maybeSingle()
  const def = rawDef as unknown as QuizDefRow | null
  if (!def) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  // Score server-side
  type Question = { id: string; question: string; options: string[]; correct_answer: string }
  const questions = def.questions as Question[]
  const breakdown = questions.map(q => ({
    questionId: q.id,
    question: q.question,
    options: q.options,
    selectedAnswer: answers[q.id] ?? null,
    correctAnswer: q.correct_answer,
    correct: answers[q.id] === q.correct_answer,
  }))
  const score = breakdown.filter(b => b.correct).length
  const total = questions.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0

  // Persist attempt (find cohort_id for the user + lesson)
  // quiz_attempts.cohort_id is nullable — skip lookup for simplicity,
  // or do a join: enrollments → cohorts → courses → modules → lessons
  const { error: insertError } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      lesson_id: lessonId,
      answers: answers as Record<string, string>,
      score,
      max_score: total,
    } as never)  // PostgREST 14.5 cast pattern — established in codebase

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 })
  }

  return NextResponse.json({ score, total, pct, breakdown })
}
```

### Pattern 3: Quiz State Machine in Client Component

**What:** A single `QuizSection` Client Component with a `quizState` enum and controlled `answers` map.

**When to use:** Multi-step UI with clear one-directional state transitions.

```typescript
// Source: derived from EnrollButton.tsx pattern (components/EnrollButton.tsx)
'use client'

type QuizState = 'LOCKED' | 'ACTIVE' | 'SUBMITTED' | 'RESULTS'

interface QuizSectionProps {
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  lessonId: string
}

export function QuizSection({ isLessonComplete, clientQuestions, lessonId }: QuizSectionProps) {
  const [quizState, setQuizState] = useState<QuizState>(
    isLessonComplete ? 'ACTIVE' : 'LOCKED'
    // Note: spec says LOCKED → user clicks "Take Quiz" → ACTIVE.
    // If isLessonComplete is true on page load, start at LOCKED still
    // so the user explicitly opts in to taking the quiz.
  )
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<QuizResults | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const allAnswered = clientQuestions.length > 0 &&
    clientQuestions.every(q => answers[q.id])

  const handleSubmit = async () => {
    setQuizState('SUBMITTED')
    setSubmitError(null)
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, answers }),
      })
      if (!res.ok) throw new Error('submit failed')
      const data = await res.json()
      setResults(data)
      setQuizState('RESULTS')
    } catch {
      setSubmitError("Couldn't submit quiz — try again")
      setQuizState('ACTIVE')
    }
  }

  const handleRetake = () => {
    setAnswers({})
    setResults(null)
    setQuizState('ACTIVE')
  }

  // ... render per quizState
}
```

### Anti-Patterns to Avoid

- **Sending `correct_answer` in the quiz fetch response:** The `quiz_definitions.questions` JSONB column stores `correct_answer` inline. A naive `.select('*')` from the server then passed as props leaks the answer key. Always explicitly map to `ClientQuestion` (omit `correct_answer`).
- **Relying on client-reported lesson completion:** The client passing `isComplete: true` in the submit body and the server trusting it defeats the gate. Re-check `lesson_progress.completed` server-side in the Route Handler.
- **Server Action for quiz submission:** Server Actions return to a form's action target and require redirect-or-state patterns. The quiz needs a structured JSON response for the results breakdown — a Route Handler is cleaner and consistent with the video progress precedent.
- **Using `as never` on the `answers` JSON field without type annotation:** The `quiz_attempts.answers` column is `Json` (not `jsonb` in type terms, but JSONB in DB). The `as never` cast is the established workaround for PostgREST 14.5 schema inference — use it consistently with `TablesInsert<'quiz_attempts'>`.
- **Putting the `QuizSection` state machine in the Server Component:** Server Components cannot use `useState`. The quiz state machine must live in a Client Component that receives its initial data as props.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible radio button group | Custom `<div>` with click handlers | `RadioGroup` / `RadioGroupItem` from shadcn | Radix handles keyboard nav (arrow keys), ARIA `role="radiogroup"` + `role="radio"`, focus management |
| Score progress bar | CSS `width` style on a `<div>` | `Progress` from shadcn | Radix `@radix-ui/react-progress` provides correct ARIA `role="progressbar"` + `aria-valuenow` |
| Input validation | Manual type checks | Zod schema in Route Handler | Already installed; consistent with project approach |

**Key insight:** The quiz has no complex custom logic to hand-roll. Every piece (radio group, progress bar, server scoring) has a standard solution already in the stack.

---

## Common Pitfalls

### Pitfall 1: Answer Key Leaking via `quiz_definitions` SELECT Policy

**What goes wrong:** The current RLS policy on `quiz_definitions` is `auth.role() = 'authenticated'` — any authenticated user can SELECT the full row including `correct_answer` fields in the JSONB. If the quiz questions are ever fetched client-side (e.g., via Supabase browser client), the raw JSON including `correct_answer` appears in DevTools network tab.

**Why it happens:** Phase 2 set a permissive policy for simplicity. The QUIZ-02 success criterion explicitly requires the answer key to never appear in client-side network responses.

**How to avoid:** Two-layer defense:
1. Always fetch `quiz_definitions` in a Server Component or Route Handler — never from a Client Component using the browser Supabase client.
2. Add a migration that replaces the permissive SELECT policy with enrollment-scoped access (matches the `lessons` table migration 00004 pattern).

**Warning signs:** DevTools Network tab shows a request to `supabase.co/rest/v1/quiz_definitions` with `correct_answer` visible in the response body.

### Pitfall 2: `as never` Cast Required for `quiz_attempts` Insert

**What goes wrong:** Supabase v2.105.x / PostgREST 14.5 infers `never` for complex insert types, causing TypeScript errors on `.insert(...)` calls.

**Why it happens:** Established schema inference bug documented in STATE.md decisions.

**How to avoid:** Use the established pattern: `supabase.from('quiz_attempts').insert(insertData as never)`. Document in the plan step comments referencing STATE.md.

**Warning signs:** TypeScript error `Argument of type '...' is not assignable to parameter of type 'never'` on `.insert()` or `.upsert()` call.

### Pitfall 3: `quizState` Initialized Wrong When Lesson Is Already Complete

**What goes wrong:** If `isLessonComplete = true` on page load and the component initializes to `ACTIVE`, the user sees the quiz immediately without clicking "Take Quiz." The spec says the state machine starts at LOCKED (or at minimum shows the "Take Quiz" button as an entry point even when unlocked).

**Why it happens:** Confusing "quiz is accessible" with "quiz is already started."

**How to avoid:** Initialize `quizState` to `'LOCKED'` always, then render the "Take Quiz" button as active (not disabled) when `isLessonComplete = true`. The LOCKED state UI shows either a disabled or active "Take Quiz" button based on `isLessonComplete`.

**Warning signs:** Quiz questions appear immediately on page load without the user clicking anything.

### Pitfall 4: Missing `cohort_id` on `quiz_attempts` Insert

**What goes wrong:** The `quiz_attempts` table has a nullable `cohort_id` column. Phase 6 (AI Tutor) and dashboard widgets may query quiz attempts joined to cohorts. Leaving it null means those joins silently exclude the row.

**Why it happens:** The Route Handler receives `lessonId` but not `cohortId` — the cohort must be looked up via enrollment.

**How to avoid:** In the Route Handler, after verifying enrollment, do a join to find the user's active `cohort_id` for this lesson's course:

```sql
-- Logical equivalent (via Supabase JS client):
SELECT e.cohort_id
FROM enrollments e
JOIN cohorts co ON co.id = e.cohort_id
JOIN modules m ON m.course_id = co.course_id
JOIN lessons l ON l.module_id = m.id
WHERE e.user_id = $userId AND l.id = $lessonId AND e.status = 'active'
LIMIT 1
```

If no cohort found (edge case: lesson not part of enrolled course), insert with `cohort_id: null` — still valid per schema constraint `cohort_id uuid references public.cohorts(id) on delete set null`.

**Warning signs:** Dashboard cohort progress shows 0% even after quiz attempts, because the attempt has `cohort_id = null`.

### Pitfall 5: shadcn `radio-group` Add Command Installs New Radix Deps

**What goes wrong:** `npx shadcn add radio-group` downloads `@radix-ui/react-radio-group`. If `node_modules` is not present (fresh clone), the install step must happen before the dev server starts.

**Why it happens:** shadcn components are copied into `components/ui/` but their Radix dependencies are npm packages.

**How to avoid:** Make the `npx shadcn add radio-group && npx shadcn add progress` step the first task in the wave. Verify both `@radix-ui/react-radio-group` and `@radix-ui/react-progress` appear in `package.json` after the command.

**Warning signs:** `Module not found: Can't resolve '@radix-ui/react-radio-group'` at build time.

---

## Schema Analysis

### `quiz_definitions` — Current State [VERIFIED: migrations + seed.sql]

```
id          uuid PK
lesson_id   uuid UNIQUE FK → lessons.id
questions   jsonb   -- array of { id, question, options, correct_answer, explanation }
created_at  timestamptz
```

**RLS current:** `auth.role() = 'authenticated'` — permissive. Any authenticated user can SELECT full row including `correct_answer`.

**RLS needed:** Enrollment-scoped, matching the `lessons` table policy from migration 00004.

**Seed data:** 3 questions for lesson `00000000-0000-0000-0000-000000000030` ("What is Generative AI?") only. Lessons 2 and 3 have no quiz definition — the quiz section should not render if `quiz_definitions` row is absent for that lesson. [VERIFIED: seed.sql]

### `quiz_attempts` — Current State [VERIFIED: migration 00002]

```
id           uuid PK
user_id      uuid FK → auth.users
lesson_id    uuid FK → lessons
cohort_id    uuid nullable FK → cohorts (on delete set null)
answers      jsonb   -- stored as Record<questionId, selectedAnswer>
score        integer
max_score    integer
submitted_at timestamptz
```

**RLS current:** SELECT + INSERT policies scoped to `auth.uid() = user_id`. No UPDATE policy (attempts are immutable after insert — correct). [VERIFIED: migration 00002]

**Gap:** No `onConflict` is needed — multiple attempts per `(user_id, lesson_id)` are allowed (spec says "Retake Quiz" writes a new row). No unique constraint on `(user_id, lesson_id)`.

### Migration Needed: Migration 00008

A new migration to tighten `quiz_definitions` SELECT policy:

```sql
-- 20260428000008_quiz_rls.sql
drop policy if exists "Authenticated users can view quiz definitions"
  on public.quiz_definitions;

create policy "Enrolled users can view quiz definitions"
  on public.quiz_definitions
  for select
  using (
    exists (
      select 1
      from public.lessons l
      join public.enrollments e on e.cohort_id in (
        select c.id from public.cohorts c
        join public.modules m on m.course_id = c.course_id
        where m.id = l.module_id
      )
      where l.id = quiz_definitions.lesson_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
```

**Note:** This migration is security-hardening. Even without it, the demo works because questions are always fetched server-side in our implementation. The migration prevents a future developer from accidentally calling `createClient()` (browser) on `quiz_definitions` and leaking answer keys.

---

## Code Examples

### Verified Pattern: Server Component parallel fetch (lesson + progress + quiz)

```typescript
// Source: mirrors app/dashboard/lesson/[lessonId]/page.tsx parallel fetch pattern
const [lessonResult, progressResult, quizResult] = await Promise.all([
  supabase
    .from('lessons')
    .select('id, title, module_id, mux_playback_id, duration_seconds, transcript')
    .eq('id', lessonId)
    .single(),
  supabase
    .from('lesson_progress')
    .select('last_position, completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle(),
  supabase
    .from('quiz_definitions')
    .select('questions')
    .eq('lesson_id', lessonId)
    .maybeSingle(),
])
```

### Verified Pattern: `as unknown as T | null` cast

```typescript
// Source: established in enrollment.actions.ts + video/progress/route.ts
type ProgressRow = { completed: boolean }
const progress = progressResult.data as unknown as ProgressRow | null
const isLessonComplete = progress?.completed ?? false
```

### Verified Pattern: Route Handler auth check

```typescript
// Source: app/api/video/progress/route.ts — verbatim pattern
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Verified Pattern: `insert as never` for PostgREST 14.5

```typescript
// Source: STATE.md decision + enrollment.actions.ts + video/progress/route.ts
const { error } = await supabase
  .from('quiz_attempts')
  .insert(insertData as never)
```

### Verified Pattern: `useActionState` for Client Component (EnrollButton pattern)

```typescript
// Source: components/EnrollButton.tsx — but NOT used for quiz
// Quiz uses fetch() not Server Action because response shape matters
// This pattern is included for reference only — do NOT apply to quiz submit
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` with `createServerClient` | Supabase deprecated auth-helpers | CLAUDE.md explicitly forbids auth-helpers |
| `cookies()` synchronous (Next.js 14) | `await cookies()` (Next.js 15) | Next.js 15.0 | Forgetting `await` causes silent null session — critical gotcha in server.ts comment |
| Server Actions for all mutations | Route Handlers for JSON-response mutations | Phase 4 precedent | Server Actions suit redirect/revalidate patterns; Route Handlers suit fetch-based JSON flows |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is a code-only change. No new external services, CLIs, or runtimes beyond what is already installed and verified in Phases 1–4 (Node.js, npm, Supabase CLI, Next.js). The only new dependency is two Radix UI packages installed via `npx shadcn add`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `tests/` directory found |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

**Note:** `nyquist_validation: true` in config.json but no test infrastructure exists in the repo. Phase 5 Wave 0 must either install a test framework or document manual verification steps. Given project scope (demo), manual verification against success criteria is the practical path.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| QUIZ-01 | "Take Quiz" button disabled when `lesson_progress.completed = false` | manual | N/A | ❌ Wave 0 gap |
| QUIZ-01 | "Take Quiz" button enabled when `lesson_progress.completed = true` | manual | N/A | ❌ Wave 0 gap |
| QUIZ-02 | `/api/quiz/submit` response does NOT contain `correct_answer` in questions payload | manual (DevTools) | N/A | ❌ Wave 0 gap |
| QUIZ-02 | Unauthenticated POST to `/api/quiz/submit` returns 401 | manual (curl) | `curl -X POST http://localhost:3000/api/quiz/submit` | ❌ Wave 0 gap |
| QUIZ-02 | POST with unfinished lesson returns 403 | manual (curl) | N/A | ❌ Wave 0 gap |
| QUIZ-03 | Results render with correct score, breakdown, color coding | manual (browser) | N/A | ❌ Wave 0 gap |
| QUIZ-03 | `quiz_attempts` row written with correct `score`, `user_id`, `lesson_id` | manual (Supabase dashboard) | N/A | ❌ Wave 0 gap |

### Sampling Rate

- **Per task commit:** Manual smoke test — load lesson page, verify quiz section state matches expected
- **Per wave merge:** Full success-criteria walkthrough as specified in ROADMAP Phase 5
- **Phase gate:** All 5 success criteria verified before `/gsd-verify-work`

### Wave 0 Gaps

- No automated test framework exists; manual verification against ROADMAP success criteria is the defined testing approach for this demo-scope project
- Add `components/ui/radio-group.tsx` and `components/ui/progress.tsx` via `npx shadcn add` before any quiz component implementation

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` in Route Handler — established pattern |
| V3 Session Management | no — handled by Supabase SSR | `@supabase/ssr` manages session cookies |
| V4 Access Control | yes | lesson completion gate server-side; quiz_definitions enrollment scope |
| V5 Input Validation | yes | Validate `{ lessonId: string, answers: Record<string, string> }` shape in Route Handler |
| V6 Cryptography | no | No new crypto; Supabase handles auth tokens |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends fabricated `isComplete: true` to bypass quiz gate | Tampering | Server re-checks `lesson_progress.completed` from DB — never trusts client claim |
| Client sends manipulated `answers` (e.g., all correct guesses) | Tampering | Scoring is 100% server-side from DB-fetched `correct_answer`; client answers are stored as-is, scoring computed from server data |
| Answer key exposure via browser Supabase client | Information Disclosure | (1) Never fetch quiz_definitions from Client Component; (2) strip `correct_answer` before passing as props; (3) Migration 00008 tightens RLS |
| Unauthenticated quiz submission | Elevation of Privilege | `supabase.auth.getUser()` as first check in Route Handler; 401 on no session |
| Replay attack (submitting same answers repeatedly) | Repudiation | Allowed by design (retake = new `quiz_attempts` row); no unique constraint on `(user_id, lesson_id)` per spec |

---

## Open Questions (RESOLVED)

1. **Should quiz questions be shown for lessons 2 and 3?**
   - What we know: seed data only has a `quiz_definitions` row for lesson 1. Lessons 2 and 3 have no quiz.
   - What's unclear: Should the quiz section be hidden or shown as "Quiz coming soon" for lessons 2/3?
   - Recommendation: Per UI-SPEC "Empty state: hidden — quiz section only renders when `quiz_definitions` row exists for the lesson." No action needed; the server component simply won't pass `clientQuestions` and the `QuizSection` prop can be optional.

2. **Should `quiz_attempts.cohort_id` be populated?**
   - What we know: The column is nullable. The AI Tutor in Phase 6 may use it.
   - What's unclear: Whether Phase 6 actually needs it, or will query by `(user_id, lesson_id)` only.
   - Recommendation: Do the cohort lookup in the Route Handler (one extra join). The cost is one DB query; the benefit is Phase 6 and dashboard can filter by cohort. [ASSUMED]

3. **What happens on quiz retake — should the previous score appear in the results?**
   - What we know: Spec says "The score shown in RESULTS always reflects the most recent submission." Multiple `quiz_attempts` rows are allowed.
   - What's unclear: Whether the dashboard should show the best score or most recent.
   - Recommendation: Out of scope for Phase 5 — Phase 5 shows only the current session result. Dashboard display is deferred.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `quiz_attempts.cohort_id` should be populated by looking up the user's active enrollment for the lesson's course | Schema Analysis / Common Pitfalls | If Phase 6 only queries by `(user_id, lesson_id)`, the extra join is wasted work but not harmful |
| A2 | The quiz state machine starts at LOCKED even when `isLessonComplete = true` on page load (user must click "Take Quiz") | Architecture Patterns | If incorrect, initialize state to ACTIVE when lesson is complete — minor UX difference |
| A3 | Lesson 2 and 3 quiz sections should be hidden (not "coming soon") since they have no `quiz_definitions` row | Open Questions | If product wants a "coming soon" placeholder, a new copy string and conditional render are needed |

---

## Project Constraints (from CLAUDE.md)

| Directive | Type | Enforced In |
|-----------|------|-------------|
| Do NOT use `@supabase/auth-helpers-nextjs` | Forbidden | Route Handler must use `@/lib/supabase/server` |
| Do NOT use `next-auth` (Auth.js) | Forbidden | N/A for quiz |
| Do NOT call Anthropic SDK from client components | Forbidden | N/A for quiz |
| Do NOT use `video.js` or `plyr` | Forbidden | N/A for quiz |
| Do NOT use `react-query v4` or `swr` replacing Server Components | Forbidden | Quiz questions fetched via Server Component, not client query |
| Use `@supabase/ssr` + `createServerClient` | Required | Route Handler and Server Component use `@/lib/supabase/server` |
| Use shadcn/ui + Tailwind CSS v4 | Required | `QuizSection` uses shadcn `RadioGroup`, `Progress`, `Card`, `Button`, `Badge` |
| Use `createClient()` from `@/lib/supabase/server` in Route Handlers | Required | Route Handler follows `app/api/video/progress/route.ts` pattern |
| PostgREST 14.5: `as unknown as T` + `as never` cast workarounds | Required | All Supabase query results need cast; all insert payloads need `as never` |
| `await cookies()` required in Next.js 15 | Required | Already handled in `lib/supabase/server.ts` — do not reimplement |
| Dark-only theme (`forcedTheme="dark"`) | Required | No light-mode variants in `QuizSection` |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `app/api/video/progress/route.ts` — Route Handler pattern (auth check, body parse, DB write, JSON response)
- [VERIFIED: codebase] `lib/actions/enrollment.actions.ts` — Server Action pattern with `as unknown as T` and `as never` casts
- [VERIFIED: codebase] `app/dashboard/lesson/[lessonId]/page.tsx` — Server Component parallel fetch + `Promise.all` pattern
- [VERIFIED: codebase] `lib/database.types.ts` — full schema types for `quiz_definitions`, `quiz_attempts`, `lesson_progress`
- [VERIFIED: codebase] `supabase/migrations/20260428000002_create_remaining_tables.sql` — RLS policies on quiz tables
- [VERIFIED: codebase] `supabase/migrations/20260428000004_lesson_enrollment_rls.sql` — enrollment-scoped lesson RLS pattern
- [VERIFIED: codebase] `supabase/seed.sql` — quiz definition seed data structure (JSONB shape with `correct_answer`)
- [VERIFIED: codebase] `package.json` + `package-lock.json` — installed packages; `@radix-ui/react-radio-group` and `@radix-ui/react-progress` not present
- [VERIFIED: codebase] `.planning/phases/05-quiz-engine/05-UI-SPEC.md` — UI design contract (components, state machine, copy)
- [VERIFIED: codebase] `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`
- [VERIFIED: codebase] `.planning/STATE.md` — established decisions including `as never` cast, `as unknown as T`, Phase 4 complete

### Secondary (MEDIUM confidence)
- [ASSUMED] `quiz_attempts.cohort_id` lookup approach via enrollment join — no existing codebase precedent for this specific join path, derived from schema FK relationships

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against `package.json` and `package-lock.json`
- Architecture: HIGH — derived directly from existing Route Handler and Server Component patterns in codebase
- Schema: HIGH — verified against migrations and `database.types.ts`
- Pitfalls: HIGH — derived from STATE.md decisions and code comments in existing files
- RLS gaps: HIGH — verified by reading migration 00002 policy text

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable stack — Supabase + Next.js + shadcn)
