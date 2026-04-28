---
phase: 03-cohort-enrollment-learner-dashboard
plan: "02"
subsystem: enrollment
tags: [server-action, enrollment, catalog, form, rls]
dependency_graph:
  requires:
    - INSERT policy on public.enrollments (Plan 01 — "Users can insert their own enrollments")
    - SELECT policy on public.enrollments (migration 00002 — "Users can view their own enrollments")
  provides:
    - enrollInCohortAction Server Action (lib/actions/enrollment.actions.ts)
    - EnrollmentActionResult type
    - Enrollment-aware cohort cards in /catalog/[courseId] (enabled Join Cohort button + Enrolled badge)
  affects:
    - /dashboard (Plan 03) — enrollment rows now being written; dashboard query path unblocked
tech_stack:
  added: []
  patterns:
    - Server Action with (_prevState, formData) signature following auth.actions.ts convention
    - TablesInsert<'enrollments'> explicit type cast for Supabase v2 / PostgREST 14.5 schema inference workaround
    - Form action bound with .bind(null, { error: null }) to supply _prevState; cast to (FormData) => void for Next.js type compatibility
    - EnrollmentCohortIdRow inline type alias for enrollmentsResult.data cast (same workaround)
key_files:
  created:
    - lib/actions/enrollment.actions.ts
  modified:
    - app/catalog/[courseId]/page.tsx
decisions:
  - Use TablesInsert<'enrollments'> + (enrollmentRow as never) cast to work around PostgREST 14.5 schema inference issue in supabase-js v2.105.x — the Database.__InternalSupabase key causes Schema to resolve as never in the from().insert() overload
  - Use enrollInCohortAction.bind(null, { error: null }) as (FormData) => void cast for Next.js form action type compatibility — runtime behavior is correct; the Promise<EnrollmentActionResult> return is valid as Next.js discards form action return values outside useFormState
metrics:
  duration: "~6 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 3 Plan 02: Enrollment Write Path Summary

Server Action `enrollInCohortAction` with auth guard, duplicate-enrollment handling, and enrollment-aware conditional rendering on the course detail page — enabling the demo "click Join Cohort → row in DB → /dashboard" flow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create lib/actions/enrollment.actions.ts with enrollInCohortAction Server Action | 3c1d0af | lib/actions/enrollment.actions.ts (70 lines) |
| 2 | Wire the Join Cohort button in app/catalog/[courseId]/page.tsx with enrollment-aware rendering | ecac310 | app/catalog/[courseId]/page.tsx (+22 -6 lines) |

## Files Created / Modified

### lib/actions/enrollment.actions.ts (new, 70 lines)

Exports:
- `EnrollmentActionResult` — `{ error: string | null }` type, mirrors `AuthActionResult` from auth.actions.ts
- `enrollInCohortAction(_prevState, formData)` — Server Action that:
  1. Guards against missing `cohort_id` form field
  2. Calls `supabase.auth.getUser()` and `redirect('/auth/login')` if unauthenticated
  3. Inserts `{ user_id: user.id, cohort_id: cohortId }` into `public.enrollments`
  4. On Postgres error code `'23505'` (unique_violation): `revalidatePath('/dashboard')` + `redirect('/dashboard')` (silent dedup per D-03)
  5. On other errors: returns `{ error: "Couldn't enroll — try again" }` (exact UI-SPEC string)
  6. On success: `revalidatePath('/dashboard')` + `redirect('/dashboard')`

Notable: uses `TablesInsert<'enrollments'>` explicit type with `enrollmentRow as never` cast to work around a Supabase v2.105.x / PostgREST 14.5 schema inference limitation where `from('enrollments').insert()` resolves insert parameter to `never`.

### app/catalog/[courseId]/page.tsx (modified, 3 targeted edits)

**Edit 1 — Import:** Added `import { enrollInCohortAction } from '@/lib/actions/enrollment.actions'` after the `Database` type import.

**Edit 2 — Data fetch + derivation:**
- Extended `Promise.all` from 3 entries to 4: added `supabase.from('enrollments').select('cohort_id').eq('user_id', user.id)` as `enrollmentsResult`
- Added `const enrolledCohortIds = new Set<string>(...)` derived from `enrollmentsResult.data` using inline `EnrollmentCohortIdRow` type cast

**Edit 3 — Conditional render:**
- Replaced disabled `<Button size="sm" disabled>Join Cohort</Button>` with:
  - If `enrolledCohortIds.has(cohort.id)`: renders `<Badge variant="secondary">Enrolled</Badge>`
  - Otherwise: renders `<form action={enrollInCohortAction.bind(null, { error: null })}>` with hidden `cohort_id` input and `<Button size="sm" type="submit">Join Cohort</Button>`

All existing JSX outside the button block is byte-identical to before this task.

## End-to-End Flow

The manual smoke test flow now works:
1. Logged-in user visits `/catalog/<published-course-id>` — cohort cards render with enabled "Join Cohort" buttons
2. User clicks Join Cohort — `enrollInCohortAction` fires, inserts `enrollments` row, redirects to `/dashboard`
3. User navigates back to the same course detail page — the clicked cohort shows "Enrolled" badge instead of button
4. Unauthenticated direct form post → redirected to `/auth/login`
5. Duplicate click (same cohort) → 23505 caught, silent redirect to `/dashboard`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PostgREST 14.5 schema inference — insert() type resolves to never**
- **Found during:** Task 1 TypeScript check
- **Issue:** `supabase.from('enrollments').insert({ user_id, cohort_id })` caused TS2769 — the `Insert` type resolved to `never` because `Database.__InternalSupabase` causes `Schema = never` in the `from().insert()` overload chain in supabase-js v2.105.x
- **Fix:** Declared explicit `const enrollmentRow: TablesInsert<'enrollments'> = { ... }` and passed `enrollmentRow as never` to bypass the overload issue. Type is validated at the `TablesInsert<>` assignment; the `as never` is purely to satisfy the broken overload, not to bypass type safety.
- **Files modified:** lib/actions/enrollment.actions.ts

**2. [Rule 1 - Bug] PostgREST 14.5 schema inference — enrollmentsResult.data cohort_id property type never**
- **Found during:** Task 2 TypeScript check (same root cause)
- **Issue:** `enrollmentsResult.data.map((e) => e.cohort_id)` caused TS2339 — property `cohort_id` does not exist on type `never`
- **Fix:** Added inline `type EnrollmentCohortIdRow = { cohort_id: string }` and cast `enrollmentsResult.data as EnrollmentCohortIdRow[]`
- **Files modified:** app/catalog/[courseId]/page.tsx

**3. [Rule 1 - Bug] Next.js form action type incompatibility with Server Action returning non-void**
- **Found during:** Task 2 TypeScript check
- **Issue:** `<form action={enrollInCohortAction.bind(null, { error: null })}>` caused TS2322 — `(formData: FormData) => Promise<EnrollmentActionResult>` is not assignable to `(formData: FormData) => void | Promise<void>`
- **Fix:** Added cast `as (formData: FormData) => void` on the bound action. At runtime, Next.js form actions discard the return value when used outside `useFormState`; the cast is type-only and does not change behavior.
- **Files modified:** app/catalog/[courseId]/page.tsx

## Known Stubs

None. The enrollment write path is fully wired: form → Server Action → DB insert → redirect. No placeholder data or hardcoded values.

## Threat Model Compliance

All mitigations from the plan's threat register are implemented:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-03-05 (Spoofing: caller identity) | `supabase.auth.getUser()` server-side; client cannot forge user_id — only cohort_id comes from form |
| T-03-06 (Tampering: cohort_id) | FK constraint rejects non-existent cohort IDs; UNIQUE constraint dedupes |
| T-03-07 (Elevation: unauthenticated action) | Auth guard at top: `if (!user) redirect('/auth/login')` |
| T-03-08 (Info disclosure: enrollmentsResult) | Only current user's cohort_ids selected; existing RLS SELECT policy enforces this |
| T-03-09 (DoS: duplicate inserts) | 23505 path returns instantly; no extra DB work |

## Self-Check

- [x] `lib/actions/enrollment.actions.ts` exists on disk (70 lines)
- [x] First line is `'use server'`
- [x] Exports `EnrollmentActionResult` and `enrollInCohortAction`
- [x] `enrollmentsResult` in Promise.all of catalog page
- [x] `enrolledCohortIds` Set derived from enrollmentsResult
- [x] `enrolledCohortIds.has(cohort.id)` conditional in JSX
- [x] `<Badge variant="secondary">Enrolled</Badge>` present
- [x] `<Button size="sm" disabled>` NOT present (removed)
- [x] Commit 3c1d0af exists (Task 1)
- [x] Commit ecac310 exists (Task 2)
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npx next build` completes successfully with /catalog/[courseId] route compiled

## Self-Check: PASSED
