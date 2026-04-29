# Phase 4 Research: Video Lesson Experience

> Research gathered inline from codebase analysis — 2026-04-28

---

## Existing Infrastructure

### Database (confirmed from migrations)

`lessons` table: `id`, `module_id`, `title`, `position`, `video_url`, `mux_playback_id`, `transcript`, `duration_seconds`
`lesson_progress` table: `id`, `user_id`, `lesson_id`, `last_position` (int, seconds), `completed` (bool), `completed_at`, `updated_at` — unique(user_id, lesson_id)

RLS on `lesson_progress`: users can SELECT/INSERT/UPDATE their own rows. Additional scoped RLS on `lessons` from Phase 3 Migration 05: only enrolled users can read lessons.

### App Structure

- Routes: `/catalog/[courseId]`, `/dashboard`, `/auth/...` — no lesson page yet
- Design system: shadcn/ui + Tailwind v4 + dark-only theme (from Phase 3 UI-SPEC)
- Pattern: Server Components for data fetching, Client Components for interactivity
- Supabase client: `@/lib/supabase/server` (server), `@/lib/supabase/client` (client)

### Seed Data

Seed has `mux_playback_id: 'PLACEHOLDER_PLAYBACK_ID_1'`. Need real Mux demo ID for video to play.
Mux public demo playback ID: `DS00Spx1CV902MCtPj5WknGlR102V5HFkDe`

---

## Technical Approach

### Mux Player

Package: `@mux/mux-player-react` — Web Component wrapper, dark-theme-able via CSS vars, built-in playback speed selector.
Install: `npm install @mux/mux-player-react`

```tsx
import MuxPlayer from '@mux/mux-player-react'

<MuxPlayer
  playbackId={lesson.mux_playback_id}
  startTime={resumePosition}  // seconds
  onTimeUpdate={handleTimeUpdate}
  onEnded={handleEnded}
  style={{ width: '100%', aspectRatio: '16/9' }}
  accentColor="#fff"
  primaryColor="#fff"
/>
```

The `onTimeUpdate` fires frequently — debounce/throttle to avoid flooding the API (every 10s is enough).

### Route Structure

Lesson page: `/app/dashboard/lesson/[lessonId]/page.tsx`
- Server Component: fetches lesson data + `lesson_progress` row for this user+lesson
- Passes `resumePosition` (from `last_position`) to client Player component
- Auth check + enrollment check (RLS handles it — if lesson select returns empty, user isn't enrolled)

### Progress Heartbeat API

`POST /api/video/progress`
- Body: `{ lessonId: string, position: number, duration: number }`
- Auth: validate session server-side via `createClient()`
- Enrollment check: `SELECT 1 FROM enrollments JOIN ... WHERE user_id = uid AND lesson enrolled` — or rely on RLS (upsert will simply fail for unenrolled users due to lesson_progress RLS + lessons RLS)
- Action: upsert `lesson_progress` (position, completed = position/duration >= 0.9, completed_at)
- Returns: 200 on success, 401 if not auth, 403 if not enrolled

### Auto-Complete Logic (90%)

In the client Player component:
```ts
const handleTimeUpdate = throttle((event) => {
  const pos = event.target.currentTime
  const dur = lesson.duration_seconds
  const pct = pos / dur
  if (pct >= 0.9 && !completed) {
    setCompleted(true)
    saveProgress(pos, dur) // fires API with final position
  } else if (/* 10s since last save */) {
    saveProgress(pos, dur)
  }
}, 5000) // throttle to every 5s max
```

### Dashboard Wiring

Dashboard (`/dashboard/page.tsx`) already queries `lesson_progress WHERE completed=true` to compute progress %. Once Phase 4 writes `completed=true` rows, the dashboard progress bar auto-updates on next load — no change needed to dashboard query.

What's needed: add lesson links on the course detail page and cohort dashboard card.

---

## Key Files to Create

| File | Purpose |
|------|---------|
| `app/dashboard/lesson/[lessonId]/page.tsx` | Lesson page — server component |
| `components/VideoPlayer.tsx` | Client component with Mux player + heartbeat |
| `app/api/video/progress/route.ts` | Progress upsert API |
| `supabase/migrations/20260428000007_seed_mux_id.sql` | Fix placeholder Mux IDs |

## Key Files to Modify

| File | Change |
|------|--------|
| `app/catalog/[courseId]/page.tsx` | Add lesson links in the course outline section |
| `app/dashboard/page.tsx` | Add "Go to Lesson" link on cohort cards |
| `package.json` | Add `@mux/mux-player-react` |

---

## Risks

1. `@mux/mux-player-react` uses a Web Component — needs `'use client'` wrapper, can't be imported in Server Components directly.
2. Mux placeholder IDs won't play — must update seed with real demo ID.
3. `onTimeUpdate` fires very frequently — must throttle to avoid rate-limit on the progress API.
4. lesson_progress RLS INSERT check only validates `auth.uid() = user_id`, not enrollment — the API route must do an explicit enrollment check to satisfy SC-5.

## Validation Architecture

- SC-1: Navigate to lesson page, Mux player renders with controls
- SC-2: Watch 40%, close, reopen — resume position matches (± 5s)
- SC-3: Reach 90% — lesson_progress row shows `completed = true`
- SC-4: Dashboard progress bar advances after lesson completion
- SC-5: POST to `/api/video/progress` without enrollment → 403
