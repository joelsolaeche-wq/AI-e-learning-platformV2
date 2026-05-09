-- Multi-modal lab submissions: extend lab_submissions to also accept a
-- PDF upload (path in Supabase Storage) or a free-text written response,
-- alongside the existing GitHub URL flow. Each row may carry exactly one
-- of the three sources.
--
-- The evaluator (lib/labs/evaluate.ts) branches on submission_type:
--   'github' → fetch repo snapshot (existing path).
--   'pdf'    → signed URL → fetch bytes → pass to Claude as document.
--   'text'   → embed text directly in the grading prompt.

-- 1. Add the new columns + drop the NOT NULL on github_url so PDF/text
--    submissions can leave it blank.
alter table public.lab_submissions
  alter column github_url drop not null;

alter table public.lab_submissions
  add column if not exists submission_type text not null default 'github'
    check (submission_type in ('github', 'pdf', 'text')),
  add column if not exists pdf_path text,
  add column if not exists text_content text;

-- 2. Exactly one of (github_url, pdf_path, text_content) must be non-null.
alter table public.lab_submissions
  drop constraint if exists lab_submissions_exactly_one_source;
alter table public.lab_submissions
  add constraint lab_submissions_exactly_one_source
    check (
      (case when github_url is not null then 1 else 0 end)
      + (case when pdf_path is not null then 1 else 0 end)
      + (case when text_content is not null then 1 else 0 end)
      = 1
    );

comment on column public.lab_submissions.submission_type is
  'github | pdf | text — selects which of github_url / pdf_path / text_content the evaluator should grade.';
comment on column public.lab_submissions.pdf_path is
  'Storage path inside the lab-submissions bucket. Always {auth.uid()}/{filename}.';
comment on column public.lab_submissions.text_content is
  'Free-text written submission body. Bounded by application-layer length checks.';

-- 3. Storage bucket — private, learners write to their own folder, service
--    role reads. Idempotent: skip if the bucket already exists.
insert into storage.buckets (id, name, public, file_size_limit)
values ('lab-submissions', 'lab-submissions', false, 26214400)  -- 25MB
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Learners may upload to {userId}/...
drop policy if exists "Learners upload their own lab submissions" on storage.objects;
create policy "Learners upload their own lab submissions"
  on storage.objects for insert
  with check (
    bucket_id = 'lab-submissions'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Learners may read their own files (not strictly required — evaluator uses
-- service role — but helps debugging from the client and matches RLS-by-self).
drop policy if exists "Learners read their own lab submissions" on storage.objects;
create policy "Learners read their own lab submissions"
  on storage.objects for select
  using (
    bucket_id = 'lab-submissions'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
