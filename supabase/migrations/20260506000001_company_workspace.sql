-- ============================================================
-- Migration: 20260506000001_company_workspace
-- Foundation for the per-company admin workspace.
--
-- Adds:
--   1. 'company_owner' role on public.profiles
--   2. is_company_owner_of(uuid) helper (SECURITY DEFINER, mirrors is_admin)
--   3. public.cohort_courses M2M (cohort -> N courses)
--   4. Backfill of cohort_courses from existing cohorts.course_id
--   5. cohorts.course_id becomes nullable (kept as "primary course" hint)
--   6. public.v_cohort_progress view for the workspace progress tab
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Extend profiles.role check with 'company_owner'
-- ------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('learner', 'instructor', 'admin', 'company_owner'));

-- ------------------------------------------------------------
-- 2. Helper: is the current user a company_owner of <company>?
--    SECURITY DEFINER avoids RLS recursion on profiles.
-- ------------------------------------------------------------
create or replace function public.is_company_owner_of(company uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'company_owner'
      and org_id = company
  );
$$;

-- ------------------------------------------------------------
-- 3. cohort_courses M2M
-- ------------------------------------------------------------
create table if not exists public.cohort_courses (
  cohort_id  uuid not null references public.cohorts(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cohort_id, course_id)
);

alter table public.cohort_courses enable row level security;

-- Admins can do everything (mirrors course_companies)
create policy "admin_manage_cohort_courses"
  on public.cohort_courses
  using (public.is_admin())
  with check (public.is_admin());

-- A company_owner can manage rows for cohorts that belong to their company
create policy "company_owner_manage_own_cohort_courses"
  on public.cohort_courses
  using (
    exists (
      select 1 from public.cohorts c
      where c.id = cohort_courses.cohort_id
        and public.is_company_owner_of(c.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.cohorts c
      where c.id = cohort_courses.cohort_id
        and public.is_company_owner_of(c.company_id)
    )
  );

-- Authenticated users can read cohort_courses (used by catalog/dashboard
-- to know which courses live inside a cohort the learner is enrolled in).
create policy "authenticated_read_cohort_courses"
  on public.cohort_courses
  for select
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 4. Backfill: every existing cohort gets a row in cohort_courses
--    so the new code can always query the M2M without losing data.
-- ------------------------------------------------------------
insert into public.cohort_courses (cohort_id, course_id)
select id, course_id
from public.cohorts
where course_id is not null
on conflict do nothing;

-- ------------------------------------------------------------
-- 5. cohorts.course_id is now optional. We keep the column as
--    a hint for the "primary" course (first selected in the form);
--    the source of truth for which courses a cohort runs is
--    cohort_courses.
-- ------------------------------------------------------------
alter table public.cohorts
  alter column course_id drop not null;

-- ------------------------------------------------------------
-- 6. v_cohort_progress
--    For every active enrollment x course-in-cohort, exposes
--    total / completed lesson counts and percentage.
--    security_invoker = true so the view respects the caller's
--    RLS on the underlying tables. The admin workspace queries
--    this via service-role (createAdminClient), so RLS is bypassed
--    there; non-admin reads will be denied by the underlying
--    lesson_progress policies, which is the safe default.
-- ------------------------------------------------------------
create or replace view public.v_cohort_progress
with (security_invoker = true)
as
with cohort_user_course as (
  select
    e.cohort_id,
    e.user_id,
    cc.course_id
  from public.enrollments e
  join public.cohort_courses cc on cc.cohort_id = e.cohort_id
  where e.status = 'active'
),
course_lessons as (
  select
    m.course_id,
    l.id as lesson_id
  from public.modules m
  join public.lessons l on l.module_id = m.id
)
select
  cuc.cohort_id,
  cuc.user_id,
  cuc.course_id,
  count(cl.lesson_id)::int                                   as total_lessons,
  count(lp.id) filter (where lp.completed)::int              as completed_lessons,
  case
    when count(cl.lesson_id) = 0 then 0
    else round(
      (count(lp.id) filter (where lp.completed))::numeric * 100
      / count(cl.lesson_id)::numeric
    )::int
  end                                                        as pct
from cohort_user_course cuc
left join course_lessons cl on cl.course_id = cuc.course_id
left join public.lesson_progress lp
       on lp.lesson_id = cl.lesson_id
      and lp.user_id  = cuc.user_id
group by cuc.cohort_id, cuc.user_id, cuc.course_id;

grant select on public.v_cohort_progress to authenticated;

commit;
