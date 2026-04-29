-- ============================================================
-- Migration: 20260428000008_quiz_rls
-- Phase 5: Tighten quiz_definitions SELECT policy
-- Replaces the permissive auth.role()='authenticated' policy
-- with enrollment-scoped access matching the lessons RLS pattern
-- from migration 00004.
--
-- Security: T-5-01 mitigation (ASVS V4 access control)
-- Without this, any authenticated user can SELECT full
-- quiz_definitions rows including correct_answer via browser client.
-- ============================================================

-- Step 1: Drop the old permissive policy.
-- Policy name must match exactly as created in migration 00002.
drop policy if exists "Authenticated users can view quiz definitions"
  on public.quiz_definitions;

-- Step 2: Create enrollment-scoped SELECT policy.
-- Traversal: quiz_definitions.lesson_id → lessons.module_id
--            → modules.course_id → cohorts.course_id
--            → enrollments.cohort_id + enrollments.user_id
create policy "Enrolled users can view quiz definitions"
  on public.quiz_definitions
  for select
  using (
    exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.cohorts c on c.course_id = m.course_id
      join public.enrollments e on e.cohort_id = c.id
      where l.id = quiz_definitions.lesson_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
