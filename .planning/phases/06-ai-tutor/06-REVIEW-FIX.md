---
phase: 06-ai-tutor
fixed_at: 2026-04-29T00:00:00Z
review_path: .planning/phases/06-ai-tutor/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-04-29T00:00:00Z
**Source review:** `.planning/phases/06-ai-tutor/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Race condition — duplicate `ai_chat_sessions` rows crash subsequent requests

**Files modified:** `supabase/migrations/20260429000001_ai_chat_sessions_unique.sql`, `app/api/tutor/chat/route.ts`
**Commit:** d249d44
**Applied fix:** Created a new migration adding `UNIQUE (user_id, lesson_id)` constraint to `ai_chat_sessions`. Replaced the SELECT-then-INSERT pattern (lines 69-97) with a single `.upsert({ user_id, lesson_id }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: false }).select('id').single()` call that atomically finds-or-creates the session row using the new constraint.

### CR-02: Enrollment authorization relies on `is_published` flag, not actual enrollment

**Files modified:** `app/api/tutor/chat/route.ts`
**Commit:** 3eac3de
**Applied fix:** Added `module_id` to the lesson select clause and updated the `LessonRow` type to include it. Inserted an explicit enrollment check after the lesson fetch using a nested subquery: `enrollments` filtered by `user_id` and `status = 'active'`, scoped to cohorts whose `course_id` matches the lesson's module's course. Returns HTTP 403 if no active enrollment found. Fixed the misleading comment that claimed RLS enforced enrollment. Requires human verification of the nested subquery pattern with the specific Supabase JS client version in use.

### WR-01: Unvalidated `role` field from DB history enables assistant-impersonation replay

**Files modified:** `app/api/tutor/chat/route.ts`
**Commit:** f859063
**Applied fix:** Added `.filter((m) => m.role === 'user' || m.role === 'assistant')` before `.map()` in the `priorMessages` construction. Note: the history-load-before-insert ordering was already correct in the codebase (history fetched at line 114, user insert at line 130), so no order swap was needed. The fix adds the defensive role filter as specified.

### WR-02: `onFinish` failure silently swallowed — assistant message lost with no client signal

**Files modified:** `app/api/tutor/chat/route.ts`
**Commit:** 5548400
**Applied fix:** Replaced the bare `console.error('[tutor chat] assistant message insert error', ...)` with a structured log including the `[tutor chat] CRITICAL:` prefix, the `sessionId` context field, and the error object. Added a comment directing future maintainers to wire this to an error tracking sink (e.g., Sentry).

### WR-03: `initialMessages` missing `createdAt` field — Vercel AI SDK hydration mismatch

**Files modified:** `app/dashboard/lesson/[lessonId]/page.tsx`
**Commit:** 5530fbc
**Applied fix:** Added `created_at: string` to the `ChatMessageRow` type. Updated the Supabase `.select()` call to include `created_at`. Updated the `initialMessages` mapping to include `createdAt: new Date(m.created_at)` so restored messages carry a `Date` object matching the shape that the Vercel AI SDK assigns to new streaming messages.

### WR-04: `sessionId` dead code in route destructure

**Files modified:** `app/api/tutor/chat/route.ts`
**Commit:** 079240e
**Applied fix:** Removed `sessionId?: string` from the `body` type annotation on line 20. The destructure on line 27 already did not extract `sessionId` (it was already `const { lessonId, message } = body`), so only the type annotation required cleanup. This eliminates the implication that client-controlled session routing is supported.

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-04-29T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
