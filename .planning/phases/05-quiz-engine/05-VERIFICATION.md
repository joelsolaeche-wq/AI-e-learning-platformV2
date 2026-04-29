---
phase: 05-quiz-engine
verified: 2026-04-28T00:00:00Z
status: human_needed
score: 13/13
overrides_applied: 0
human_verification:
  - test: "Quiz unlock gate — lesson not complete"
    expected: "Take Quiz button is visible but disabled (grey) with lock icon + 'Complete the lesson to unlock the quiz' text when lesson_progress.completed = false"
    why_human: "isLessonComplete=false is a runtime DB state — requires a test user who has not completed the lesson; cannot programmatically simulate the button disabled state in a running browser"
  - test: "Quiz unlock gate — lesson complete"
    expected: "Take Quiz button becomes enabled after lesson reaches 90% completion; clicking it shows the quiz questions"
    why_human: "Requires a running app with a video that can be watched to 90% and lesson_progress.completed being set to true by the video progress route"
  - test: "answer key absent from network traffic"
    expected: "Browser DevTools Network tab shows no correct_answer key in any response before submission — quiz questions arrive as Server Component props (no network request), and POST /api/quiz/submit request payload does not include correct_answer"
    why_human: "Server Component props are not network requests; DevTools verification requires a running browser session to confirm no answer key leaks via any route"
  - test: "RESULTS UI — score banner and per-question review"
    expected: "After submitting, user sees 'N / total — pct%' score banner, Progress bar fills to pct%, per-question review shows correct answers in green and incorrect in red with 'Correct answer: {text}' reveal"
    why_human: "Visual state machine transitions require a browser to verify the LOCKED → ACTIVE → SUBMITTED → RESULTS sequence and color semantics"
  - test: "quiz_attempts row written to Supabase"
    expected: "After submission, Supabase quiz_attempts table has a new row with correct user_id, lesson_id, score, max_score values"
    why_human: "DB write verification requires access to the live Supabase project (knijhvstmsujmjojipiz) and a completed quiz submission"
---

# Phase 5: Quiz Engine Verification Report

**Phase Goal:** A user who has completed a lesson can take a post-lesson quiz, receive a server-side score, and immediately see their total score and per-question answer review.
**Verified:** 2026-04-28
**Status:** human_needed — automated checks pass 13/13; 5 items require browser + DB verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RadioGroup and RadioGroupItem are importable from @/components/ui/radio-group | VERIFIED | `components/ui/radio-group.tsx` exports `RadioGroup`, `RadioGroupItem` backed by `@base-ui/react/radio` and `@base-ui/react/radio-group`; TypeScript compiles cleanly |
| 2 | Progress is importable from @/components/ui/progress | VERIFIED | `components/ui/progress.tsx` exports `Progress` (plus `ProgressTrack`, `ProgressIndicator`, etc.); value prop forwarded to ProgressPrimitive.Root |
| 3 | quiz_definitions SELECT policy is enrollment-scoped, not auth.role()-based | VERIFIED | `supabase/migrations/20260428000008_quiz_rls.sql` drops old policy and creates `"Enrolled users can view quiz definitions"` with JOIN chain through `lessons → modules → cohorts → enrollments` and `e.status = 'active'` filter |
| 4 | POST /api/quiz/submit returns 401 for unauthenticated requests | VERIFIED | `app/api/quiz/submit/route.ts` line 13: `supabase.auth.getUser()` is first operation; `return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` on no user |
| 5 | POST /api/quiz/submit returns 403 when lesson_progress.completed is false | VERIFIED | Lines 39-48: re-fetches `lesson_progress.completed` server-side; returns 403 with `'Lesson not completed'`; client completion claims ignored |
| 6 | POST /api/quiz/submit scores answers server-side using correct_answer from DB | VERIFIED | Lines 67-82: fetches full `quiz_definitions.questions` server-side; maps `answers[q.id] === q.correct_answer` for each question; score never touched by client |
| 7 | POST /api/quiz/submit writes a quiz_attempts row with user_id, lesson_id, score, max_score | VERIFIED | Lines 102-113: `insertData` contains `user_id`, `lesson_id`, `cohort_id`, `answers`, `score`, `max_score`; insert with `as never` cast per PostgREST 14.5 pattern |
| 8 | POST /api/quiz/submit response never contains correct_answer in the questions field | VERIFIED | `correct_answer` only appears in `breakdown[i].correctAnswer` (camelCase rename) in the final response; it is not returned in any pre-breakdown response object |
| 9 | POST /api/quiz/submit returns { score, total, pct, breakdown } in one response | VERIFIED | Line 123: `return NextResponse.json({ score, total, pct, breakdown })` — single round trip; `pct = Math.round((score / total) * 100)` |
| 10 | Lesson page fetches quiz_definitions server-side and strips correct_answer before passing as props | VERIFIED | `page.tsx` lines 61-98: 3-fetch Promise.all includes `quiz_definitions`; `rawQuestions.map(({ id, question, options }) => ({ id, question, options }))` strips correct_answer by destructuring; `ClientQuestion` type has no `correct_answer` field |
| 11 | QuizSection renders a locked state (disabled Take Quiz button) when isLessonComplete is false | VERIFIED | `QuizSection.tsx` line 112: `disabled={!isLessonComplete}`; `isLessonComplete` is server-derived from `lesson_progress.completed ?? false` (line 87 of page.tsx); Lock icon and copy text present |
| 12 | QuizSection submits to POST /api/quiz/submit and transitions to RESULTS state | VERIFIED | Lines 75-87: `fetch('/api/quiz/submit', { method: 'POST', ... })`; on success: `setResults(data)`, `setQuizState('RESULTS')`; on error: reverts to 'ACTIVE' with error message |
| 13 | RESULTS state shows score banner, per-question review with green/red highlighting, and correct answer reveal | VERIFIED | Lines 203-291: score displayed as `{results.score} / {results.total} — {results.pct}%`; `Progress value={results.pct}`; per-question rows use `text-green-400` / `border-green-500/50` / `bg-green-950/30` for correct and `text-destructive` / `border-destructive/50` / `bg-destructive/10` for incorrect; "Correct answer: {item.correctAnswer}" reveal present |

**Score:** 13/13 truths verified by static analysis

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/ui/radio-group.tsx` | Accessible radio button group for answer selection | VERIFIED | 38 lines; exports `RadioGroup` and `RadioGroupItem`; `@base-ui/react/radio` and `@base-ui/react/radio-group` primitives; `cn()` class merging |
| `components/ui/progress.tsx` | Score percentage bar for results | VERIFIED | 83 lines; exports `Progress` (root wrapper), `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue`; accepts `value` prop and forwards to `ProgressPrimitive.Root` |
| `supabase/migrations/20260428000008_quiz_rls.sql` | Enrollment-scoped SELECT policy on quiz_definitions | VERIFIED | 36 lines; drops old `"Authenticated users can view quiz definitions"` policy; creates `"Enrolled users can view quiz definitions"` with enrollment JOIN chain and `e.status = 'active'` filter |
| `app/api/quiz/submit/route.ts` | Server-side quiz scoring Route Handler | VERIFIED | 124 lines; exports `async function POST`; imports from `@/lib/supabase/server` (not auth-helpers); full auth → gate → score → persist → respond pipeline |
| `app/dashboard/lesson/[lessonId]/page.tsx` | Extended server component with quiz data fetch and QuizSection render | VERIFIED | 144 lines; 3-fetch Promise.all; `ClientQuestion` type (no `correct_answer`); destructuring strip pattern; conditional `{clientQuestions.length > 0}` QuizSection render |
| `components/QuizSection.tsx` | Quiz state machine client component (LOCKED → ACTIVE → SUBMITTED → RESULTS) | VERIFIED | 295 lines; starts with `'use client'`; `type QuizState = 'LOCKED' \| 'ACTIVE' \| 'SUBMITTED' \| 'RESULTS'`; `useState<QuizState>('LOCKED')`; all four state branches implemented |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `components/ui/radio-group.tsx` | `components/QuizSection.tsx` | `import { RadioGroup, RadioGroupItem }` | WIRED | Line 8 of QuizSection.tsx: `import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'` |
| `components/ui/progress.tsx` | `components/QuizSection.tsx` | `import { Progress }` | WIRED | Line 9 of QuizSection.tsx: `import { Progress } from '@/components/ui/progress'` |
| `supabase/migrations/20260428000008_quiz_rls.sql` | `public.quiz_definitions` | `DROP + CREATE POLICY` | WIRED | Migration drops old policy and creates enrollment-scoped policy on `public.quiz_definitions`; applied via `supabase db push` (commit eac42ea) |
| `app/api/quiz/submit/route.ts` | `public.lesson_progress` | `SELECT completed WHERE user_id + lesson_id` | WIRED | Lines 39-45: `.from('lesson_progress').select('completed').eq('user_id', user.id).eq('lesson_id', lessonId)` |
| `app/api/quiz/submit/route.ts` | `public.quiz_definitions` | `SELECT questions WHERE lesson_id` | WIRED | Lines 53-58: `.from('quiz_definitions').select('id, questions').eq('lesson_id', lessonId)` |
| `app/api/quiz/submit/route.ts` | `public.quiz_attempts` | `INSERT with score, max_score` | WIRED | Lines 111-113: `.from('quiz_attempts').insert(insertData as never)` |
| `app/dashboard/lesson/[lessonId]/page.tsx` | `components/QuizSection.tsx` | props: `isLessonComplete`, `clientQuestions`, `lessonId` | WIRED | Lines 135-139: `<QuizSection isLessonComplete={isLessonComplete} clientQuestions={clientQuestions} lessonId={lesson.id} />` |
| `components/QuizSection.tsx` | `/api/quiz/submit` | `fetch POST in handleSubmit` | WIRED | Line 75: `fetch('/api/quiz/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId, answers }) })` |
| `app/dashboard/lesson/[lessonId]/page.tsx` | `public.quiz_definitions` | `supabase.from('quiz_definitions').select('questions')` | WIRED | Lines 73-77: 3rd element of Promise.all fetches quiz_definitions for the lessonId |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `QuizSection.tsx` (quiz questions) | `clientQuestions` prop | `page.tsx` → `supabase.from('quiz_definitions').select('questions')` (DB query) | Yes — DB query in Promise.all; empty array only when no quiz row exists for lesson | FLOWING |
| `QuizSection.tsx` (isLessonComplete) | `isLessonComplete` prop | `page.tsx` → `lesson_progress.completed` (DB query) | Yes — DB query; defaults to `false` only when no progress row exists (correct behavior) | FLOWING |
| `QuizSection.tsx` (results) | `results` state | `fetch('/api/quiz/submit')` → Route Handler → DB scoring | Yes — Route Handler fetches quiz_definitions and scores server-side from DB | FLOWING |
| `app/api/quiz/submit/route.ts` (score) | `score` computed | `quiz_definitions.questions[].correct_answer` (DB) | Yes — DB fetch includes correct_answer; scoring computed server-side | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` | Exit 0 — no output | PASS |
| Route Handler exports POST | `node -e "console.log(require('./app/api/quiz/submit/route.ts'))"` | N/A — TS module, verified by tsc | PASS |
| Commits exist in git log | `git log --oneline` | fd72250, 1e756bf, eac42ea, 3ac5fe4, 46b2630, 5313b22 all present | PASS |
| No anti-pattern stubs in QuizSection | grep for TODO/FIXME/placeholder | No hits | PASS |
| No anti-pattern stubs in route.ts | grep for TODO/FIXME/placeholder | No hits | PASS |
| `return null` in QuizSection is fallback-only | Context check at line 293-294 | Comment: "Fallback (should not be reachable)" — all four QuizState values handled above it | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUIZ-01 | 05-01, 05-03 | User can take a quiz after completing a lesson | SATISFIED | `isLessonComplete` gates Take Quiz button; QuizSection renders quiz questions from `clientQuestions` prop; full ACTIVE state with RadioGroup per question |
| QUIZ-02 | 05-02, 05-03 | Quiz is scored server-side (quiz definitions never sent to client) | SATISFIED | Route Handler fetches `quiz_definitions.questions` (with `correct_answer`) server-side only; LessonPage strips `correct_answer` before passing props via destructuring map; RLS migration 00008 enforces enrollment-scoped SELECT on `quiz_definitions` |
| QUIZ-03 | 05-02, 05-03 | User sees their score and per-question answer review immediately after submission | SATISFIED | Single POST to `/api/quiz/submit` returns `{ score, total, pct, breakdown }` in one response; QuizSection RESULTS state renders score banner and per-question review with correct-answer reveal in same render cycle as `setResults(data)` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/QuizSection.tsx` | 294 | `return null` | Info | Unreachable fallback after all four QuizState branches are handled (LOCKED, ACTIVE, SUBMITTED, RESULTS); not a stub — TypeScript exhaustiveness check |

No blockers or warnings found. The `return null` on line 294 is explicitly commented as unreachable and only reached if the state machine somehow escapes its four named states — it does not affect any user-visible output.

---

### Human Verification Required

#### 1. Quiz unlock gate — lesson not complete

**Test:** Log in as a user with no `lesson_progress` row (or `completed = false`) for a lesson that has a `quiz_definitions` row. Navigate to that lesson page.
**Expected:** Quiz section renders below the transcript; "Take Quiz" button is disabled (grey); Lock icon and text "Complete the lesson to unlock the quiz" are visible.
**Why human:** `isLessonComplete=false` is a runtime DB state — cannot simulate the disabled button state in a running browser through static analysis alone.

#### 2. Quiz unlock gate — lesson complete

**Test:** Complete a lesson (or manually upsert `lesson_progress.completed = true` in Supabase), then navigate to the lesson page. Click "Take Quiz."
**Expected:** Button is enabled; clicking it transitions to ACTIVE state showing all quiz questions with RadioGroup options.
**Why human:** Requires a running app with a real session and lesson_progress DB state.

#### 3. Answer key absent from network traffic

**Test:** Open the lesson page, open DevTools Network tab, interact with the quiz (take it and submit). Inspect all network responses for any `correct_answer` key.
**Expected:** No `correct_answer` key in any network response before submission. Quiz questions are Server Component props (no network request for them). Only POST to `/api/quiz/submit` appears after clicking Submit.
**Why human:** Server Component props are not visible in DevTools — this is the key security claim and must be verified by a human watching the network panel.

#### 4. RESULTS UI — score banner and per-question review

**Test:** Complete a quiz by selecting all answers and clicking "Submit Quiz." Observe the result screen.
**Expected:** "Quiz Results" heading; score shown as "N / total — pct%"; Progress bar visually fills to pct%; correct answers highlighted green; incorrect answers highlighted red with "Correct answer: {text}" shown below the wrong selection.
**Why human:** Visual color rendering and state machine transitions cannot be verified without a running browser.

#### 5. quiz_attempts row written to Supabase

**Test:** Submit a quiz, then inspect the `quiz_attempts` table in the Supabase dashboard (project `knijhvstmsujmjojipiz`).
**Expected:** A new row with the correct `user_id`, `lesson_id`, `score`, and `max_score` values. `cohort_id` is populated if the user has an active enrollment.
**Why human:** Requires live DB access to confirm the insert succeeded and contains correct values.

---

## Gaps Summary

No blocking gaps. All 13 automated must-haves are VERIFIED with full codebase evidence.

The 5 human verification items above are the only remaining checks — all are runtime/visual/DB-state verifications that cannot be performed through static code analysis. They do not indicate code defects; they are standard acceptance criteria for an interactive UI backed by a live database.

**Phase goal assessment:** The codebase implementation fully supports the phase goal. The quiz engine architecture is correct: server-side scoring, answer-key stripping at the prop boundary, lesson completion gate, single-response results, and per-question review with correct-answer reveal are all implemented and wired correctly.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
