---
phase: 05-quiz-engine
fixed_at: 2026-04-29T00:00:00Z
review_path: .planning/phases/05-quiz-engine/05-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 7
skipped: 3
status: partial
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-29T00:00:00Z
**Source review:** .planning/phases/05-quiz-engine/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (CR-01 through CR-04, WR-01 through WR-06; Info excluded by fix_scope=critical_warning)
- Fixed: 7
- Skipped/Already fixed: 3

## Fixed Issues

### CR-02: PostgREST deep-join filter silently ignored — cohort_id recorded incorrectly

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** aa7279a
**Applied fix:** Replaced the single-step `.eq('cohorts.modules.lessons.id', lessonId)` deep-join enrollment lookup (which PostgREST silently discards) with a two-step sequential approach: (1) query `lessons` joined to `modules` to resolve `course_id` for the lesson, (2) query `cohorts` to get all cohort IDs for that course, then (3) query `enrollments` filtered with `.in('cohort_id', cohortIds)`. This ensures the correct `cohort_id` is recorded even for multi-enrolled users, preventing corrupted Phase 6 cohort-progress aggregation.

---

### CR-03: VideoPlayer double-completion race — handleEnded fires unconditionally

**Files modified:** `components/VideoPlayer.tsx`
**Commit:** 0558cac
**Applied fix:** Added `if (completedRef.current) return` early-return guard at the top of `handleEnded`, plus `completedRef.current = true` assignment before the `saveProgress` call in that handler. This prevents the double-fire when a user watches past 90% (triggering `handleTimeUpdate` which sets the ref) and then the video ends (triggering `handleEnded` which previously ignored the ref), eliminating two concurrent `POST /api/video/progress` requests and two `router.refresh()` calls.

---

### CR-04: Seed file inserts auth.users rows with empty encrypted_password

**Files modified:** `supabase/seed.sql`
**Commit:** 28f83a1
**Applied fix:** Replaced both empty `''` `encrypted_password` values for the Jane Doe and Alex Kim stub auth.users rows with `crypt('ChangeMe123!', gen_salt('bf'))`. This produces a valid bcrypt hash that satisfies gotrue invariants and prevents `npx supabase db reset` failures or CI schema validation errors.

---

### WR-03: LessonPage — chat history messages query error silently discarded

**Files modified:** `app/dashboard/lesson/[lessonId]/page.tsx`
**Commit:** 3f876dd
**Applied fix:** Destructured `error: msgsError` from the `ai_chat_messages` query result and added `console.error('[lesson page] ai_chat_messages fetch error', msgsError)` logging when the error is non-null. The component return value remains `(messagesData ?? [])` so the chat panel degrades gracefully to an empty history rather than crashing, while the error is now visible in server logs.

---

### WR-04: QuizSection submit — all HTTP error codes produce the same user message

**Files modified:** `components/QuizSection.tsx`
**Commit:** 9a63112
**Applied fix:** Replaced `if (!res.ok) throw new Error('submit failed')` with a status-aware block that parses the response JSON body and maps: 403 to `body.error ?? 'Complete the lesson before submitting the quiz.'`, 404 to `'Quiz not found.'`, and all others to the generic retry message. Updated `catch {}` to `catch (err) { setSubmitError(err instanceof Error ? err.message : ...) }` so the actionable message propagates to the UI instead of being replaced by a hardcoded string.

---

### WR-05: quiz/submit — zero-question quiz persists a meaningless attempt record

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** 03e9ad9
**Applied fix:** Added guard `if (!questions || questions.length === 0) { return NextResponse.json({ error: 'Quiz has no questions' }, { status: 422 }) }` immediately after the `questions` assignment on line 114, before the scoring loop. This prevents empty quiz definitions (valid per DB schema but meaningless) from producing `score=0, max_score=0` attempt rows that render as "0 / 0 — 0%".

---

### WR-06: video/progress route — lessonId not validated as UUID; returns 403 instead of 400

**Files modified:** `app/api/video/progress/route.ts`
**Commit:** 0ded4ac
**Applied fix:** Added UUID format validation `const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` immediately after the existing `!lessonId` presence check block. Malformed `lessonId` values now return `{ error: 'Invalid lessonId' }` with status 400 before reaching PostgREST, consistent with the quiz submit route and preventing the misleading 403 that resulted from a PostgREST query error on malformed UUIDs.

---

## Skipped Issues

### CR-01: Lessons RLS missing enrollment-status filter

**File:** `supabase/migrations/20260428000004_lesson_enrollment_rls.sql:28-40`
**Reason:** already_fixed — Migration `20260428000005_lesson_rls_status_fix.sql` is already present in the repository and contains the exact corrective fix: it drops the `enrolled users can view lessons` policy and recreates it with `and e.status = 'active'`. Creating a new `20260429000009` migration would be redundant and add noise to the migration chain with no functional difference.
**Original issue:** Policy in migration 00004 lacked `e.status = 'active'`, allowing dropped/completed enrollees to bypass the lesson access gate and submit quiz attempts.

---

### WR-01: answers array-type bypass — Array.isArray check missing

**File:** `app/api/quiz/submit/route.ts:39-44`
**Reason:** already_fixed — The current `route.ts` already contains the fix at line 39: `if (!answers || typeof answers !== 'object' || Array.isArray(answers))`. The REVIEW.md itself notes "The current code does NOT include this fix" but inspection of the actual submitted file confirms it was added in a prior review/fix pass.
**Original issue:** `typeof [] === 'object'` allowed array values to bypass the guard, corrupting the jsonb answers column.

---

### WR-02: quiz/submit route — lessonId not validated as UUID

**File:** `app/api/quiz/submit/route.ts:25-34`
**Reason:** already_fixed — Per the REVIEW.md note: "The UUID validation is present at lines 31-34. This warning is downgraded to confirmed-fixed." This was explicitly marked as confirmed-fixed in the review document and in the prompt instructions.
**Original issue:** Malformed lessonId could reach PostgREST without UUID format validation.

---

_Fixed: 2026-04-29T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
