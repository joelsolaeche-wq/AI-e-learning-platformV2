---
phase: 4
plan: "04-02"
subsystem: "video-lesson-experience"
tags: [api, progress-tracking, mux, rls, enrollment-guard]
dependency_graph:
  requires: [supabase/migrations/20260428000004_lesson_enrollment_rls.sql, lib/supabase/server.ts, lib/database.types.ts]
  provides: [app/api/video/progress/route.ts, supabase/migrations/20260428000007_update_mux_playback_ids.sql]
  affects: [lesson_progress table, lessons table (mux_playback_id)]
tech_stack:
  added: []
  patterns: [Next.js Route Handler, Supabase server client, TablesInsert cast, as-unknown-as type workaround]
key_files:
  created:
    - app/api/video/progress/route.ts
    - supabase/migrations/20260428000007_update_mux_playback_ids.sql
  modified: []
decisions:
  - "Use lessons RLS as enrollment gate in the progress API (SELECT on lessons returns null for unenrolled users via migration 00004); avoids duplicating the enrollment join logic in the route handler"
  - "Apply as-unknown-as cast for lesson query return type — PostgREST 14.5 schema inference bug (consistent with enrollment.actions.ts pattern)"
  - "Apply TablesInsert<'lesson_progress'> + as-never cast for upsert — same PostgREST 14.5 workaround"
  - "completed_at set to null (not omitted) when isCompleted is false — keeps the upsert type clean with TablesInsert"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-28"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 02: Progress Heartbeat API + Enrollment Guard Summary

POST /api/video/progress Route Handler with RLS-based enrollment guard, 90% auto-completion threshold, and Mux demo playback ID migration replacing PLACEHOLDER rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 04-02-T1 | Create progress API route handler | 157f7b5 | app/api/video/progress/route.ts |
| 04-02-T2 | Migration to set real Mux demo playback IDs | a67a0cc | supabase/migrations/20260428000007_update_mux_playback_ids.sql |

## What Was Built

### POST /api/video/progress (Task 1)

Route handler at `app/api/video/progress/route.ts` implementing:

1. **401 guard** — `supabase.auth.getUser()` returns null for unauthenticated requests
2. **Input validation** — Requires `lessonId` (string) and `position` (non-negative number); validates JSON parse
3. **403 enrollment guard** — Queries `lessons` table with `.maybeSingle()`; RLS from migration 00004 restricts SELECT to enrolled users only. Null result = unenrolled or lesson not found, both return 403
4. **90% threshold** — `pct = position / effectiveDuration; isCompleted = completed === true || pct >= 0.9`. Uses body `duration` if provided, falls back to `lesson.duration_seconds` from DB
5. **Upsert** — `lesson_progress` with `onConflict: 'user_id,lesson_id'` — idempotent heartbeat calls work correctly
6. **Response** — `{ ok: true, completed: boolean }` on success, proper error codes otherwise

### Migration 20260428000007_update_mux_playback_ids.sql (Task 2)

Updates all lessons where `mux_playback_id LIKE 'PLACEHOLDER%'`:
- Sets `mux_playback_id = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe'` (Mux public demo asset)
- Sets `video_url = 'https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8'`
- Sets `duration_seconds = 600` (10 minutes — correct scale for 90% threshold demo)
- Idempotent: updates 0 rows harmlessly if run after a DB reset re-applies seed data

**Action required:** This migration needs to be applied to the remote Supabase instance via `npx supabase db push` or pasting SQL into the Supabase SQL editor. Without it, video playback will show Mux errors on the lesson page (built in plan 04-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Applied PostgREST 14.5 type cast on lesson query**
- **Found during:** Task 1 — `npx tsc --noEmit` reported `Property 'duration_seconds' does not exist on type 'never'`
- **Issue:** PostgREST 14.5 / Supabase v2.105.x schema inference infers `never` for the lessons query result, same as the established bug affecting `enrollment.actions.ts`
- **Fix:** Added `type LessonRow` inline and applied `as unknown as LessonRow | null` cast — identical pattern to `enrollment.actions.ts` line 56
- **Files modified:** app/api/video/progress/route.ts
- **Commit:** 157f7b5

**2. [Rule 1 - Bug] Applied TablesInsert cast on lesson_progress upsert**
- **Found during:** Task 1 — `npx tsc --noEmit` reported upsert argument not assignable to type `never`
- **Issue:** Same PostgREST 14.5 inference bug on the upsert call
- **Fix:** Used `TablesInsert<'lesson_progress'>` type annotation + `as never` cast — identical to `enrollmentRow as never` in `enrollment.actions.ts` line 90
- **Files modified:** app/api/video/progress/route.ts
- **Commit:** 157f7b5

## Known Stubs

None — both deliverables are fully wired. The progress API writes real data to `lesson_progress`. The migration updates real DB rows.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: enrollment-bypass | app/api/video/progress/route.ts | Enrollment guard relies on RLS-enforced lessons SELECT. If lessons RLS is misconfigured (e.g., migration 00004 not applied), unenrolled users could write lesson_progress rows for arbitrary lessons. The `lesson_progress` RLS INSERT policy only checks `user_id = auth.uid()` — it does not re-check enrollment. Both migration 00004 (lessons RLS) and this route handler must be active for the guard to hold. |

## Self-Check

**Files exist:**
- FOUND: app/api/video/progress/route.ts
- FOUND: supabase/migrations/20260428000007_update_mux_playback_ids.sql

**Commits exist:**
- FOUND: 157f7b5 (feat(04-02): create POST /api/video/progress route handler)
- FOUND: a67a0cc (chore(04-02): migration to replace placeholder Mux IDs with real demo asset)

**TypeScript:** Clean compile (0 errors)

## Self-Check: PASSED
