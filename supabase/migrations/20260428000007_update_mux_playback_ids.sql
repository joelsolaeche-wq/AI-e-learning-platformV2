-- ============================================================
-- Migration: 20260428000007_update_mux_playback_ids
-- Phase 4: Replace placeholder Mux IDs with real demo playback IDs
--
-- Uses Mux's public test asset so video plays without a Mux account.
-- Playback ID: DS00Spx1CV902MCtPj5WknGlR102V5HFkDe
-- This is Mux's official demo asset — available publicly, no auth needed.
--
-- Also sets duration_seconds = 600 (10 minutes) as a reasonable demo value
-- for the 90% completion threshold to work correctly in the player.
--
-- Idempotent: updates 0 rows harmlessly if PLACEHOLDER rows are absent
-- (e.g., if this migration is run after a fresh db reset that re-seeds).
-- ============================================================

update public.lessons
set
  mux_playback_id = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
  video_url       = 'https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8',
  duration_seconds = 600
where mux_playback_id like 'PLACEHOLDER%';
