---
phase: 05-quiz-engine
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - components/ui/radio-group.tsx
  - components/ui/progress.tsx
  - supabase/migrations/20260428000008_quiz_rls.sql
  - app/api/quiz/submit/route.ts
  - components/QuizSection.tsx
  - app/dashboard/lesson/[lessonId]/page.tsx
findings:
  critical: 4
  warning: 4
  info: 2
  total: 10
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files were reviewed covering the full quiz engine stack: two UI primitives, one RLS migration, one API route handler, and two React components (client and server). The implementation is structurally sound and correctly applies the key security principle of server-side scoring. However, four blockers were found. The most serious is an authorization gap in the submit route: the server fetches `quiz_definitions` using the anon-key Supabase client that operates under the updated RLS policy from migration 00008, but that policy only gates _read_ access — it does not verify that the user is actually enrolled in the course the submitted `lessonId` belongs to. An unauthenticated-but-session-holding user with a lessonId from any course can submit a quiz attempt and receive a scored result backed by the server's DB fetch. A second blocker is that `lessonId` received from the client is used raw in DB queries without UUID format validation, enabling potential injection of crafted strings. Two additional blockers relate to silent data integrity failures in the submit route. Four warnings cover UI logic bugs and a missing RLS INSERT policy.

---

## Critical Issues

### CR-01: No enrollment authorization check in submit route — any enrolled user can submit for any lesson

**File:** `app/api/quiz/submit/route.ts:39-48`

**Issue:** The lesson-completion gate only verifies that `lesson_progress.completed = true` for the submitted `lessonId`. It does not verify that the authenticated user is enrolled in a cohort whose course contains that lesson. An attacker with a valid session but enrolled in Course A can submit `lessonId` values for Course B (or any lesson they have obtained the UUID for via network inspection or another user). The `lesson_progress` check is bypassable: if an admin or seed script has inserted a completed row for a user/lesson pair they are not enrolled in, the gate passes. The RLS policy on `quiz_definitions` (migration 00008) gates SELECT but does not produce a useful 403 at the application layer — it silently returns null, which would return a 404. For correctness the route must explicitly verify enrollment before scoring.

**Fix:**
```typescript
// After auth check, before lesson_progress check, add:
const { data: enrollmentCheck } = await supabase
  .from('lessons')
  .select('id')
  .eq('id', lessonId)
  .maybeSingle()

// RLS on lessons (migration 00004) gates this to enrolled users only.
// If RLS blocks it, data will be null — treat as unauthorized.
if (!enrollmentCheck) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```
This piggybacks on the already-correct enrollment-scoped lessons RLS from migration 00004, adding a single cheap query without duplicating join logic.

---

### CR-02: `lessonId` is not validated as a UUID before use in DB queries

**File:** `app/api/quiz/submit/route.ts:27-32`

**Issue:** `lessonId` is accepted from the client request body and used directly in four `.eq('lesson_id', lessonId)` and `.eq('id', lessonId)` PostgREST calls. PostgREST passes the value as a parameter to the underlying Postgres query, so classic SQL injection is not the vector here. The real risk is that PostgREST will return an HTTP 400 or 500 error from Supabase when a malformed string is passed as a UUID column predicate, and those errors are silently swallowed by the `maybeSingle()` + `as unknown as` pattern — the code treats a Supabase error the same as "row not found". For `quiz_definitions` this means a crafted non-UUID `lessonId` causes `def` to be null and returns a clean 404, masking the underlying error. More seriously: the error from the `lesson_progress` check is also discarded, which means the completion gate silently passes when PostgREST errors, allowing the route to reach the scoring block with `undefined` progress.

**Fix:**
```typescript
// Add at line 26, after destructuring lessonId and answers:
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(lessonId)) {
  return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
}
```

---

### CR-03: Supabase errors are silently discarded in the lesson-completion gate — gate can be bypassed

**File:** `app/api/quiz/submit/route.ts:39-49`

**Issue:** The `lesson_progress` query destructures only `data`, discarding `error`:
```typescript
const { data: rawProgress } = await supabase
  .from('lesson_progress')
  ...
  .maybeSingle()
```
If this query fails (network error, Supabase outage, invalid UUID as described in CR-02, RLS misconfiguration), `rawProgress` is `null` and `progress?.completed` evaluates to `undefined`, which is falsy — the route correctly returns 403. However if the **quiz_definitions** query at line 54 fails for the same reasons, `def` is null and the route returns 404, stopping processing before the score is computed. The dangerous case is the **enrollment query** at line 91-96: its error is also silently discarded, but since `cohortId` only populates a nullable FK, a failure here goes unnoticed and the attempt is recorded with `cohort_id = null`. This corrupts downstream Phase 6 cohort-progress queries that depend on the populated FK, silently introducing data integrity failures with no log entry.

**Fix:**
```typescript
// Destructure and check error for each critical query:
const { data: rawProgress, error: progressError } = await supabase
  .from('lesson_progress')
  .select('completed')
  .eq('user_id', user.id)
  .eq('lesson_id', lessonId)
  .maybeSingle()

if (progressError) {
  console.error('[quiz submit] lesson_progress query error', progressError)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}

// Same pattern for quiz_definitions and enrollment queries.
```

---

### CR-04: `answers` array-type bypass — `Array.isArray` check missing allows poisoned scoring

**File:** `app/api/quiz/submit/route.ts:27-32`

**Issue:** The validation guard at line 27 checks `typeof answers !== 'object'`. In JavaScript, `Array.isArray([]) === true` and `typeof [] === 'object'`, so a client that sends `answers: ["a", "b"]` passes the guard. Downstream, `answers[q.id]` where `q.id` is a UUID string is used as an array index accessor. On a JavaScript array, a non-integer string index returns `undefined`, so every question scores as incorrect — this is not a security bypass in the scoring direction. However the `answers` value is then persisted to the DB as-is via `answers: answers as Record<string, string>` in `insertData`. Persisting an array into a `jsonb` column typed as an object map is a data integrity violation that corrupts the attempt record and any future replay/audit logic.

**Fix:**
```typescript
if (
  !lessonId ||
  !answers ||
  typeof answers !== 'object' ||
  Array.isArray(answers)
) {
  return NextResponse.json(
    { error: 'Missing required fields: lessonId and answers are required' },
    { status: 400 }
  )
}
```

---

## Warnings

### WR-01: RESULTS view shows correct-answer annotation twice when user selected wrong answer

**File:** `components/QuizSection.tsx:264-275`

**Issue:** For a wrong answer, both annotation blocks render simultaneously. Line 264 checks `isSelected && !item.correct && isCorrect` — this condition is impossible: if the user selected this option (`isSelected === true`) and got it wrong (`!item.correct === true`), then `isSelected === item.selectedAnswer` means this option is the selected (wrong) one, not the correct one — so `isCorrect` (i.e. `option === item.correctAnswer`) will be `false`. The block at line 264 never renders. The correct-answer reveal only ever comes from the block at lines 270-273 (`!isSelected && isCorrect && !item.correct`). The dead block at 264 is unreachable code that indicates a logic analysis error and should be removed to prevent future maintainers from introducing bugs while trying to "fix" it.

**Fix:** Remove lines 263-267 entirely. The block at lines 270-273 is the correct and sole correct-answer reveal for wrong answers.

---

### WR-02: Missing RLS INSERT policy on `quiz_definitions` — direct client inserts are ungated

**File:** `supabase/migrations/20260428000008_quiz_rls.sql` (cross-referenced with `20260428000002_create_remaining_tables.sql`)

**Issue:** Migration 00002 creates RLS on `quiz_definitions` with only a SELECT policy. Migration 00008 replaces that SELECT policy with an enrollment-scoped one. Neither migration creates INSERT, UPDATE, or DELETE policies on `quiz_definitions`. With RLS enabled and no permissive write policy, writes from the anon/authenticated role are blocked by default in Supabase — this is the safe default. However it means no explicit deny-by-intent is documented, and a future migration that accidentally adds a broad write policy would silently open the table. More immediately: the server-side route handler uses the anon-key client, which means if a service-role client is ever introduced carelessly, quiz questions including `correct_answer` could be modified by an enrolled user who knows the quiz_definition ID.

**Fix:** Add an explicit comment in the migration or a restrictive policy to document the intent:
```sql
-- Explicitly document: no write access for authenticated role.
-- quiz_definitions are managed by service_role (admin tooling) only.
-- RLS default-deny covers INSERT/UPDATE/DELETE; this comment is intentional.
```

---

### WR-03: Enrollment cohort lookup is not scoped to the lesson's course — wrong cohort_id can be recorded

**File:** `app/api/quiz/submit/route.ts:91-98`

**Issue:** The enrollment query fetches `cohort_id` with only `user_id = user.id` and `status = 'active'`. If a user is enrolled in multiple active cohorts (e.g., they were added to two cohorts for different courses, or re-enrolled after dropping), `maybeSingle()` will throw a PostgREST error (multiple rows returned) which is silently discarded, leaving `cohort_id = null`. Even if only one active enrollment exists, it may belong to a different course than the one containing `lessonId`. The attempt is then recorded with a cohort_id that does not correspond to the lesson's course, corrupting the Phase 6 cohort-progress aggregation.

**Fix:**
```typescript
// Scope enrollment lookup to the lesson's course via a join:
const { data: rawEnrollment, error: enrollError } = await supabase
  .from('enrollments')
  .select('cohort_id')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .eq('cohort_id',
    supabase
      .from('cohorts')
      .select('id')
      .eq('course_id',
        supabase
          .from('modules')
          .select('course_id')
          .eq('id',
            supabase.from('lessons').select('module_id').eq('id', lessonId).single()
          ).single()
      )
  )
  .maybeSingle()
```
Alternatively, perform a single join query: `enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN modules m ON m.course_id = c.course_id JOIN lessons l ON l.module_id = m.id WHERE l.id = lessonId AND e.user_id = auth.uid() AND e.status = 'active'`.

---

### WR-04: `Progress` component unconditionally renders `ProgressTrack` + `ProgressIndicator` as siblings to `children` — layout break when `children` are present

**File:** `components/ui/progress.tsx:14-26`

**Issue:** The `Progress` component wraps `ProgressPrimitive.Root` with `flex flex-wrap gap-3` and renders both `{children}` and a `<ProgressTrack>` unconditionally. If the caller passes children (e.g. `<ProgressLabel>` or `<ProgressValue>`), those children render as flex siblings to the track — the intended layout. However `<QuizSection>` at line 221 uses `<Progress value={results.pct} className="h-2 mt-2" />` with no children. In this case the outer Root element has `className="flex flex-wrap gap-3 h-2 mt-2"` but the inner `ProgressTrack` has `className="relative flex h-1 w-full ..."`. The root element is `h-2` (8px) while the track is `h-1` (4px) — these heights conflict and the visual result depends on browser flex behavior. Additionally the `gap-3` on the root adds 12px of gap even when there are no children, wasting vertical space. The `h-2` override from the caller is also semantically wrong — it should target the track, not the root.

**Fix:** Either document that `className` on `<Progress>` targets the root (not the track) and callers must use `<ProgressTrack className="h-2">` explicitly, or expose a `trackClassName` prop to pass through to the track:
```typescript
function Progress({
  className,
  trackClassName,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props & { trackClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack className={trackClassName}>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}
```

---

## Info

### IN-01: Dead `SUBMITTED` state branch — `quizState` transitions directly to `ACTIVE` on error, not to `SUBMITTED`

**File:** `components/QuizSection.tsx:70-88`

**Issue:** `handleSubmit` sets state to `SUBMITTED` at line 72, then on catch at line 86 sets it back to `ACTIVE`. The `SUBMITTED` state renders a disabled "Submitting..." button. This is functionally correct as an optimistic loading state. However the `SUBMITTED` render block at lines 187-198 is a dead end: there is no code path that leaves the component in `SUBMITTED` permanently (it always transitions to either `RESULTS` or `ACTIVE`). This is fine intentionally, but a code reader or future developer adding retry logic may be confused about whether `SUBMITTED` is a terminal or transient state. A comment clarifying intent would prevent incorrect assumptions.

**Fix:**
```typescript
// SUBMITTED is a transient in-flight state — always transitions to RESULTS (success)
// or back to ACTIVE (error). It is never a terminal state.
if (quizState === 'SUBMITTED') {
```

---

### IN-02: `quiz_definitions` RLS migration does not drop or update the companion INSERT/UPDATE/DELETE policies that do not exist — no forward-compatibility guard

**File:** `supabase/migrations/20260428000008_quiz_rls.sql:15-16`

**Issue:** The migration correctly uses `drop policy if exists` for the old SELECT policy. However the comment block at lines 1-11 only describes replacing the SELECT policy. If a future migration adds write policies to `quiz_definitions` and is later rolled back, migration 00008 will not clean up those write policies. This is a minor forward-compatibility concern, not a current bug. The migration could be more defensive.

**Fix:** No code change required. Add a comment noting that write policies are intentionally absent and should only be added with explicit service_role scoping.

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
