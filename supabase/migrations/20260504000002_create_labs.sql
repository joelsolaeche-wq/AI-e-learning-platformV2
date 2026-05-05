-- ============================================================
-- Migration: 20260504000002_create_labs
-- Phase B of the agent-feature suite. Adds the lab data model:
--   labs                   one per lesson, admin-authored brief
--   lab_rubric_items       admin-authored evaluation criteria, ordered
--   lab_submissions        learner submissions of a public GitHub URL
--   lab_submission_scores  per-criterion grading (1–3 stars), filled by
--                          the evaluator (Phase C). NULL until scored.
--
-- RLS posture mirrors quiz_definitions / lesson_progress:
--   labs + lab_rubric_items : SELECT for enrolled learners (rubric is
--                             intentionally visible *before* submit per
--                             product requirement); writes via service_role
--                             only (admin tooling).
--   lab_submissions         : learners read/insert their own rows;
--                             writes for status/score updates use
--                             service_role (evaluator).
--   lab_submission_scores   : learners read scores for their own
--                             submissions; writes service_role only.
-- ============================================================

-- ============================================================
-- Table: public.labs
-- One lab per lesson. brief_md is markdown the learner sees up-front.
-- ============================================================
create table if not exists public.labs (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null unique references public.lessons(id) on delete cascade,
  title       text not null,
  brief_md    text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists labs_lesson_id_idx on public.labs(lesson_id);

-- ============================================================
-- Table: public.lab_rubric_items
-- Ordered list of evaluation criteria. weight is reserved for future
-- weighted scoring; Phase C uses it as a hint to the model.
-- ============================================================
create table if not exists public.lab_rubric_items (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references public.labs(id) on delete cascade,
  position    integer not null check (position > 0),
  criterion   text not null,
  description text not null default '',
  weight      integer not null default 1 check (weight between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (lab_id, position)
);

create index if not exists lab_rubric_items_lab_id_idx on public.lab_rubric_items(lab_id);

-- ============================================================
-- Table: public.lab_submissions
-- Each row is one submission attempt. Re-submission allowed — there
-- can be multiple rows per (user_id, lab_id). Latest submission is
-- the most recent submitted_at.
-- ============================================================
create table if not exists public.lab_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  lab_id        uuid not null references public.labs(id) on delete cascade,
  cohort_id     uuid references public.cohorts(id) on delete set null,
  github_url    text not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'evaluating', 'scored', 'failed')),
  overall_stars integer check (overall_stars between 1 and 3),
  total_score   integer not null default 0 check (total_score >= 0),
  max_score     integer not null default 0 check (max_score >= 0),
  summary_md    text,
  error_message text,
  submitted_at  timestamptz not null default now(),
  scored_at     timestamptz
);

create index if not exists lab_submissions_user_lab_idx
  on public.lab_submissions(user_id, lab_id, submitted_at desc);

create index if not exists lab_submissions_lab_idx
  on public.lab_submissions(lab_id, submitted_at desc);

-- ============================================================
-- Table: public.lab_submission_scores
-- Per-criterion result. One row per (submission, rubric item).
-- ============================================================
create table if not exists public.lab_submission_scores (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.lab_submissions(id) on delete cascade,
  rubric_item_id  uuid not null references public.lab_rubric_items(id) on delete cascade,
  stars           integer not null check (stars between 1 and 3),
  feedback_md     text not null default '',
  created_at      timestamptz not null default now(),
  unique (submission_id, rubric_item_id)
);

create index if not exists lab_submission_scores_submission_idx
  on public.lab_submission_scores(submission_id);

-- ============================================================
-- RLS: labs
-- Enrolled learners can read labs whose lesson belongs to a course
-- they're enrolled in (via cohort). Mirrors the quiz_definitions /
-- lessons enrollment-scoped pattern.
-- Writes: no policies — service_role only (admin authoring).
-- ============================================================
alter table public.labs enable row level security;

create policy "Enrolled users can view labs"
  on public.labs
  for select
  using (
    exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.cohorts c on c.course_id = m.course_id
      join public.enrollments e on e.cohort_id = c.id
      where l.id = labs.lesson_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

-- ============================================================
-- RLS: lab_rubric_items
-- Visible to any user who can see the parent lab (so the rubric
-- is shown *before* the learner submits — per product rule).
-- ============================================================
alter table public.lab_rubric_items enable row level security;

create policy "Enrolled users can view lab rubric items"
  on public.lab_rubric_items
  for select
  using (
    exists (
      select 1
      from public.labs lab
      join public.lessons l on l.id = lab.lesson_id
      join public.modules m on m.id = l.module_id
      join public.cohorts c on c.course_id = m.course_id
      join public.enrollments e on e.cohort_id = c.id
      where lab.id = lab_rubric_items.lab_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

-- ============================================================
-- RLS: lab_submissions
-- Learners read/insert their own rows. UPDATE is reserved for the
-- evaluator running under service_role, which is RLS-exempt.
-- ============================================================
alter table public.lab_submissions enable row level security;

create policy "Users can view their own lab submissions"
  on public.lab_submissions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own lab submissions"
  on public.lab_submissions
  for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- RLS: lab_submission_scores
-- Learners read scores for their own submissions. Inserts are done
-- by the evaluator under service_role (no insert policy).
-- ============================================================
alter table public.lab_submission_scores enable row level security;

create policy "Users can view scores for their own submissions"
  on public.lab_submission_scores
  for select
  using (
    exists (
      select 1
      from public.lab_submissions s
      where s.id = lab_submission_scores.submission_id
        and s.user_id = auth.uid()
    )
  );
