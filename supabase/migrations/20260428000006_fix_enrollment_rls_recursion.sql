-- ============================================================
-- Migration: 20260428000006_fix_enrollment_rls_recursion
-- Phase 3: Hotfix — break RLS recursion on public.enrollments
--
-- Root cause: the "Users can view enrollments in their cohorts"
-- policy has a self-referential subquery (SELECT FROM enrollments
-- inside a policy ON enrollments). This was benign until migration
-- 00004 added an enrollment-scoped RLS on public.lessons that also
-- queries enrollments — triggering the policy, which triggered
-- itself: 42P17 infinite recursion.
--
-- Fix: replace the self-referential subquery with a SECURITY
-- DEFINER helper function. SECURITY DEFINER functions bypass RLS,
-- breaking the recursion chain.
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Create a SECURITY DEFINER helper that returns the
-- current user's active cohort IDs without triggering RLS.
-- set search_path = '' guards against search_path injection.
-- ------------------------------------------------------------
create or replace function public.get_my_active_cohort_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select cohort_id
  from public.enrollments
  where user_id = auth.uid()
    and status  = 'active'
$$;

-- ------------------------------------------------------------
-- Step 2: Drop the recursive policy and recreate it using the
-- helper function — no subquery on enrollments inside the policy.
-- ------------------------------------------------------------
drop policy if exists "Users can view enrollments in their cohorts"
  on public.enrollments;

create policy "Users can view enrollments in their cohorts"
  on public.enrollments
  for select
  using (
    cohort_id in (select public.get_my_active_cohort_ids())
  );
