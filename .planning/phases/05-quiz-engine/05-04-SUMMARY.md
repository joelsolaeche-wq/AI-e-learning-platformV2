---
plan: 05-04
phase: 05-quiz-engine
status: complete
gap_closure: true
completed: 2026-04-29
commits:
  - d234ce0
  - a3e1561
---

## What Was Built

Closed 2 UAT blockers that prevented quiz access on all three lesson pages.

**Fix 1 — VideoPlayer router.refresh()** (`components/VideoPlayer.tsx`):
`saveProgress()` was writing `completed=true` to the DB via `/api/video/progress` but the Server Component re-render was never triggered. `isLessonComplete` stayed frozen at its SSR value so `QuizSection` remained locked even after the DB was updated. Added `useRouter` from `next/navigation`, called `router.refresh()` chained via `.then()` after `saveProgress()` resolves in both the `pct >= 0.9` completion branch and `handleEnded`. The `router` was added to both `useCallback` dependency arrays.

**Fix 2 — seed.sql quiz data** (`supabase/seed.sql`):
`seed.sql` only seeded `quiz_definitions` for lesson 1 (`...0030`). Lessons 2 (`...0031`) and 3 (`...0032`) had no rows, so `quizDef` was `null`, `clientQuestions` was `[]`, and the render gate `{clientQuestions.length > 0 && <QuizSection />}` hid the component entirely. Added 3 JSONB questions each for lessons 2 and 3 with `on conflict (id) do nothing` for idempotent re-seeding.

## Key Files

### Modified
- `components/VideoPlayer.tsx` — added `useRouter`, chained `router.refresh()` after completion save
- `supabase/seed.sql` — added quiz_definitions rows for lessons `...0031` and `...0032`

## Verification

- `grep -c 'router\.refresh' components/VideoPlayer.tsx` → `2` ✓
- `grep -c '00000000-0000-0000-0000-000000000041\|00000000-0000-0000-0000-000000000042' supabase/seed.sql` → `2` ✓
- No new TypeScript errors in `VideoPlayer.tsx` (pre-existing error in `app/api/tutor/chat/route.ts` is from Phase 6, unrelated to this gap closure) ✓

## UAT Gaps Addressed

1. "When lesson_progress.completed = true, the Take Quiz button is enabled and quiz questions are revealed" — router.refresh() now fires after the DB write, re-rendering the Server Component with the updated isLessonComplete value
2. "All 3 lesson pages show a quiz button (disabled or enabled depending on progress)" — quiz_definitions now seeded for all 3 lessons; clientQuestions.length > 0 is true for all lessons

## Self-Check: PASSED
