---
plan: 03-05
phase: 03-cohort-enrollment-learner-dashboard
status: complete
completed: 2026-04-28
---

# Plan 03-05: Enrollment-Scoped RLS on Lessons

## What Was Built

Created migration `20260428000004_lesson_enrollment_rls.sql` that replaces the permissive lessons SELECT policy with an enrollment-scoped policy, satisfying ROADMAP SC-5.

## Key Changes

### supabase/migrations/20260428000004_lesson_enrollment_rls.sql (new, 40 lines)
- **Dropped:** `"Authenticated users can view lessons of published courses"` — the permissive policy that allowed any authenticated user to read lesson rows for any published course.
- **Created:** `"enrolled users can view lessons"` — enrollment-scoped SELECT policy using an EXISTS subquery through `enrollments → cohorts → modules → lessons`.
- JOIN path: `enrollments.user_id = auth.uid()` → `cohorts.id` (via `enrollments.cohort_id`) → `modules.course_id = cohorts.course_id` → `modules.id = lessons.module_id`.

### Database Push
- `supabase db push` applied migration `20260428000004_lesson_enrollment_rls` to remote Supabase project `knijhvstmsujmjojipiz` with exit code 0.
- `supabase migration list` confirms both Local and Remote columns show `20260428000004`.

## Requirements Satisfied

- ROADMAP SC-5: An unenrolled authenticated user receives zero rows from `SELECT` on `public.lessons`. An enrolled user can read the lessons for their cohort's course.

## Deviations

None. Plan executed as specified.

## Self-Check: PASSED

- Migration file exists at `supabase/migrations/20260428000004_lesson_enrollment_rls.sql`
- DROP POLICY for old permissive policy present ✓
- CREATE POLICY for enrollment-scoped policy present ✓
- EXISTS subquery uses correct JOIN chain through enrollments → cohorts → modules ✓
- `supabase db push` exit code 0, migration shows Applied in both Local and Remote ✓
