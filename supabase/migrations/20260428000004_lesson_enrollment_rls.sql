-- ============================================================
-- Migration: 20260428000004_lesson_enrollment_rls
-- Phase 3: Cohort Enrollment + Learner Dashboard (gap closure)
-- Replaces the permissive lessons SELECT policy (which allowed
-- any authenticated user to read lessons for published courses)
-- with an enrollment-scoped policy that restricts lesson reads
-- to users enrolled in a cohort for that lesson's course.
-- This satisfies ROADMAP SC-5.
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Drop the old permissive policy
-- The policy name must match exactly as created in migration 00002.
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can view lessons of published courses"
  on public.lessons;

-- ------------------------------------------------------------
-- Step 2: Create enrollment-scoped SELECT policy
-- A user can read a lesson row only when they have an active
-- enrollment in at least one cohort whose course contains the
-- module that owns this lesson.
--
-- Path: lessons.module_id → modules.course_id
--       → cohorts.course_id → enrollments.cohort_id
--       → enrollments.user_id = auth.uid()
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
      where e.user_id = auth.uid()
        and m.id = lessons.module_id
    )
  );
