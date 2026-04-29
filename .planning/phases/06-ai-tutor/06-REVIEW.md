---
phase: 06-ai-tutor
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - app/api/tutor/chat/route.ts
  - components/TutorPanel.tsx
  - app/dashboard/lesson/[lessonId]/page.tsx
  - package.json
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The AI Tutor implementation covers the expected surface area: a streaming Route Handler (`app/api/tutor/chat/route.ts`), a client-side panel component (`components/TutorPanel.tsx`), and an updated lesson page that loads chat history for `initialMessages`. The transcript is correctly kept server-side, `dangerouslySetInnerHTML` is absent, and `toDataStreamResponse()` is used correctly.

Two blockers are present. First, the `ai_chat_sessions` table has no `UNIQUE (user_id, lesson_id)` constraint, which means the select-then-insert session logic in the Route Handler has a race condition that creates duplicate sessions; once duplicates exist the `.maybeSingle()` call throws instead of returning a row, breaking the entire chat flow. Second, the `useChat` hook sends the full conversation history in the request body alongside the new message; the Route Handler ignores that client-supplied history entirely and re-fetches from the database, but it still uses only the latest `message` field from the body and discards the client `messages` array — this is actually correct and secure, but the mismatch means the `sessionId` field the client sends is also silently ignored even though the client was designed to pass it.

Four warnings cover: enrollment authorization relying solely on lessons RLS (which only requires `is_published`, not actual enrollment), a prompt-injection vector from an unvalidated `role` field in chat history, the `onFinish` error being swallowed silently without surfacing to the client, and a missing `createdAt` field in the `initialMessages` mapping that can cause Vercel AI SDK hydration issues.

---

## Critical Issues

### CR-01: Race condition — duplicate `ai_chat_sessions` rows crash subsequent requests

**File:** `app/api/tutor/chat/route.ts:69-97`

**Issue:** The Route Handler uses a SELECT-then-INSERT pattern to find-or-create a chat session for `(user_id, lesson_id)`. The `ai_chat_sessions` table in the migration (`20260428000002_create_remaining_tables.sql:142-148`) has **no** `UNIQUE (user_id, lesson_id)` constraint. Under concurrent requests (e.g., rapid double-tap, two browser tabs, retry logic), two requests can both observe `existingSession = null` and both INSERT successfully, creating two sessions with the same `(user_id, lesson_id)` pair.

On the very next request the SELECT runs against two matching rows and `.maybeSingle()` returns a PostgREST `PGRST116` error ("Results contain 0 rows" is not the risk here — "more than one row" is). The Supabase JS client surfaces this as `sessionSelectError !== null`, causing the Route Handler to return HTTP 500 for all subsequent chat messages for that user+lesson combination. The entire tutor feature is permanently broken for affected users until the duplicate row is manually deleted.

**Fix — two-part:**

1. Add a unique constraint in a new migration:
```sql
-- supabase/migrations/20260429000001_ai_chat_sessions_unique.sql
alter table public.ai_chat_sessions
  add constraint ai_chat_sessions_user_lesson_unique
  unique (user_id, lesson_id);
```

2. Replace the SELECT-then-INSERT pattern with an upsert that leverages the constraint:
```typescript
// app/api/tutor/chat/route.ts  — replace lines 69-97
const { data: session, error: sessionUpsertError } = await supabase
  .from('ai_chat_sessions')
  .upsert(
    { user_id: user.id, lesson_id: lessonId },
    { onConflict: 'user_id,lesson_id', ignoreDuplicates: false }
  )
  .select('id')
  .single()

if (sessionUpsertError || !session) {
  console.error('[tutor chat] session upsert error', sessionUpsertError)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
```

---

### CR-02: Enrollment authorization relies on `is_published` flag, not actual enrollment

**File:** `app/api/tutor/chat/route.ts:43-61`

**Issue:** The authorization comment at line 43 claims "RLS on lessons requires the lesson to exist in a published course and user to be authenticated." This is accurate for the migration-02 lessons policy — but it means **any authenticated user can use the AI tutor for any published lesson**, regardless of whether they are enrolled in a cohort that covers that lesson.

The `quiz_definitions` table was tightened in migration 08 with an enrollment-scoped policy. The `lessons` table was never tightened in the same way (migrations 03-07 show enrollment RLS was applied to other tables but not to a "lessons for enrolled users only" gate). A user who was never enrolled in any cohort can authenticate, discover a valid lesson UUID, and consume unlimited AI tutor calls against it.

The comment "T-6-02: Enrollment authorization via RLS piggyback on lessons table" is factually misleading — the lessons RLS enforces publication state, not enrollment.

**Fix:** Add an explicit enrollment check before calling the AI model:

```typescript
// app/api/tutor/chat/route.ts — insert after lesson fetch (after line 61)
const { data: enrollment } = await supabase
  .from('enrollments')
  .select('id')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .in(
    'cohort_id',
    supabase
      .from('cohorts')
      .select('id')
      .in(
        'course_id',
        supabase
          .from('modules')
          .select('course_id')
          .eq('id', lessonRow.module_id) // requires module_id in LessonRow select
      )
  )
  .maybeSingle()

if (!enrollment) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

Alternatively (simpler for the demo): mirror the migration-08 pattern and tighten the `lessons` RLS SELECT policy to require active enrollment, so every Supabase query on lessons already enforces it at the DB layer.

Note: the lesson fetch above selects `id, title, transcript` but not `module_id`. The fix above also requires adding `module_id` to the select on line 49.

---

## Warnings

### WR-01: Unvalidated `role` field from DB history enables assistant-impersonation replay

**File:** `app/api/tutor/chat/route.ts:151-154`

**Issue:** Chat history is loaded from `ai_chat_messages` and the `role` column is cast directly to `'user' | 'assistant'` with no validation:

```typescript
const priorMessages = history.map((m) => ({
  role: m.role as 'user' | 'assistant',
  content: m.content,
}))
```

The `ai_chat_messages` table has a DB CHECK constraint `(role in ('user', 'assistant'))`, which prevents arbitrary values at insertion time. However, the Route Handler inserts rows with `role: 'user'` and `role: 'assistant'` via `as never` (bypassing TypeScript type checks). If a future code path, a migration removing the CHECK constraint, or a service-role admin script ever inserts a row with an invalid role value, the history is passed verbatim to the Anthropic SDK. More concretely: the user message is inserted **before** the history is loaded, so the current request's user message is already in the DB. The `priorMessages` slice is built from the **entire** history including that new message (line 105: `.limit(20)` fetches chronologically), and then the same message is appended again at line 169. This means **the latest user turn is sent to Claude twice** when the session has an existing history.

**Fix — two issues:**

1. Validate role defensively:
```typescript
const priorMessages = history
  .filter((m) => m.role === 'user' || m.role === 'assistant')
  .map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
```

2. Exclude the just-inserted user message from the history window. The simplest fix is to fetch history **before** inserting the new user message (swap the order of operations at lines 101-128), so the loaded history never includes the current turn.

---

### WR-02: `onFinish` failure is silently swallowed — assistant message lost with no client signal

**File:** `app/api/tutor/chat/route.ts:171-183`

**Issue:** The `onFinish` callback persists the assistant's reply to `ai_chat_messages`. If the Supabase insert fails, the error is only logged to `console.error` and not propagated. The streaming response has already been sent to the client, so from the user's perspective the message appeared; but it will not exist in the DB and will be missing from `initialMessages` on next page load. The chat history is silently corrupted.

This is particularly problematic for a demo: a transient Supabase error during `onFinish` will make the conversation appear to work in real time but be missing messages when the user refreshes, with no visible error.

**Fix:** The Vercel AI SDK does not allow aborting an already-sent stream from `onFinish`, so the corruption cannot be prevented at the transport layer. The mitigation is to surface it to monitoring so the dev team is alerted, and to implement a client-side "reload history" path on panel open. At minimum, escalate from `console.error` to a real error reporting sink (e.g., Sentry, or a structured log that triggers an alert):

```typescript
onFinish: async ({ text }) => {
  const { error: assistantMsgError } = await supabase
    .from('ai_chat_messages')
    .insert({ session_id: session.id, role: 'assistant', content: text } as never)

  if (assistantMsgError) {
    // In production: report to error tracking (Sentry, etc.)
    console.error('[tutor chat] CRITICAL: assistant message persistence failed', {
      sessionId: session.id,
      error: assistantMsgError,
    })
    // Consider: flag the session as having a persistence gap for audit
  }
},
```

---

### WR-03: `initialMessages` missing `createdAt` field — Vercel AI SDK hydration mismatch

**File:** `app/dashboard/lesson/[lessonId]/page.tsx:133-137`

**Issue:** The `Message` type from the Vercel AI SDK (`ai` package v4.x) includes a `createdAt: Date` field. The `initialMessages` mapping omits it:

```typescript
const initialMessages: Message[] = chatHistory.map((m) => ({
  id: m.id,
  role: m.role as 'user' | 'assistant',
  content: m.content,
  // createdAt is absent
}))
```

The `ai_chat_messages` table stores `created_at` as a timestamptz string. When `initialMessages` is passed to `useChat`, the SDK attempts to sort or render messages by their `createdAt` property. When it is `undefined`, the messages will render in insertion order (which may be correct), but the SDK's internal deduplication logic compares message objects including `createdAt`. New streaming messages will have `createdAt: Date` while restored messages will have `createdAt: undefined`. In SDK v4.x this can cause restored messages to sort after new ones when the internal comparator encounters mixed undefined/Date values, visually shuffling chat history.

**Fix:** Include `createdAt` in the mapping. Update `ChatMessageRow` to include `created_at` and pass it:

```typescript
// page.tsx — update ChatMessageRow type (line 42)
type ChatMessageRow = {
  id: string
  role: string
  content: string
  created_at: string
}

// Update the Supabase select (line 100)
.select('id, role, content, created_at')

// Update the mapping (line 133)
const initialMessages: Message[] = chatHistory.map((m) => ({
  id: m.id,
  role: m.role as 'user' | 'assistant',
  content: m.content,
  createdAt: new Date(m.created_at),
}))
```

---

### WR-04: `useChat` sends full client `messages` array; route ignores it but `sessionId` is also silently dropped

**File:** `app/api/tutor/chat/route.ts:27` / `components/TutorPanel.tsx:26-30`

**Issue:** The `useChat` hook is configured with `body: { lessonId }`. By default the Vercel AI SDK v4 `useChat` hook POST body contains `{ messages: [...allMessages], ...body }` — i.e., the entire conversation history is sent with every request in addition to the fields in `body`. The Route Handler destructures only `{ lessonId, message, sessionId }` from the body (line 27), so the client-supplied `messages` array is present in every request but silently discarded.

This is actually the **correct security posture** — client-supplied history must not be trusted — but the code silently ignores it rather than explicitly acknowledging and discarding it. More importantly: `sessionId` is extracted from the body (line 27) but **never used**. It is always `undefined` because `useChat` does not send a `sessionId` field by default. The session is looked up by `(user.id, lessonId)` which is correct, but the unused `sessionId` extraction in the destructure is confusing dead code that implies client-controlled session routing (a security anti-pattern) without actually implementing it.

**Fix:** Remove `sessionId` from the body destructure to eliminate the dead code and the implied security risk:

```typescript
// route.ts line 27 — remove sessionId
const { lessonId, message } = body
```

Update the body type annotation on line 20 to match:
```typescript
let body: { lessonId?: string; message?: string }
```

---

## Info

### IN-01: `as never` cast pattern on Supabase inserts masks type errors

**File:** `app/api/tutor/chat/route.ts:88, 123, 178`

**Issue:** Three `insert()` calls use `as never` to suppress TypeScript errors, e.g.:
```typescript
.insert({ user_id: user.id, lesson_id: lessonId } as never)
```

The `as never` pattern means TypeScript cannot verify that the object shape satisfies the table's Insert type. A future schema change (e.g., adding a required column) will compile without error but fail at runtime. The correct pattern is `as unknown as Database['public']['Tables']['ai_chat_sessions']['Insert']` or simply fixing the underlying type mismatch (likely caused by the Supabase client not being instantiated with the `Database` generic).

**Fix:** Instantiate the Supabase client with the `Database` generic, which allows typed `.from()` calls that do not require any cast:

```typescript
// lib/supabase/server.ts — ensure createClient is typed
import type { Database } from '@/lib/database.types'
const supabase = createClient<Database>(url, key, ...)
```

Once the client is typed, the `as never` casts can be removed from all three insert calls.

---

### IN-02: `lucide-react` version in `package.json` does not match CLAUDE.md recommendation

**File:** `package.json:22`

**Issue:** `package.json` lists `"lucide-react": "^1.11.0"` but CLAUDE.md specifies `lucide-react@^0.400+`. Version `1.x` is a different major version line from `0.400+`. Some icon names changed between these versions. This is likely correct (1.x is newer) but it is inconsistent with the documented stack and could cause confusion when onboarding contributors who follow CLAUDE.md to install dependencies.

**Fix:** Update CLAUDE.md to reflect the actual installed version, or pin to `^0.400` if the older API is intentionally targeted.

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
