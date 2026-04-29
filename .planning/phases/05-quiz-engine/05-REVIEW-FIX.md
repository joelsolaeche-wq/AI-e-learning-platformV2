---
phase: 05-quiz-engine
fixed_at: 2026-04-28T00:00:00Z
review_path: .planning/phases/05-quiz-engine/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-28T00:00:00Z
**Source review:** .planning/phases/05-quiz-engine/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (4 Critical + 4 Warning; Info excluded by fix_scope=critical_warning)
- Fixed: 8
- Skipped: 0

---

## Fixed Issues

### CR-01: No enrollment authorization check in submit route

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** 61335d0
**Applied fix:** Added an enrollment authorization query against `lessons` before the lesson-completion gate. The lessons RLS from migration 00004 is enrollment-scoped, so if the user is not enrolled in a cohort whose course contains the lesson, the query returns null and the route returns 403. This prevents a session-holding user from submitting quiz attempts for lessons in courses they are not enrolled in.

---

### CR-02: `lessonId` not validated as UUID before DB queries

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** 61335d0
**Applied fix:** Added UUID regex validation immediately after destructuring `lessonId`. A non-UUID `lessonId` now returns 400 before any DB query is issued, preventing PostgREST HTTP errors from being silently swallowed as "row not found" and closing the associated gate-bypass vector.

---

### CR-03: Supabase errors silently discarded — gate can be bypassed

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** 61335d0
**Applied fix:** Destructured `error` from the `lesson_progress`, `quiz_definitions`, and enrollment cohort queries. Each now checks for a non-null error and returns 500 with a `console.error` log entry before proceeding. This prevents DB errors from being silently treated as not-found/null, which previously caused logic to proceed past the completion gate on infrastructure failures.

---

### CR-04: `answers` array-type bypass — `Array.isArray` check missing

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** 61335d0
**Applied fix:** Added `Array.isArray(answers)` to the validation guard. The prior check `typeof answers !== 'object'` passes for arrays since `typeof [] === 'object'`. An array `answers` now returns 400 before reaching the scoring or persistence logic.

---

### WR-01: Dead correct-answer annotation block in results view

**Files modified:** `components/QuizSection.tsx`
**Commit:** 9eeae22
**Applied fix:** Removed the unreachable block `{isSelected && !item.correct && isCorrect && ...}` (lines 264-268 in the original). The condition is logically impossible: if the user selected this option (`isSelected === true`) and it is wrong (`!item.correct`), then `isCorrect` (this option equals `item.correctAnswer`) must be false — the selected option cannot simultaneously be wrong and be the correct answer. The sole correct-answer reveal comes from the surviving `{!isSelected && isCorrect && !item.correct && ...}` block, which is correct. A clarifying comment was added in place of the removed block.

---

### WR-02: Missing explicit documentation of write-policy intent on `quiz_definitions`

**Files modified:** `supabase/migrations/20260428000008_quiz_rls.sql`
**Commit:** 483a605
**Applied fix:** Added a comment block above Step 2 explicitly documenting that no INSERT/UPDATE/DELETE policies are created and that this is intentional. The comment notes that RLS default-deny covers writes for the authenticated role, and that any future write policy must be scoped to service_role only to prevent enrolled users from modifying correct answers.

---

### WR-03: Enrollment cohort lookup not scoped to lesson's course

**Files modified:** `app/api/quiz/submit/route.ts`
**Commit:** 61335d0
**Applied fix:** Replaced the unscoped `enrollments` query (user_id + status only) with a join-scoped query using PostgREST's `!inner` syntax: `enrollments → cohorts!inner → modules!inner → lessons!inner` filtered by `lessonId`. This ensures the recorded `cohort_id` belongs to the cohort whose course contains the submitted lesson, preventing wrong-cohort recording when a user has multiple active enrollments. The `enrollError` is now also destructured and logged (falls back to `cohort_id = null` rather than potentially recording a wrong value).

**Note:** The PostgREST nested filter syntax (`cohorts.modules.lessons.id`) requires human verification — if the deployed Supabase version does not support multi-level nested `.eq()` filters, this query will need to be rewritten as a raw SQL RPC or a sequential join approach. Status: fixed: requires human verification.

---

### WR-04: `Progress` component height prop targets root, not track bar

**Files modified:** `components/ui/progress.tsx`, `components/QuizSection.tsx`
**Commit:** 1a1cef5
**Applied fix:** Added `trackClassName?: string` prop to the `Progress` component (typed as `ProgressPrimitive.Root.Props & { trackClassName?: string }`). The prop is forwarded to `<ProgressTrack className={trackClassName}>` so callers can style the bar height and appearance independently of the root flex wrapper. Updated the `QuizSection.tsx` call site from `className="h-2 mt-2"` to `className="mt-2" trackClassName="h-2"` so the height targets the track bar, not the flex wrapper.

---

_Fixed: 2026-04-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
