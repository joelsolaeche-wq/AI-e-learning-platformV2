---
phase: 03-cohort-enrollment-learner-dashboard
fixed_at: 2026-04-28T00:00:00Z
review_path: .planning/phases/03-cohort-enrollment-learner-dashboard/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-28T00:00:00Z
**Source review:** .planning/phases/03-cohort-enrollment-learner-dashboard/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, CR-03, CR-04, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 9
- Skipped: 0

Note: WR-01 is covered by the CR-01 fix (same migration file, same policy addition).

---

## Fixed Issues

### CR-01 + WR-01: Add SELECT policy on enrollments for cohort-peer reads

**Files modified:** `supabase/migrations/20260428000003_enrollment_rls.sql`
**Commit:** `696bc03`
**Applied fix:** Added `"Users can view enrollments in their cohorts"` SELECT policy on `public.enrollments`. The policy allows a user to read enrollment rows where `cohort_id` is in their own set of enrolled cohort IDs. Without this policy, the EXISTS subquery inside the `"Users can view profiles of cohort-mates"` profiles policy was blocked by RLS on the enrollments table, causing the teammate query to always return empty results.

---

### CR-02: Replace broken lesson join filter with two-step query

**Files modified:** `app/dashboard/page.tsx`
**Commit:** `55ddf63`
**Applied fix:** Replaced the broken `.in('modules.course_id', courseIds)` single-query approach (PostgREST silently ignores dot-path column references in `.in()` filters) with a two-step query: (1) fetch modules filtered by `course_id IN courseIds`, build a `moduleToCourse` Map from module ID to course ID; (2) fetch lessons filtered by `module_id IN moduleIds` and group by looking up course ID from the Map. Added an explicit `ModuleRow` type cast to work around the Supabase-generated `never[]` typing issue on the modules query.

---

### CR-03: Add cohort validation before enrollment insert

**Files modified:** `lib/actions/enrollment.actions.ts`
**Commit:** `b365cef`
**Applied fix:** Added server-side guard in `enrollInCohortAction` before the INSERT: (1) fetch cohort by ID and return `{ error: 'Cohort not found.' }` if missing; (2) check `cohort.status === 'active'` and return error if not; (3) when `max_seats > 0`, count active enrollments and return `{ error: 'This cohort is full.' }` if at capacity. Added a `CohortValidation` type cast to work around the Supabase-generated `never` type on the cohorts query result.

---

### CR-04: Convert enrollment form to useActionState client component

**Files modified:** `components/EnrollButton.tsx` (new file), `app/catalog/[courseId]/page.tsx`
**Commit:** `a869f71`
**Applied fix:** Created `components/EnrollButton.tsx` as a `'use client'` component that uses `useActionState(enrollInCohortAction, { error: null })` to wire up the form action and surface returned error strings in a `<p className="text-xs text-destructive">` element. Updated `app/catalog/[courseId]/page.tsx` to import `EnrollButton` instead of `enrollInCohortAction` directly, replacing the `.bind(null, { error: null })` pattern with `<EnrollButton cohortId={cohort.id} />`. Removed the now-unused `Button` import from the catalog page (still available via EnrollButton's own import).

---

### WR-02: Replace hardcoded 0% teammate progress with dash

**Files modified:** `app/dashboard/page.tsx`
**Commit:** `74f020e`
**Applied fix:** Changed the hardcoded `0%` string in the teammate list to an em dash (`—`) to accurately reflect that per-teammate progress is not yet tracked, rather than presenting factually wrong data.

---

### WR-03: Change seat label from "N seats available" to "Up to N seats"

**Files modified:** `app/catalog/[courseId]/page.tsx`
**Commit:** `01d4f38`
**Applied fix:** Changed `{cohort.max_seats} seats available` to `Up to {cohort.max_seats} seats`. The `max_seats` field is total capacity, not remaining availability; the old label would show the same number even after every seat was filled.

---

### WR-04: Add server-side error logging for modules and cohorts fetch failures

**Files modified:** `app/catalog/[courseId]/page.tsx`
**Commit:** `c81a852`
**Applied fix:** Added `console.error('modules fetch error', modulesResult.error)` and `console.error('cohorts fetch error', cohortsResult.error)` checks before data extraction so transient DB errors, RLS denials, or network timeouts appear in Vercel function logs rather than silently rendering empty sections.

---

### WR-05: Remove outer Separator between modules and cohorts sections

**Files modified:** `app/catalog/[courseId]/page.tsx`
**Commit:** `f34a88b`
**Applied fix:** Removed the unconditional `<Separator />` rendered after the entire modules section. The per-module conditional separators (`{moduleIdx < modules.length - 1 && <Separator className="mt-6" />}`) and the `space-y-8` on the parent `<main>` element provide sufficient visual separation between sections without the double separator that appeared with the outer one in place.

---

## Skipped Issues

None — all in-scope findings were successfully fixed.

---

_Fixed: 2026-04-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
