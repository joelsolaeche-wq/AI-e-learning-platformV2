-- ============================================================
-- Migration: 20260428000003_enrollment_rls
-- Phase 3: Cohort Enrollment + Learner Dashboard
-- Adds the INSERT policy on enrollments (so users can enroll
-- themselves) and a cohort-mate SELECT policy on profiles
-- (so a learner can see their teammates on the dashboard).
-- ============================================================

-- ------------------------------------------------------------
-- enrollments: allow self-enrollment
-- ------------------------------------------------------------
create policy "Users can insert their own enrollments"
  on public.enrollments
  for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- enrollments: allow reading peer enrollment rows in the same cohort
-- Required so the cohort-mate profiles policy subquery can resolve
-- teammate enrollment rows (RLS on enrollments applies to the
-- EXISTS subquery inside the profiles policy).
-- ------------------------------------------------------------
create policy "Users can view enrollments in their cohorts"
  on public.enrollments
  for select
  using (
    cohort_id in (
      select cohort_id
      from public.enrollments
      where user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- profiles: allow reading cohort-mates
-- A learner can read a profile row when:
--   1. it's their own row (already covered by the existing policy
--      from migration 00001, but we re-include the auth.uid() = id
--      branch here so this single policy is self-sufficient), OR
--   2. there exists a pair of enrollments e1 (current user) and e2
--      (target profile) sharing the same cohort_id.
-- ------------------------------------------------------------
create policy "Users can view profiles of cohort-mates"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.enrollments e1
      join public.enrollments e2 on e2.cohort_id = e1.cohort_id
      where e1.user_id = auth.uid()
        and e2.user_id = profiles.id
    )
  );
