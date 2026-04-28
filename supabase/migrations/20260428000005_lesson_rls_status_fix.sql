-- ============================================================
-- Migration: 20260428000005_lesson_rls_status_fix
-- Phase 3: Cohort Enrollment + Learner Dashboard (gap closure)
-- Fixes the lessons RLS SELECT policy to include e.status = 'active'
-- so that dropped and completed enrollees lose lesson read access.
-- Addresses CR-03 from Phase 3 code review.
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Drop the incomplete policy created in migration 00004
-- ------------------------------------------------------------
drop policy if exists "enrolled users can view lessons"
  on public.lessons;

-- ------------------------------------------------------------
-- Step 2: Recreate the policy with enrollment status filter
-- A user can read a lesson row only when they have an ACTIVE
-- enrollment in at least one cohort whose course contains the
-- module that owns this lesson.
--
-- Path: lessons.module_id → modules.course_id
--       → cohorts.course_id → enrollments.cohort_id
--       → enrollments.user_id = auth.uid()
--       → enrollments.status  = 'active'   ← required
-- ------------------------------------------------------------
create policy "enrolled users can view lessons"
  on public.lessons
  for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      join public.modules m on m.course_id = c.course_id
      where e.user_id  = auth.uid()
        and e.status   = 'active'
        and m.id       = lessons.module_id
    )
  );
