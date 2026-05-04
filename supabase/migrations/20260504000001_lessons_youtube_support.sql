-- ============================================================
-- Migration: 20260504000001_lessons_youtube_support
-- Adds YouTube as a second video source for lessons.
-- Existing rows default to 'mux' — no change to current playback.
-- ============================================================

alter table public.lessons
  add column if not exists youtube_id text,
  add column if not exists video_source text not null default 'mux';

-- Constrain to known values. Done as a separate alter so re-running on
-- a DB that already has the column without the check still applies it.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_video_source_check'
  ) then
    alter table public.lessons
      add constraint lessons_video_source_check
      check (video_source in ('mux', 'youtube'));
  end if;
end $$;
