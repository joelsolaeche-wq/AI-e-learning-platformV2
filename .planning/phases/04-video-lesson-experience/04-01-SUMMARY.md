---
phase: 4
plan: "04-01"
plan_name: "Core Lesson Page + Mux Video Player"
subsystem: "video-lesson"
tags: [mux, video, lesson-page, progress-tracking, server-component, client-component]
dependency_graph:
  requires: []
  provides: [lesson-page-route, video-player-component, progress-heartbeat-client]
  affects: [dashboard-progress-bar]
tech_stack:
  added:
    - "@mux/mux-player-react@3.13.0"
  patterns:
    - "Client Component wrapper around SSR-incompatible Web Component"
    - "Ref-based throttle (no state re-renders) for progress heartbeat"
    - "Parallel server-side data fetch (lesson + progress) with RLS enforcement"
key_files:
  created:
    - "components/VideoPlayer.tsx"
    - "app/dashboard/lesson/[lessonId]/page.tsx"
  modified:
    - "package.json"
decisions:
  - "Use ref-based throttle (lastSaveRef + Date.now()) rather than setInterval — avoids render cycles for frequent timeupdate events"
  - "completedRef boolean prevents duplicate 90%-threshold API calls when user seeks back and forward"
  - "Lesson page relies on RLS (not explicit enrollment JOIN) for access control — if lesson row is null, call notFound()"
  - "onTimeUpdate cast as EventListenerOrEventListenerObject to satisfy MuxPlayer TypeScript overload"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 4 Plan 01: Core Lesson Page + Mux Video Player Summary

Lesson page at `/dashboard/lesson/[lessonId]` with Mux-hosted video playback, throttled progress heartbeat at 90% auto-completion threshold, and RLS-gated server-side data fetching.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T1 | Install Mux player package | 5aa6e26 | package.json |
| T2 | Create VideoPlayer client component | ca7f5e8 | components/VideoPlayer.tsx |
| T3 | Create lesson page Server Component | 9a0b3d4 | app/dashboard/lesson/[lessonId]/page.tsx |

## What Was Built

**VideoPlayer.tsx** (`components/VideoPlayer.tsx`)
- `'use client'` wrapper around `<MuxPlayer>` Web Component (SSR-unsafe)
- Props: `playbackId`, `lessonId`, `resumePosition` (seconds), `duration` (seconds)
- `playbackRates={[0.75, 1, 1.25, 1.5, 2]}` — built-in Mux speed selector
- `startTime={resumePosition}` — resumes from last watched position
- `handleTimeUpdate`: throttled via `lastSaveRef` — saves at most every 10s
- 90% threshold: `completedRef` boolean prevents duplicate calls; fires API with `completed: true` immediately
- `handleEnded`: fires final save with `completed: true`
- All `fetch` calls to `/api/video/progress` wrapped in try/catch — failures are non-fatal
- `accentColor="#ffffff"` and `defaultShowRemainingTime` for premium dark-theme look

**app/dashboard/lesson/[lessonId]/page.tsx** (Server Component)
- Auth guard: `getUser()` → redirect to `/auth/login` if not authenticated
- Parallel data fetch: `lessons` row + `lesson_progress` row via `Promise.all`
- RLS enforcement: lesson row null (enrolled or not found) → `notFound()`
- `lesson.mux_playback_id` present → renders `<VideoPlayer>`; absent → "Video not available" placeholder
- Transcript section rendered conditionally when `lesson.transcript` is non-null
- `resumePosition = progress?.last_position ?? 0` (new learners start at 0)

## Verification Results

- [x] `@mux/mux-player-react` in package.json (v3.13.0)
- [x] VideoPlayer.tsx has `'use client'`, MuxPlayer import, throttle at 10s, 90% threshold, playbackRates
- [x] Lesson page fetches lesson + progress in parallel
- [x] Lesson page handles `notFound()` for unenrolled/missing lessons
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` — no errors)

## Deviations from Plan

None — plan executed exactly as written.

The `@mux/mux-player-react` package was already present in `node_modules` (from a background install that ran concurrently), but `package.json` was not updated automatically. The version entry was added manually to `package.json` with the exact installed version (3.13.0). This is equivalent to the planned task outcome.

## Known Stubs

None — the "Video not available" placeholder is an intentional conditional UI path for lessons where `mux_playback_id IS NULL`, not a data stub. The progress API route (`/api/video/progress`) is stubbed at the client call level — the VideoPlayer fires the fetch but the route does not exist yet. It will be created in plan 04-02.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: unauthenticated-api-call | components/VideoPlayer.tsx | Client fires POST /api/video/progress without checking auth state — the route handler (04-02) must validate session server-side and enforce enrollment before upserting lesson_progress |

## Self-Check: PASSED

- [x] `components/VideoPlayer.tsx` — FOUND
- [x] `app/dashboard/lesson/[lessonId]/page.tsx` — FOUND
- [x] Commit 5aa6e26 — FOUND (chore: install mux package)
- [x] Commit ca7f5e8 — FOUND (feat: VideoPlayer component)
- [x] Commit 9a0b3d4 — FOUND (feat: lesson page Server Component)
