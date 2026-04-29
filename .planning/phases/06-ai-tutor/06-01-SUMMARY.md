---
phase: 06-ai-tutor
plan: 01
subsystem: ai-tutor-backend
tags: [ai, streaming, route-handler, anthropic, supabase, rls]
dependency_graph:
  requires:
    - 05-quiz-engine (RLS + lessons table patterns)
    - supabase migrations (ai_chat_sessions, ai_chat_messages tables)
  provides:
    - POST /api/tutor/chat (streaming Route Handler)
    - ANTHROPIC_API_KEY documentation in .env.example
  affects:
    - 06-02-PLAN.md (TutorPanel client component calls this endpoint)
tech_stack:
  added:
    - ai@^4.x (Vercel AI SDK — streamText, toDataStreamResponse)
    - "@ai-sdk/anthropic@^1.x (Anthropic provider for ai SDK)"
  patterns:
    - streamText with onFinish persistence callback
    - RLS piggyback enrollment auth (same pattern as /api/quiz/submit)
    - as never cast for PostgREST 14.5 schema inference workaround
    - as unknown as T cast for query result types
key_files:
  created:
    - app/api/tutor/chat/route.ts
    - .env.example
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Used --legacy-peer-deps to resolve zod v4 vs ai@^4 peer conflict (ai uses zod@^3 internally; project source imports no zod directly)"
  - "Fixed TypeScript error from let destructuring reassignment: split into separate existingSession + session variables with if/else branch"
  - "Model claude-sonnet-4-6 per CLAUDE.md AI Integration Layer spec"
metrics:
  duration: "215 seconds (~3.5 minutes)"
  completed: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 06 Plan 01: AI Tutor Streaming Route Handler Summary

**One-liner:** Streaming POST /api/tutor/chat using Vercel AI SDK + Anthropic claude-sonnet-4-6, with lesson-transcript-grounded system prompt, RLS piggyback enrollment auth, and full message persistence to ai_chat_sessions/ai_chat_messages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install AI SDK packages and document ANTHROPIC_API_KEY | a2e5bf5 | package.json, package-lock.json, .env.example |
| 2 | Create POST /api/tutor/chat streaming Route Handler | 1895a53 | app/api/tutor/chat/route.ts |

## What Was Built

### POST /api/tutor/chat

A streaming Next.js 15 App Router Route Handler that:

1. **Auth gate (401):** `supabase.auth.getUser()` — no valid session returns 401
2. **Input validation (400):** UUID regex on `lessonId`, presence/type check on `message`, 2000-char cap (T-6-03 prompt injection protection)
3. **Enrollment auth (403):** RLS piggyback on lessons table — null result → lesson not in a published course → 403
4. **Session management:** SELECT then INSERT for ai_chat_sessions `(user_id, lesson_id)` — creates automatically on first message
5. **History loading:** Last 20 messages from ai_chat_messages for conversation context
6. **User message persistence:** Saved BEFORE streamText call (preserved even on stream failure)
7. **System prompt:** Server-side only — injects lesson title + transcript (T-6-01: transcript never in response body or client)
8. **Off-topic refusal:** Guardrail in system prompt instructs Claude to redirect off-scope questions back to lesson
9. **Streaming:** `streamText` with `anthropic('claude-sonnet-4-6')`, returns `result.toDataStreamResponse()` for useChat compatibility
10. **Assistant message persistence:** `onFinish` callback saves assistant response after stream completes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zod v4 vs ai@^4 peer dependency conflict**
- **Found during:** Task 1 npm install
- **Issue:** `ai@^4.x` requires `zod@^3.23.8` as a peer dependency; project has `zod@^4.3.6`. Standard npm install fails with ERESOLVE.
- **Fix:** Used `--legacy-peer-deps` flag. The ai SDK uses zod internally for its own schema types — these are not exposed to our route handler code. Project source files have zero `import from 'zod'` statements, so the zod v4 in the project tree is independent. Runtime works correctly: both zod versions coexist in node_modules.
- **Files modified:** package.json, package-lock.json
- **Commit:** a2e5bf5

**2. [Rule 1 - Bug] TypeScript error: SessionRow reassignment incompatible type**
- **Found during:** Task 2 `npx tsc --noEmit`
- **Issue:** `let { data: sessionData } = await supabase.from(...).maybeSingle()` infers sessionData as a Supabase internal type. Reassigning `sessionData = newSession as unknown as SessionRow` caused TS2322 — "Type 'SessionRow' is not assignable to type 'null'".
- **Fix:** Restructured session find-or-create to use separate `existingSession` and `session` variables with an if/else branch: `if (existingSession) { session = existingSession as unknown as SessionRow } else { ... session = newSession as unknown as SessionRow }`.
- **Files modified:** app/api/tutor/chat/route.ts
- **Commit:** 1895a53

## Threat Surface Scan

No new threat surface beyond what the plan's threat model documented. All T-6-01 through T-6-04 mitigations implemented as specified. T-6-04 (rate limiting) accepted as known gap per plan.

## Known Stubs

None. The route handler is fully functional with no placeholder data.

## Self-Check

Files created/modified:
- [x] app/api/tutor/chat/route.ts exists
- [x] .env.example exists with ANTHROPIC_API_KEY=
- [x] package.json contains "ai" and "@ai-sdk/anthropic"

Commits:
- [x] a2e5bf5 exists (Task 1)
- [x] 1895a53 exists (Task 2)

## Self-Check: PASSED
