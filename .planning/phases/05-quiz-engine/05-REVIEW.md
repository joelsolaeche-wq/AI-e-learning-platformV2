---
phase: 05-quiz-engine
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/api/quiz/submit/route.ts
  - app/dashboard/lesson/[lessonId]/page.tsx
  - components/QuizSection.tsx
  - components/VideoPlayer.tsx
  - components/ui/button.tsx
  - components/ui/card.tsx
  - components/ui/label.tsx
  - components/ui/progress.tsx
  - components/ui/radio-group.tsx
  - supabase/migrations/20260428000008_quiz_rls.sql
  - supabase/seed.sql
findings:
  critical: 4
  warning: 6
  info: 2
  total: 12
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the full quiz engine implementation: the submit API route, lesson page Server Component, `QuizSection` and `VideoPlayer` client components, four shadcn/base-ui primitives, the quiz RLS tightening migration, and the demo seed file.

The server-side scoring architecture is sound — the answer key is correctly stripped before client delivery, scoring is performed server-side, and the lesson-completion gate is enforced in the API handler. The most serious findings are: (1) the lessons RLS policy from migration 00004 does not filter by `enrollment.status`, meaning dropped/completed users retain lesson read access and can bypass the API-layer enrollment gate; (2) the enrollment lookup in the submit route uses an unsupported PostgREST deep-join filter syntax that silently never matches, so `cohort_id` is recorded incorrectly on every quiz attempt; (3) `VideoPlayer` has a double-completion race that fires two progress saves and two `router.refresh()` calls simultaneously; (4) the seed file inserts `auth.users` rows with empty `encrypted_password` strings, which violates Supabase gotrue invariants and can break `db reset` on CI.

---

## Critical Issues

### CR-01: Lessons RLS missing enrollment-status filter — dropped users bypass access gate

**File:** `supabase/migrations/20260428000004_lesson_enrollment_rls.sql:28-40`

**Issue:** The `enrolled users can view lessons` policy has no `e.status = 'active'` predicate:

```sql
exists (
  select 1
  from public.enrollments e
  join public.cohorts c on c.id = e.cohort_id
  join public.modules m on m.course_id = c.course_id
  where e.user_id = auth.uid()
    and m.id = lessons.module_id
  -- status = 'active' is absent
)
```

A user whose enrollment status is `'dropped'` or `'completed'` passes this check because there is no status filter. Since the submit route's enrollment authorization check (line 49-61 of `route.ts`) piggybacks on this RLS policy by querying `lessons.eq('id', lessonId)`, a dropped user can also pass the quiz submit authorization gate, submit quiz attempts, and receive scored results — a full authorization bypass for all users whose enrollment has been revoked.

**Fix:** Add a corrective migration that drops and recreates the policy:

```sql
drop policy if exists "enrolled users can view lessons" on public.lessons;

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
        and e.status = 'active'   -- required
    )
  );
```

---

### CR-02: PostgREST deep-join filter is silently ignored — cohort_id is always recorded incorrectly

**File:** `app/api/quiz/submit/route.ts:136-148`

**Issue:** The enrollment lookup uses:

```ts
.select('cohort_id, cohorts!inner(course_id, modules!inner(lessons!inner(id)))')
.eq('cohorts.modules.lessons.id', lessonId)
```

PostgREST does not support dot-path filters on nested embedded relations in the `select()` + `eq()` form. The `.eq('cohorts.modules.lessons.id', lessonId)` filter is silently discarded. The query returns the first active enrollment for the user regardless of whether that enrollment's course contains the lesson. With a single active enrollment the value is accidentally correct; with multiple enrollments it records the wrong cohort. This corrupts Phase 6 cohort-progress aggregation for any multi-enrolled user.

**Fix:** Replace with a two-step sequential lookup that PostgREST can actually execute:

```ts
// Step 1: resolve the course containing this lesson
type LessonModuleRow = { modules: { course_id: string } }
const { data: lessonModule } = await supabase
  .from('lessons')
  .select('modules!inner(course_id)')
  .eq('id', lessonId)
  .maybeSingle()
const courseId = (lessonModule as unknown as LessonModuleRow | null)?.modules?.course_id ?? null

// Step 2: find the active enrollment for that specific course
type EnrollmentRow = { cohort_id: string }
const { data: rawEnrollment, error: enrollError } = courseId
  ? await supabase
      .from('enrollments')
      .select('cohort_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('cohort_id',
        supabase.from('cohorts').select('id').eq('course_id', courseId)
      )
      .maybeSingle()
  : { data: null, error: null }

if (enrollError) {
  console.error('[quiz submit] enrollment cohort lookup error', enrollError)
}
const cohortId = (rawEnrollment as unknown as EnrollmentRow | null)?.cohort_id ?? null
```

---

### CR-03: VideoPlayer double-completion race — two simultaneous progress saves and router.refresh() calls

**File:** `components/VideoPlayer.tsx:37-51`

**Issue:** When a user watches past 90% of a video, `handleTimeUpdate` fires first: it sets `completedRef.current = true`, calls `saveProgress(pos, true)`, and chains `router.refresh()`. Immediately after, when the video ends, `handleEnded` fires unconditionally and calls `saveProgress(duration, true)` and `router.refresh()` again. Both handlers are independent — `handleEnded` has no guard. The result is two concurrent `POST /api/video/progress` requests and two queued `router.refresh()` calls, causing a double Server Component re-render and two upsert writes.

More critically, `completedRef.current = true` is set synchronously before `saveProgress` resolves. If the `saveProgress` fetch fails (the catch in `saveProgress` swallows all errors silently), completion is permanently lost with no indication to the user and no retry path.

**Fix:** Guard `handleEnded` with the same ref, and surface `saveProgress` failures:

```ts
const handleEnded = useCallback(() => {
  if (completedRef.current) return  // already handled by handleTimeUpdate
  completedRef.current = true
  saveProgress(duration, true).then(() => router.refresh())
}, [duration, saveProgress, router])
```

For resilience, set `completedRef` only after the save succeeds in `handleTimeUpdate`:

```ts
if (pct >= 0.9 && !completedRef.current) {
  completedRef.current = true
  saveProgress(pos, true).then(() => router.refresh())
  return
}
```

This is already the current code, so the main fix is adding the early-return guard in `handleEnded`.

---

### CR-04: Seed file inserts auth.users rows with empty encrypted_password — violates gotrue invariants

**File:** `supabase/seed.sql:291-299`

**Issue:** The two teammate stub rows are inserted with `encrypted_password: ''`. Supabase's gotrue service requires a non-empty bcrypt hash for email-provider accounts. An empty string is stored successfully in Postgres but causes gotrue to reject any sign-in or password-reset attempt for those users, and under certain Supabase versions triggers schema validation errors on service restart or `db reset`. On Supabase Cloud, direct inserts into `auth.users` without a valid `confirmation_token` can leave the row in a state that causes gotrue to log errors on every auth event.

These rows exist only as FK anchors for `public.profiles` and `public.enrollments`. A malformed auth row can cause `npx supabase db reset` to fail or produce warnings in CI.

**Fix:** Use a valid bcrypt hash placeholder for demo accounts:

```sql
encrypted_password = crypt('ChangeMe123!', gen_salt('bf'))
```

Or, to avoid inserting into the managed `auth` schema entirely, use a deferred FK with `set session_replication_role = replica` in the seed and insert only into `public.profiles` and `public.enrollments`.

---

## Warnings

### WR-01: answers array-type bypass — Array.isArray check missing

**File:** `app/api/quiz/submit/route.ts:39-44`

**Issue:** The validation at line 39 checks `typeof answers !== 'object'`. In JavaScript `typeof [] === 'object'` and `Array.isArray([]) === true`, so `answers: ["a","b"]` passes the guard. The downstream `answers[q.id]` accessor returns `undefined` for every UUID key on an array — all questions score as incorrect. The array value is then persisted as-is into the `jsonb` `answers` column, storing an array where an object map is expected. This corrupts audit/replay logic.

**Fix:**

```ts
if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
  return NextResponse.json(
    { error: 'Missing required fields: lessonId and answers are required' },
    { status: 400 }
  )
}
```

This fix is straightforward and was identified in the previous review pass. The current code does NOT include this fix — it was listed as CR-04 in the prior review but is absent from the submitted `route.ts`.

---

### WR-02: quiz/submit route — lessonId not validated as UUID before DB queries

**File:** `app/api/quiz/submit/route.ts:25-34`

**Issue:** The current file (lines 31-34) does include a UUID regex validation — however the previous review pass (CR-02) flagged its absence and it was added. Confirming this is present and correct. No action needed for this specific item.

**Note:** The UUID validation is present at lines 31-34. This warning is downgraded to confirmed-fixed.

---

### WR-03: LessonPage — chat history messages query error is silently discarded

**File:** `app/dashboard/lesson/[lessonId]/page.tsx:100-107`

**Issue:** The IIFE fetching `ai_chat_messages` discards the query error:

```ts
const { data: messagesData } = await supabase
  .from('ai_chat_messages')
  ...
```

If this query fails (RLS violation, network error), `messagesData` is `null`, the IIFE returns `[]`, and the chat panel renders as empty. The user's chat history silently disappears with no indication of failure. This is a data-loss-from-user-perspective issue.

**Fix:**

```ts
const { data: messagesData, error: msgsError } = await supabase
  .from('ai_chat_messages')
  .select('id, role, content, created_at')
  .eq('session_id', (sessionData as unknown as { id: string }).id)
  .order('created_at', { ascending: true })
  .limit(20)

if (msgsError) {
  console.error('[lesson page] ai_chat_messages fetch error', msgsError)
}
return (messagesData ?? []) as unknown as ChatMessageRow[]
```

---

### WR-04: QuizSection submit error — all HTTP error codes produce the same user message

**File:** `components/QuizSection.tsx:80-87`

**Issue:** The error handler checks only `res.ok`, then throws a generic error:

```ts
if (!res.ok) throw new Error('submit failed')
```

A 403 "Lesson not completed" and a 500 "Failed to save attempt" both produce `"Couldn't submit quiz — try again"`. A user who legitimately has not completed the lesson retries indefinitely with no actionable guidance. The `catch` block also silently discards the error message, replacing it with the hardcoded string.

**Fix:**

```ts
if (!res.ok) {
  const body = await res.json().catch(() => ({}))
  const msg =
    res.status === 403
      ? (body.error ?? 'Complete the lesson before submitting the quiz.')
      : res.status === 404
      ? 'Quiz not found.'
      : "Couldn't submit quiz — try again."
  throw new Error(msg)
}
// ...
} catch (err) {
  setSubmitError(err instanceof Error ? err.message : "Couldn't submit quiz — try again")
  setQuizState('ACTIVE')
}
```

---

### WR-05: quiz/submit — zero-question quiz persists a meaningless attempt record

**File:** `app/api/quiz/submit/route.ts:114-127`

**Issue:** If `def.questions` is an empty array (a quiz_definition with `questions: []` is valid per the DB schema), `total` is `0`, `pct` is `0`, and an attempt row is inserted with `score=0, max_score=0`. The client receives `{ score: 0, total: 0, pct: 0 }` and renders "0 / 0 — 0%". There is no guard for this case, yet there is already a 404 guard when `def` is null.

**Fix:**

```ts
if (!questions || questions.length === 0) {
  return NextResponse.json({ error: 'Quiz has no questions' }, { status: 422 })
}
```
Add this after the `def` null check at line 102.

---

### WR-06: video/progress route — lessonId not validated as UUID; PostgREST error returns 403 instead of 400

**File:** `app/api/video/progress/route.ts:32-44`

**Issue:** The progress route validates that `lessonId` is truthy and that `position >= 0`, but does not validate UUID format. A client sending a malformed `lessonId` causes PostgREST to return a query error, which makes `lessonError` truthy, and the route returns 403 Forbidden. The correct HTTP status for a malformed input is 400 Bad Request. This is an inconsistency with the quiz submit route (which does validate UUID format) and gives the caller a misleading error code.

**Fix:**

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!lessonId || !UUID_RE.test(lessonId)) {
  return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
}
```
Add after the existing `lessonId` presence check at line 32.

---

## Info

### IN-01: QuizSection — RESULTS fallthrough to null is silent (unreachable but undefended)

**File:** `components/QuizSection.tsx:203`

**Issue:** The RESULTS state branch is guarded by `quizState === 'RESULTS' && results`. If `results` is null while `quizState` is `'RESULTS'` (theoretically unreachable in the current state machine), the component falls to `return null` at line 292, rendering nothing. The comment "should not be reachable" is correct for the current implementation. A future refactor that adds an async retake path or resets `results` independently could inadvertently introduce a blank render.

**Fix:** Replace the final `return null` with a minimal fallback:

```tsx
// Fallback (should not be reachable; guards against future state desync)
return (
  <section className="space-y-4">
    <h2 className="text-lg font-semibold">Post-Lesson Quiz</h2>
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Something went wrong. Please refresh the page.
      </CardContent>
    </Card>
  </section>
)
```

---

### IN-02: quiz/submit — as never cast on insert bypasses schema type-safety

**File:** `app/api/quiz/submit/route.ts:163`

**Issue:** `supabase.from('quiz_attempts').insert(insertData as never)` uses `as never` to suppress a PostgREST 14.5 schema inference error. This is the most unsafe TypeScript cast — it converts the value to the bottom type and silences all downstream type errors, including future schema changes (column additions, renames, removed nullable constraints) that would otherwise be caught at compile time. The project notes this as a known workaround in STATE.md.

**Fix:** When the Supabase SDK is upgraded past the schema inference bug, replace with a typed insert:

```ts
import type { TablesInsert } from '@/lib/database.types'
const insertData: TablesInsert<'quiz_attempts'> = {
  user_id: user.id,
  lesson_id: lessonId,
  cohort_id: cohortId,
  answers: answers as Record<string, string>,
  score,
  max_score: total,
}
const { error: insertError } = await supabase.from('quiz_attempts').insert(insertData)
```

Track the Supabase SDK changelog for the fix.

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
