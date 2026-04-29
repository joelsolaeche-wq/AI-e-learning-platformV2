---
phase: 06-ai-tutor
plan: 02
subsystem: ai-tutor-frontend
tags: [ai, streaming, useChat, client-component, lesson-page, history-persistence]
dependency_graph:
  requires:
    - 06-01 (POST /api/tutor/chat streaming Route Handler)
    - 05-quiz-engine (QuizSection pattern, lesson page structure)
    - supabase migrations (ai_chat_sessions, ai_chat_messages tables)
  provides:
    - components/TutorPanel.tsx (collapsible streaming chat panel client component)
    - app/dashboard/lesson/[lessonId]/page.tsx (TutorPanel wired with chat history hydration)
  affects:
    - Lesson page layout (TutorPanel renders below quiz section)
tech_stack:
  added:
    - "ai/react useChat hook (streaming chat client from ai@^4.x installed in Plan 01)"
    - "Message type from 'ai' (used for initialMessages prop typing)"
  patterns:
    - useChat with initialMessages for server-side history hydration
    - async IIFE in Promise.all for multi-step dependent fetch in single slot
    - as unknown as T cast for Supabase PostgREST 14.5 schema inference workaround
    - whitespace-pre-wrap for safe plain-text message rendering (T-6-05)
key_files:
  created:
    - components/TutorPanel.tsx
  modified:
    - app/dashboard/lesson/[lessonId]/page.tsx
decisions:
  - "async IIFE in 4th Promise.all slot for two-step chat history fetch (session → messages) — avoids Supabase join limitation with RLS-gated foreign table"
  - "TutorPanel starts collapsed (isOpen=false) — user explicitly clicks 'Ask AI Tutor' to open, preventing layout shift on page load"
  - "npm install --legacy-peer-deps required in worktree (packages in package.json but not yet installed in worktree node_modules)"
metrics:
  duration: "186 seconds (~3 minutes)"
  completed: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 06 Plan 02: TutorPanel Client Component + Lesson Page Integration Summary

**One-liner:** TutorPanel.tsx client component using useChat from ai/react with streaming display, open/close toggle, and server-side chat history hydration via 4th Promise.all slot in the lesson page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create TutorPanel client component | 207dff5 | components/TutorPanel.tsx |
| 2 | Extend lesson page with chat history fetch and TutorPanel render | 10d14b1 | app/dashboard/lesson/[lessonId]/page.tsx |

## What Was Built

### TutorPanel Client Component (`components/TutorPanel.tsx`)

A 'use client' React component that provides the user-facing AI tutor interface:

1. **Collapsible layout:** Starts collapsed with an "Ask AI Tutor" button. Click to expand the full chat panel; "Close" button to collapse.
2. **Streaming chat via useChat:** `useChat({ api: '/api/tutor/chat', body: { lessonId }, initialMessages })` — lessonId sent with every request so the Route Handler can auth and ground the system prompt.
3. **Message bubbles:** User messages right-aligned with `bg-primary text-primary-foreground`; assistant messages left-aligned with `bg-muted text-foreground`.
4. **Safe text rendering:** `whitespace-pre-wrap` on all message content (T-6-05 — no `dangerouslySetInnerHTML`).
5. **Loading states:** Textarea and Submit button disabled while `isLoading` is true. "Thinking..." indicator shown while streaming.
6. **Auto-scroll:** `useEffect` on `messages` array scrolls `bottomRef` into view after each token.
7. **History hydration:** `initialMessages` prop pre-populates the `useChat` hook so prior conversation loads on mount.
8. **Empty state:** "Ask a question about this lesson" placeholder when no messages exist.

### Lesson Page Extension (`app/dashboard/lesson/[lessonId]/page.tsx`)

Extended the existing 3-slot Promise.all to 4 slots:

1. **New `ChatMessageRow` type alias** for ai_chat_messages shape.
2. **4th Promise.all slot:** async IIFE that fetches `ai_chat_sessions` for `(user_id, lesson_id)` — if no session exists returns `[]` (first visit). If session found, fetches up to 20 `ai_chat_messages` ordered by `created_at` ascending.
3. **`initialMessages` derivation:** Maps `ChatMessageRow[]` to `Message[]` (Vercel AI SDK type) via `role as 'user' | 'assistant'` cast.
4. **TutorPanel render:** `<TutorPanel lessonId={lesson.id} initialMessages={initialMessages} />` appended as last element in the `space-y-6` main layout (after quiz section).

**JSX order in `<main>`:**
1. `<header>` (lesson title)
2. Video div (MuxPlayer or fallback)
3. Transcript section (conditional)
4. Separator + QuizSection (conditional)
5. `<TutorPanel lessonId={lesson.id} initialMessages={initialMessages} />`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AI SDK packages not installed in worktree node_modules**
- **Found during:** Task 1 `npx tsc --noEmit`
- **Issue:** `ai@^4.x` and `@ai-sdk/anthropic@^1.x` are listed in `package.json` (added in Plan 01) but `node_modules` in this worktree did not have them installed. TypeScript reported `Cannot find module 'ai'` and `Cannot find module 'ai/react'`.
- **Fix:** Ran `npm install --legacy-peer-deps` (same flag used in Plan 01 for zod v4 peer conflict) in the worktree directory.
- **Files modified:** None — node_modules populated, package.json and package-lock.json unchanged.
- **Outcome:** `npx tsc --noEmit` exits 0 after install.

## Threat Surface Scan

No new threat surface beyond the plan's threat model. All T-6-01 through T-6-05 mitigations implemented:
- T-6-01: Transcript not in TutorPanel props or client component — only passes `lessonId` and `initialMessages` (role/content only)
- T-6-02: Enrollment enforced in Route Handler (Plan 01); lesson page chat history fetch scoped to `(user.id, lessonId)` + RLS on `ai_chat_sessions`
- T-6-03: Message content rendered as plain text with `whitespace-pre-wrap`, no HTML parsing
- T-6-04: Rate limiting accepted as known gap (same as Plan 01)
- T-6-05: `initialMessages` contains only `(id, role, content)` — no secrets — rendered as plain text

## Known Stubs

None. TutorPanel is fully functional with real data wired. `initialMessages` comes from the database via the 4th Promise.all slot, not mock data.

## Self-Check

Files created/modified:
- [x] components/TutorPanel.tsx exists
- [x] app/dashboard/lesson/[lessonId]/page.tsx imports TutorPanel and Message
- [x] Lesson page Promise.all has 4 slots (chatHistoryResult is 4th)
- [x] TutorPanel rendered in JSX with lessonId and initialMessages props

Commits:
- [x] 207dff5 exists (Task 1)
- [x] 10d14b1 exists (Task 2)

TypeScript:
- [x] npx tsc --noEmit exits 0

Acceptance criteria:
- [x] 'use client' first line in TutorPanel.tsx
- [x] useChat from 'ai/react'
- [x] initialMessages in props interface and useChat call (3 occurrences)
- [x] whitespace-pre-wrap on message content
- [x] handleSubmit wired to form onSubmit
- [x] isLoading disables textarea and submit button
- [x] no dangerouslySetInnerHTML in TutorPanel.tsx (0 occurrences)
- [x] TutorPanel exported as named export
- [x] Lesson page imports TutorPanel from '@/components/TutorPanel' (4 references)
- [x] Message type imported from 'ai'
- [x] ChatMessageRow type alias present
- [x] 4th Promise.all slot fetches ai_chat_sessions then ai_chat_messages
- [x] initialMessages: Message[] derived from chatHistoryResult
- [x] JSX contains TutorPanel lessonId={lesson.id} initialMessages={initialMessages}
- [x] No 'as any' in lesson page (only 'as unknown as T' pattern)

## Self-Check: PASSED
