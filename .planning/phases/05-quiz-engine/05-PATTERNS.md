# Phase 5: Quiz Engine — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260428000008_quiz_rls.sql` | migration | CRUD | `supabase/migrations/20260428000004_lesson_enrollment_rls.sql` | exact |
| `app/api/quiz/submit/route.ts` | route handler | request-response | `app/api/video/progress/route.ts` | exact |
| `app/dashboard/lesson/[lessonId]/page.tsx` (modify) | server component | request-response | `app/dashboard/lesson/[lessonId]/page.tsx` itself | self (extend) |
| `components/QuizSection.tsx` | component (client) | event-driven | `components/EnrollButton.tsx` | role-match |
| `components/ui/radio-group.tsx` + `components/ui/progress.tsx` | ui primitives | — | `components/ui/card.tsx`, `components/ui/badge.tsx` | role-match |

---

## Pattern Assignments

### `supabase/migrations/20260428000008_quiz_rls.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260428000004_lesson_enrollment_rls.sql`

**File header + drop-then-create pattern** (lines 1-41 of analog):
```sql
-- ============================================================
-- Migration: 20260428000004_lesson_enrollment_rls
-- Phase 3: ...
-- Replaces the permissive lessons SELECT policy ...
-- ============================================================

-- Step 1: Drop the old permissive policy
-- The policy name must match exactly as created in migration 00002.
drop policy if exists "Authenticated users can view lessons of published courses"
  on public.lessons;

-- Step 2: Create enrollment-scoped SELECT policy
create policy "enrolled users can view lessons"
  on public.lessons
  for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      join public.modules m on m.course_id = c.course_id
      where e.user_id = auth.uid()
        and m.id = lessons.module_id
    )
  );
```

**Permissive policy being replaced** — found in `supabase/migrations/20260428000002_create_remaining_tables.sql` lines 235-238:
```sql
create policy "Authenticated users can view quiz definitions"
  on public.quiz_definitions
  for select
  using (auth.role() = 'authenticated');
```

**Migration to write for Phase 5** — drop-then-create replacing the permissive policy with enrollment-scoped access using the same join path as migration 00004 but traversing `quiz_definitions.lesson_id → lessons.module_id → modules.course_id → cohorts → enrollments`:
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

---

### `app/api/quiz/submit/route.ts` (route handler, request-response)

**Analog:** `app/api/video/progress/route.ts`

**Imports pattern** (lines 1-3 of analog):
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { TablesInsert } from '@/lib/database.types'
```

**Auth check pattern** (lines 5-15 of analog):
```typescript
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

**Body parse + field validation pattern** (lines 17-37 of analog):
```typescript
  let body: {
    lessonId?: string
    position?: number
    duration?: number
    completed?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lessonId, position, duration, completed } = body

  if (!lessonId || position === undefined || position === null) {
    return NextResponse.json(
      { error: 'Missing required fields: lessonId and position are required' },
      { status: 400 }
    )
  }
```

**`as unknown as T | null` cast pattern for DB rows** (lines 54-64 of analog):
```typescript
  type LessonRow = { id: string; duration_seconds: number | null }
  const { data: rawLesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, duration_seconds')
    .eq('id', lessonId)
    .maybeSingle()
  const lesson = rawLesson as unknown as LessonRow | null

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

**`as never` cast for insert + error handling pattern** (lines 76-97 of analog):
```typescript
  const { error: upsertError } = await supabase
    .from('lesson_progress')
    .upsert(upsertData as never, { onConflict: 'user_id,lesson_id' })

  if (upsertError) {
    console.error('[progress API] lesson_progress upsert error', upsertError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, completed: isCompleted })
```

**How to adapt for quiz submit:** Replace the upsert with `.insert(insertData as never)` on `quiz_attempts`. The quiz handler adds two steps not in the video progress handler: (1) a server-side `lesson_progress.completed` gate (403 if false), and (2) server-side scoring by fetching full `quiz_definitions` row with `correct_answer`. The `as unknown as T | null` and `as never` cast patterns apply identically to both extra queries.

---

### `app/dashboard/lesson/[lessonId]/page.tsx` (server component — modify/extend)

**Analog:** self — this file is being extended

**Current imports block** (lines 1-4):
```typescript
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import { VideoPlayer } from '@/components/VideoPlayer'
```

**Additions needed:** Import `QuizSection` client component. Add a `QuizQuestion` / `ClientQuestion` type alias.

**`Promise.all` parallel fetch pattern** (lines 42-54):
```typescript
  const [lessonResult, progressResult] = await Promise.all([
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
  ])
```

**Extend to three-way parallel fetch** — add a third fetch for `quiz_definitions` inside the same `Promise.all`. The existing two fetches stay unchanged; append:
```typescript
    supabase
      .from('quiz_definitions')
      .select('questions')
      .eq('lesson_id', lessonId)
      .maybeSingle(),
```

**`as unknown as T | null` cast pattern for progress** (lines 62-63):
```typescript
  const progress = progressResult.data as unknown as ProgressRow | null
```

**Apply the same cast for quiz definition:**
```typescript
  type RawQuizDef = { questions: unknown }
  const quizDef = quizResult.data as unknown as RawQuizDef | null
```

**Answer-key strip before prop pass** (derived pattern, not yet in file):
```typescript
  type QuizQuestion = {
    id: string
    question: string
    options: string[]
    correct_answer: string   // server only — never passed to client
    explanation?: string
  }
  type ClientQuestion = { id: string; question: string; options: string[] }

  const rawQuestions = (quizDef?.questions ?? []) as QuizQuestion[]
  const clientQuestions: ClientQuestion[] = rawQuestions.map(({ id, question, options }) => ({
    id,
    question,
    options,
  }))
```

**JSX layout pattern** (lines 67-97 of current file) — the `<main>` container class to maintain:
```typescript
  return (
    <main className="mx-auto w-full max-w-[896px] px-8 pt-8 pb-16 space-y-6">
```

**Conditional quiz section addition** — append after the transcript block, inside the same `<main>`:
```tsx
      {clientQuestions.length > 0 && (
        <>
          <Separator />
          <QuizSection
            isLessonComplete={isLessonComplete}
            clientQuestions={clientQuestions}
            lessonId={lesson.id}
          />
        </>
      )}
```

---

### `components/QuizSection.tsx` (client component, event-driven)

**Analog:** `components/EnrollButton.tsx`

**`'use client'` directive + named export pattern** (lines 1, 18 of analog):
```typescript
'use client'

// ...imports...

export function EnrollButton({ cohortId }: EnrollButtonProps) {
```

**Inline error display pattern** (lines 35-37 of analog):
```typescript
      {state.error && (
        <p className="text-xs text-destructive mb-1">{state.error}</p>
      )}
```

**Badge for state-based rendering** (lines 24-28 of analog):
```typescript
  if (state.enrolled) {
    return (
      <Badge variant="secondary" className="cursor-default">
        Enrolled
      </Badge>
    )
  }
```

**`fetch` POST pattern** — from `components/VideoPlayer.tsx` lines 18-26, which calls the video progress Route Handler identically to how QuizSection will call `/api/quiz/submit`:
```typescript
      await fetch('/api/video/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, position, duration, completed }),
      })
```

**How to adapt for QuizSection:** Replace `useActionState` with `useState` for the four-state machine (`LOCKED | ACTIVE | SUBMITTED | RESULTS`). Replace form-action submit with a `fetch('/api/quiz/submit', ...)` call in an async handler, matching the VideoPlayer `saveProgress` fetch pattern. Inline error state uses the same `text-xs text-destructive` pattern from EnrollButton.

**QuizSection interface shape** (adapt from EnrollButton `EnrollButtonProps`):
```typescript
interface QuizSectionProps {
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  lessonId: string
}
```

**shadcn component imports** — follow the pattern established in `components/EnrollButton.tsx` lines 4-5:
```typescript
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
```

Add for QuizSection:
```typescript
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
```

---

### `components/ui/radio-group.tsx` + `components/ui/progress.tsx` (ui primitives)

**Analog:** `components/ui/card.tsx` and `components/ui/badge.tsx`

These files are generated by `npx shadcn add radio-group` and `npx shadcn add progress` — do not hand-write them.

**shadcn component file structure pattern** (from `components/ui/card.tsx` lines 1-3):
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"
```

**`cn()` utility usage pattern** (from `components/ui/card.tsx` line 15):
```typescript
className={cn("...base-classes...", className)}
```

**`cva` variant pattern** (from `components/ui/button.tsx` lines 7-34) — radio-group and progress do not use `cva`; they use simple `cn()` composition. Badge and Button show the variant pattern if needed for future extension.

**Named export pattern** (from `components/ui/card.tsx` lines 95-103):
```typescript
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
```

---

## Shared Patterns

### Auth Check
**Source:** `app/api/video/progress/route.ts` lines 8-15
**Apply to:** `app/api/quiz/submit/route.ts` (first operation inside `POST`)
```typescript
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

### Supabase Server Client Initialization
**Source:** `lib/supabase/server.ts` lines 15-16
**Apply to:** `app/api/quiz/submit/route.ts`, `app/dashboard/lesson/[lessonId]/page.tsx`
```typescript
export async function createClient() {
  const cookieStore = await cookies()   // await is required in Next.js 15
```

Import in all server files:
```typescript
import { createClient } from '@/lib/supabase/server'
```

### PostgREST 14.5 `as unknown as T | null` Cast
**Source:** `app/api/video/progress/route.ts` lines 54-60 and `app/dashboard/lesson/[lessonId]/page.tsx` lines 10-16
**Apply to:** Every Supabase query result in `app/api/quiz/submit/route.ts` and the extended `page.tsx`
```typescript
type SomeRow = { field: string }
const { data: rawResult, error } = await supabase
  .from('some_table')
  .select('field')
  .eq('id', someId)
  .maybeSingle()
const result = rawResult as unknown as SomeRow | null
```

### PostgREST 14.5 `as never` Cast for Inserts
**Source:** `lib/actions/enrollment.actions.ts` line 90, `app/api/video/progress/route.ts` line 90
**Apply to:** `quiz_attempts` insert in `app/api/quiz/submit/route.ts`
```typescript
const { error } = await supabase
  .from('quiz_attempts')
  .insert(insertData as never)
```

### Error Response Formatting
**Source:** `app/api/video/progress/route.ts` lines 26-37
**Apply to:** `app/api/quiz/submit/route.ts`
```typescript
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  // ...
  if (insertError) {
    console.error('[quiz submit] error', insertError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
```

### Inline Client-Side Error Display
**Source:** `components/EnrollButton.tsx` lines 35-37
**Apply to:** Error state in `components/QuizSection.tsx` (both submission error and unanswered questions hint)
```typescript
{error && (
  <p className="text-xs text-destructive mb-1">{error}</p>
)}
```

For the "answer all questions" hint, same pattern but `text-muted-foreground`:
```typescript
{!allAnswered && (
  <p className="text-xs text-muted-foreground mt-1">Answer all questions to submit</p>
)}
```

### Dark Theme — No Light Mode
**Source:** `app/layout.tsx` (`forcedTheme="dark"`)
**Apply to:** `components/QuizSection.tsx` — use only dark-safe Tailwind tokens (`bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`). Use `green-400`/`green-950` for correct-answer semantic only (approved deviation per UI-SPEC).

---

## No Analog Found

All files have a close codebase analog. No entries.

---

## Critical Implementation Notes

### Answer Key Must Never Reach Client
The `quiz_definitions.questions` JSONB contains `correct_answer` inline. The Server Component must map to `ClientQuestion` (omitting `correct_answer` and `explanation`) before passing as props. The analog for this prop-stripping approach is the `ProgressRow` type alias in `page.tsx` — define a `ClientQuestion` type and use `.map(({ id, question, options }) => ({ id, question, options }))`.

### `as never` Is Specifically Required for `quiz_attempts` Insert
`quiz_attempts.answers` is typed as `Json` in `database.types.ts` — PostgREST 14.5 infers `never` for this column in insert payloads. Use `as never` on the entire insert object. Source: `enrollment.actions.ts` line 90 (`enrollmentRow as never`).

### `quiz_definitions` SELECT Policy Name Must Match Exactly
The migration drop statement uses `"Authenticated users can view quiz definitions"` — this string comes from migration 00002 line 235. Typos cause the drop to silently no-op, leaving the permissive policy active.

### `quizState` Initialization Rule
Always initialize to `'LOCKED'`. When `isLessonComplete = true`, the "Take Quiz" button renders enabled (not `disabled`), but questions are not shown until the user clicks it. This avoids the pitfall of quiz questions appearing automatically on page load.

---

## Metadata

**Analog search scope:** `app/api/`, `app/dashboard/`, `components/`, `lib/actions/`, `supabase/migrations/`
**Files scanned:** 11
**Pattern extraction date:** 2026-04-28
