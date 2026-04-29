---
phase: 06-ai-tutor
verified: 2026-04-29T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (2 require human confirmation for runtime behavior)
overrides_applied: 0
gaps:
human_verification:
  - test: "Streaming latency — submit a question and verify first tokens appear within 2 seconds"
    expected: "AI response begins streaming character-by-character (token-by-token) within under 2 seconds of submit; no blank waiting period followed by a batch response"
    why_human: "Cannot invoke the live Anthropic API or start the dev server programmatically in this environment; timing behavior requires a real network call"
  - test: "Transcript grounding — ask 'What did the instructor mean by [concept from transcript]?' and verify the response cites lesson content"
    expected: "AI tutor response paraphrases or quotes specific content from the lesson transcript rather than answering from generic LLM knowledge only"
    why_human: "Grounding quality is a semantic/behavioral property that cannot be verified by static code analysis; requires a live call with real transcript data"
  - test: "Out-of-scope refusal — ask 'What is the weather in Paris?' and verify the tutor refuses with a redirect to lesson content"
    expected: "AI tutor responds with the configured refusal message ('I'm here to help with the lesson on...') rather than answering the off-topic question"
    why_human: "System prompt guardrail behavior requires a live Anthropic API call to confirm Claude follows the instruction"
  - test: "History persistence — send 2-3 messages, close the lesson tab, reopen it, open TutorPanel; verify prior messages appear"
    expected: "Full prior conversation history for that lesson loads on panel open; messages appear in chronological order"
    why_human: "Requires a live authenticated session with a Supabase DB, browser navigation, and visual inspection; also needed to confirm WR-03 (missing createdAt) does not cause visible ordering bugs"
  - test: "Race condition risk (CR-01) — verify normal single-user demo flow does not create duplicate sessions"
    expected: "One session row per (user_id, lesson_id) created; no 500 errors after first message exchange"
    why_human: "The ai_chat_sessions table has no UNIQUE(user_id, lesson_id) constraint. Under normal single-tab demo use this should not trigger, but human confirmation is needed that the demo path works end-to-end without hitting the race condition edge case"
---

# Phase 6: AI Tutor Verification Report

**Phase Goal:** An enrolled user watching a lesson can open a persistent AI chat panel, ask questions grounded in the lesson transcript, receive streaming responses, and have the conversation persist across sessions — with graceful refusal for out-of-scope questions.
**Verified:** 2026-04-29T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open an AI chat panel during a lesson without leaving the page | VERIFIED | `TutorPanel` exported from `components/TutorPanel.tsx`; rendered at bottom of lesson page JSX (`app/dashboard/lesson/[lessonId]/page.tsx:182`); `isOpen` state toggle with "Ask AI Tutor" button (line 47) opens inline panel |
| 2 | AI tutor responses stream in real time | VERIFIED (code) + HUMAN NEEDED (runtime) | `streamText` from `ai` (line 164), `result.toDataStreamResponse()` (line 186) in route.ts; `useChat` from `ai/react` (TutorPanel line 4); "Thinking..." indicator during `isLoading`; timing confirmation requires live API call |
| 3 | AI tutor is grounded in the lesson transcript | VERIFIED (code) + HUMAN NEEDED (quality) | `lessonRow.transcript` injected into `systemPrompt` server-side (route.ts lines 132-147); transcript never returned to client; system prompt instructs Claude to use transcript as primary source; quality requires live call |
| 4 | Chat history persists across sessions | VERIFIED (code) + WARNING (CR-01, WR-03) | 4th Promise.all slot in lesson page fetches `ai_chat_sessions` then `ai_chat_messages` for `(user_id, lesson_id)` (page.tsx lines 87-107); `initialMessages` mapped and passed to `useChat` (page.tsx lines 133-137, 182); WARNING: missing `createdAt` in mapping (WR-03) may cause ordering issues |
| 5 | AI tutor gracefully declines out-of-scope questions | VERIFIED (code) + HUMAN NEEDED (runtime) | System prompt contains explicit refusal instruction with example redirect message (route.ts lines 143-145); requires live Anthropic API call to confirm guardrail is followed |

**Score:** 5/5 truths verified at code level. Runtime behaviors (SC-2, SC-3, SC-5) and persistence end-to-end (SC-4) require human confirmation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/tutor/chat/route.ts` | Streaming POST Route Handler for AI tutor | VERIFIED | 188 lines; exports `POST`; substantive implementation with auth, enrollment auth via RLS, session management, history loading, user message persistence, system prompt with transcript, streamText call, onFinish persistence |
| `.env.example` | ANTHROPIC_API_KEY documented | VERIFIED | Line 15: `ANTHROPIC_API_KEY=` with comment |
| `components/TutorPanel.tsx` | Client component — AI tutor chat panel with streaming useChat hook | VERIFIED | 136 lines; 'use client'; useChat from ai/react; streaming display; open/close toggle; initialMessages prop; disabled states; auto-scroll |
| `app/dashboard/lesson/[lessonId]/page.tsx` | Lesson page extended with TutorPanel and chat history server fetch | VERIFIED | Imports TutorPanel + Message; 4-slot Promise.all; ChatMessageRow type; initialMessages derived; TutorPanel rendered at JSX line 182 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/tutor/chat/route.ts` | Anthropic claude-sonnet-4-6 | `streamText` from `ai`, `createAnthropic` from `@ai-sdk/anthropic` | WIRED | Lines 3-4 imports; line 165 `model: anthropic('claude-sonnet-4-6')`; line 186 `result.toDataStreamResponse()` |
| `app/api/tutor/chat/route.ts` | `public.ai_chat_sessions` + `public.ai_chat_messages` | supabase insert | WIRED | Session SELECT at line 70; session INSERT at line 87; user message INSERT at line 119; assistant message INSERT in onFinish at line 174 |
| `app/api/tutor/chat/route.ts` | `public.lessons` (transcript) | supabase select transcript | WIRED | Line 50: `.select('id, title, transcript')`; transcript injected into system prompt at lines 132-147 |
| `components/TutorPanel.tsx` | `app/api/tutor/chat/route.ts` | `useChat({ api: '/api/tutor/chat', body: { lessonId } })` | WIRED | Lines 26-30; `api: '/api/tutor/chat'` targets the route handler; `body: { lessonId }` sends lesson context with every request |
| `app/dashboard/lesson/[lessonId]/page.tsx` | `components/TutorPanel.tsx` | import + JSX render with initialMessages + lessonId props | WIRED | Line 8 import; line 182 JSX: `<TutorPanel lessonId={lesson.id} initialMessages={initialMessages} />` |
| `app/dashboard/lesson/[lessonId]/page.tsx` | `public.ai_chat_sessions` + `public.ai_chat_messages` | supabase select in 4th Promise.all slot | WIRED | Lines 87-107: async IIFE fetches session then messages; result mapped to Message[] at lines 132-137 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `components/TutorPanel.tsx` | `messages` (chat messages) | `useChat` hook → POST `/api/tutor/chat` → `streamText` → Anthropic API; `initialMessages` from server-side DB fetch | Yes — route.ts fetches from `ai_chat_messages` via Supabase; new messages stream from Anthropic | FLOWING |
| `app/dashboard/lesson/[lessonId]/page.tsx` | `initialMessages` | `ai_chat_sessions` → `ai_chat_messages` DB fetch in 4th Promise.all slot | Yes — two-step DB query; returns `[]` on first visit (correct), real rows on subsequent visits | FLOWING |
| `app/api/tutor/chat/route.ts` | `lessonRow.transcript` | `lessons` table supabase select | Yes — `.select('id, title, transcript')` queries DB; transcript injected into systemPrompt | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running dev server with live Anthropic API key and authenticated Supabase session. No runnable entry points testable without external services.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AI-01 | 06-02-PLAN | User can open an AI chat panel during a lesson | SATISFIED | TutorPanel component wired to lesson page; "Ask AI Tutor" button opens inline panel |
| AI-02 | 06-01-PLAN, 06-02-PLAN | AI tutor responses stream in real time | SATISFIED (code) | `streamText` + `toDataStreamResponse()` + `useChat`; runtime confirmation human-needed |
| AI-03 | 06-01-PLAN | AI tutor is grounded in the lesson transcript | SATISFIED (code) | Transcript fetched server-side, injected in system prompt, never sent to client |
| AI-04 | 06-02-PLAN | Chat history persists across sessions | SATISFIED (code) | Session find-or-create + message persistence + 4th Promise.all history fetch + initialMessages |
| AI-05 | 06-01-PLAN | AI tutor gracefully declines out-of-scope questions | SATISFIED (code) | System prompt guardrail with explicit redirect instruction |

All 5 AI requirement IDs from phase 6 (AI-01 through AI-05) are covered. All 5 are mapped to Phase 6 in the REQUIREMENTS.md traceability table.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/tutor/chat/route.ts` | 69-97 | SELECT-then-INSERT session pattern with no UNIQUE constraint on `ai_chat_sessions(user_id, lesson_id)` | WARNING | Race condition under concurrent requests (two browser tabs, rapid retries) can create duplicate session rows. Subsequent `.maybeSingle()` on two rows returns a PostgREST error, causing HTTP 500 for all future chat messages for that user+lesson. Not demo-blocking for single-tab use. CR-01 from 06-REVIEW.md. |
| `app/dashboard/lesson/[lessonId]/page.tsx` | 133-137 | `initialMessages` mapping omits `createdAt: new Date(m.created_at)` | WARNING | Vercel AI SDK v4 Message type includes `createdAt: Date`. Restored messages have `createdAt: undefined` while new streaming messages have `createdAt: Date`. May cause message ordering issues on session reload. WR-03 from 06-REVIEW.md. |
| `app/api/tutor/chat/route.ts` | 20, 27 | `sessionId` extracted from body but never used; dead code implying client-controlled session routing | INFO | Confusing dead code. `sessionId` is always `undefined` because useChat does not send it. No security impact since session is correctly looked up by `(user.id, lessonId)`. WR-04 from 06-REVIEW.md. |
| `app/api/tutor/chat/route.ts` | 151-154 | `role` cast from DB history without runtime validation | INFO | DB CHECK constraint prevents invalid values, but defensive filtering (`filter m.role === 'user' || m.role === 'assistant'`) would be more robust. WR-01 from 06-REVIEW.md. |

**Note on 06-REVIEW.md CR-02 finding:** The code review claimed enrollment authorization relied only on `is_published` flag. This is INCORRECT. Migration `20260428000005_lesson_rls_status_fix.sql` applies an enrollment-scoped SELECT policy to the `lessons` table requiring an active enrollment via `enrollments → cohorts → modules → lessons.module_id`. The RLS piggyback authorization in `route.ts` is correctly grounded in enrollment, not just publication status. CR-02 from the code review is a false positive.

---

### Human Verification Required

#### 1. Streaming latency confirmation

**Test:** Sign in as an enrolled user, navigate to a lesson page, click "Ask AI Tutor", type a question, submit.
**Expected:** The first AI response tokens appear within under 2 seconds. The response appears incrementally (token-by-token), not as a single batch after a pause.
**Why human:** Requires live Anthropic API call and dev server. Timing is a runtime property not verifiable statically.

#### 2. Transcript grounding quality

**Test:** Sign in as an enrolled user, open a lesson that has a transcript, ask "What did the instructor mean by [specific concept mentioned in the transcript]?"
**Expected:** The AI tutor's response references or paraphrases specific content from the lesson transcript, not generic LLM knowledge alone. The answer should feel grounded in the lesson material.
**Why human:** Semantic quality of transcript grounding requires live API call and judgment about answer relevance to lesson content.

#### 3. Out-of-scope refusal behavior

**Test:** In the TutorPanel, ask "What is the weather in Paris?" or "Write me a haiku."
**Expected:** The AI tutor responds with a polite refusal redirecting to lesson content — specifically the configured message: "I'm here to help with the lesson on [title]. Could you ask me something related to the lesson content?" No off-topic answer is returned.
**Why human:** System prompt guardrail compliance requires live Anthropic API call.

#### 4. History persistence across page reload

**Test:** Send 2-3 messages in the TutorPanel. Close the lesson tab. Reopen the lesson URL. Click "Ask AI Tutor".
**Expected:** All prior messages appear in the panel in correct chronological order when reopened. The conversation continues seamlessly.
**Why human:** Requires live authenticated Supabase session + browser navigation. Also confirms whether the missing `createdAt` mapping (WR-03) causes any visible ordering bug.

#### 5. Single-user race condition safety (CR-01)

**Test:** Navigate to a lesson page as an enrolled user and send one message through the TutorPanel. Then refresh and send another message.
**Expected:** No 500 errors. Only one `ai_chat_sessions` row exists for that `(user_id, lesson_id)` pair (verifiable via Supabase table editor). Chat works correctly across both requests.
**Why human:** The missing UNIQUE constraint means a race condition is theoretically possible. For the single-tab demo path, this should not trigger — but human verification of the normal flow is needed to confirm the demo is safe.

---

### Gaps Summary

No blocking gaps were found that prevent the phase goal from being achieved under normal single-user demo conditions.

Two warnings exist that do not block the goal but should be addressed before production or under concurrent load:

1. **CR-01 (WARNING):** `ai_chat_sessions` table has no `UNIQUE(user_id, lesson_id)` constraint. The SELECT-then-INSERT pattern in `route.ts` has a race condition under concurrent requests. Fix: add a migration with `alter table public.ai_chat_sessions add constraint ai_chat_sessions_user_lesson_unique unique (user_id, lesson_id)` and replace the SELECT-then-INSERT with an upsert.

2. **WR-03 (WARNING):** `initialMessages` mapping in `page.tsx` omits the `createdAt` field. Fix: add `created_at` to the `ai_chat_messages` select and map it as `createdAt: new Date(m.created_at)` in the Message object.

Three items require human verification (streaming latency, transcript grounding quality, and out-of-scope refusal) because they are runtime behaviors that cannot be confirmed by static code analysis.

---

_Verified: 2026-04-29T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
