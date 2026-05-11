-- Add structured transcript segments alongside the existing flat `transcript`
-- text column. The flat text continues to feed Synapse's system prompt
-- (preserving tutor behavior); segments are display-only and power the
-- paragraph-grouped, timestamp-linked transcript UI in LessonExperience.
--
-- Shape: jsonb array of { start: number (seconds), text: string }.

alter table public.lessons
  add column if not exists transcript_segments jsonb;

comment on column public.lessons.transcript_segments is
  'Array of { start: number (seconds), text: string } from YouTube captions. Display-only; the flat `transcript` column still feeds the AI tutor system prompt.';
