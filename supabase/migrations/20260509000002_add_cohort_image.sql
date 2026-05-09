-- Optional cover image for cohort cards. Falls back to a deterministic
-- gradient symbol when null (existing learner-home behavior). URL-only for
-- now; file uploads can come later via a dedicated cohort-images bucket.

alter table public.cohorts
  add column if not exists image_url text;

comment on column public.cohorts.image_url is
  'Optional cover image for the cohort card. URL-only; falls back to a deterministic gradient when null.';
