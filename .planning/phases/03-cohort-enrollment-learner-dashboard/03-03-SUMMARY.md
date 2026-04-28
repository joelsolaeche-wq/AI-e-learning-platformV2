---
phase: 03-cohort-enrollment-learner-dashboard
plan: "03"
subsystem: dashboard
tags: [dashboard, enrollment, progress, teammates, rls, server-component]
dependency_graph:
  requires:
    - SELECT policy on public.profiles (Plan 01 — cohort-mate policy)
    - INSERT policy on public.enrollments (Plan 01)
    - enrollInCohortAction Server Action (Plan 02)
  provides:
    - Full Phase 3 learner dashboard (app/dashboard/page.tsx)
    - Enrolled cohort cards with progress bar and teammate roster
    - Empty state for users with no enrollments
  affects:
    - /dashboard route (previously a skeleton placeholder)
tech_stack:
  added: []
  patterns:
    - Server Component with parallel Supabase queries (Promise.all) + sequential per-cohort follow-up queries
    - Explicit Pick type aliases for discriminated union Supabase results
    - LessonProgressRow type cast for PostgREST 14.5 schema inference workaround
    - Inner-join selector (modules!inner(course_id)) to group lessons by course in one round trip
    - displayName helper (full_name ?? email.split('@')[0]) per UI-SPEC D-07
key_files:
  created: []
  modified:
    - app/dashboard/page.tsx
decisions:
  - Hardcode 0% for teammate progress display (not a stub — per D-07 teammate lesson_progress rows won't exist until Phase 4+; rendering literal 0% is clearer than a query that always returns 0 rows)
  - LessonProgressRow inline type cast to work around PostgREST 14.5 schema inference (same pattern as Plan 02's EnrollmentCohortIdRow)
metrics:
  duration: "~6 minutes"
  completed: "2026-04-28"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 1
---

# Phase 3 Plan 03: Learner Dashboard Summary

Full Phase 3 learner dashboard replacing the skeleton placeholder — enrolled cohort cards with status badge, 0-of-N progress bar, teammate roster, and "Go to Course" link; empty state for users with no enrollments.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace app/dashboard/page.tsx with full Phase 3 dashboard | ba5616b | app/dashboard/page.tsx (283 lines, was 59 lines) |

## Files Modified

### app/dashboard/page.tsx (rewritten, 59 lines → 283 lines)

**Previous state:** Phase 1/2 skeleton showing "Your learning journey" placeholder and raw Account section with User ID display.

**New implementation:** Server Component with:

1. **Imports added:**
   - `Link` from `next/link`
   - `Card`, `CardContent`, `CardHeader` from `@/components/ui/card`
   - `Badge` from `@/components/ui/badge`
   - `Button` from `@/components/ui/button`
   - `Database` type from `@/lib/database.types`

2. **Type aliases (5):**
   - `EnrollmentWithCohort` — enrollments row with nested cohorts + courses
   - `TeammateProfile` — profiles Pick (id, full_name, email)
   - `TeammateEnrollment` — enrollment row with nested profiles
   - `LessonRowMin` — lessons Pick (id, module_id)
   - `LessonProgressRow` (inline) — lesson_progress cast type

3. **Data fetching:**
   - `Promise.all` for enrollments (with nested cohorts+courses) + lesson_progress
   - Sequential follow-up: lessons (inner-join on modules for course grouping) when courseIds > 0
   - Sequential follow-up: teammate enrollments with profiles when cohortIds > 0
   - All results grouped into Maps (`lessonsByCourse`, `teammatesByCohort`) for O(1) per-card lookups

4. **Two render branches:**

   **Empty state (COHORT-03 base case):** Renders when `enrollments.length === 0`.
   - Implements UI-SPEC copywriting: "No cohorts yet" heading, "Browse the catalog to find your team's AI course." body, "Browse catalog →" link to `/catalog`.

   **Enrolled state (COHORT-03 + COHORT-04):** Renders when user has ≥1 active enrollment.
   - Section heading: "Your Cohorts"
   - Per-enrollment `<Card>` with:
     - `<CardHeader>`: cohort title (h2 text-lg font-semibold) + status `<Badge>` (default if active, secondary otherwise)
     - `<CardContent>`: progress section + teammate section + course link
   - Progress section: "{completedCount} of {totalLessons} lessons complete" label + `role="progressbar"` div with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, inline `style={{ width: \`${pct}%\` }}`
   - Teammate section: "Teammates" uppercase label + `<ul>` of teammate rows displaying `displayName(profile)` + `0%`
   - Course link: `<Button variant="ghost" size="sm" asChild>` wrapping `<Link href="/catalog/{courseId}">Go to Course →</Link>`

5. **Auth guard:** `redirect('/auth/login')` preserved (belt-and-suspenders alongside middleware).

6. **Log-out form:** Migrated from inline `<button>` with Tailwind classes to `<Button type="submit" variant="ghost" size="sm">` inside the same `<form action="/auth/logout" method="POST">`.

## End-to-End Demo Flow

The full Phase 3 demo flow is now functional:
1. Fresh user signs up → lands on `/dashboard` → sees "No cohorts yet" empty state with "Browse catalog →" link
2. Clicks "Browse catalog →" → `/catalog` → clicks into AI course → clicks "Join Cohort" → `enrollInCohortAction` fires → redirect to `/dashboard`
3. `/dashboard` now shows a cohort card: "May 2026 Cohort" | Active badge | "0 of 3 lessons complete" | 0% progress bar | Teammates: "Jane Doe · 0%" and "Alex Kim · 0%" | "Go to Course →" link
4. Unauthenticated visit to `/dashboard` → redirected to `/auth/login` (middleware + page guard)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PostgREST 14.5 schema inference — lesson_progress query resolves to never**
- **Found during:** Task 1 TypeScript check
- **Issue:** `progressResult.data.map((r) => r.lesson_id as string)` caused TS2339 — property `lesson_id` does not exist on type `never`. Same root cause as Plan 02's enrollment query fix: `Database.__InternalSupabase` causes `Schema = never` in supabase-js v2.105.x schema inference.
- **Fix:** Added inline `type LessonProgressRow = { lesson_id: string; completed: boolean }` and cast `(progressResult.data ?? []) as LessonProgressRow[]`. This is consistent with Plan 02's `EnrollmentCohortIdRow` pattern.
- **Files modified:** app/dashboard/page.tsx

## Known Stubs

Teammate progress percentages display `0%` (hardcoded literal, not a computed stub). This is intentional per D-07: the seeded teammate accounts (`...061`, `...062`) are stub auth rows with `encrypted_password = ''` — they never log in and therefore never accumulate `lesson_progress` rows. Computing their progress dynamically would always return 0% and add a round-trip query. The literal `0%` is explicitly correct for Phase 3. Phase 4+ will wire real per-user lesson progress when the lesson player is built.

## Threat Model Compliance

| Threat | Mitigation Applied |
|--------|--------------------|
| T-03-10 (Info disclosure: teammate profiles) | Cohort-mate SELECT policy (Plan 01) restricts profile reads to shared-cohort members at DB layer |
| T-03-11 (Info disclosure: lesson totals) | Scoped by course_id from user's own enrollments — no broader read surface |
| T-03-12 (Elevation: unauthenticated /dashboard) | Middleware redirect + page-level redirect + RLS returns empty rows as triple-redundancy |
| T-03-13 (Info disclosure: email fallback) | Only email.split('@')[0] (local part) displayed — domain hidden per UI-SPEC |

## Self-Check

- [x] `app/dashboard/page.tsx` exists on disk (283 lines)
- [x] Contains "Your Cohorts" heading
- [x] Contains "No cohorts yet" empty state
- [x] Contains "Browse catalog →" link to /catalog
- [x] Contains "Go to Course →" cohort card link
- [x] Contains progress bar with role="progressbar" and aria attributes
- [x] Contains redirect('/auth/login') auth guard
- [x] Does NOT contain "Your learning journey" (skeleton removed)
- [x] Does NOT contain "User ID:" (skeleton removed)
- [x] Does NOT contain 'use client' (Server Component)
- [x] Commit ba5616b exists (Task 1)
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npx next build` compiles /dashboard route successfully

## Self-Check: PASSED
