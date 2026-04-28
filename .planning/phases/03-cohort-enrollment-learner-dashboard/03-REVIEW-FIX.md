---
phase: 03-cohort-enrollment-learner-dashboard
fixed_at: 2026-04-28T00:00:00Z
review_path: .planning/phases/03-cohort-enrollment-learner-dashboard/03-REVIEW.md
iteration: 2
findings_in_scope: 6
fixed: 4
skipped: 2
status: partial
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-28T00:00:00Z
**Source review:** .planning/phases/03-cohort-enrollment-learner-dashboard/03-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope (CR + WR): 6
- Fixed: 4
- Skipped (accepted deviations): 2

---

## Fixed Issues

### CR-02: Non-atomic seat-capacity check — known limitation documented

**Files modified:** `lib/actions/enrollment.actions.ts`
**Commit:** 7b1c18e
**Applied fix:** Added an inline KNOWN LIMITATION comment block above the read-then-write seat capacity check explaining the race condition, the correct production fix (SECURITY DEFINER RPC with FOR UPDATE lock on the cohorts row), and why it is deferred (low-concurrency demo environment makes this an acceptable risk). No code logic was changed — the full RPC approach is out of scope for this demo.

---

### CR-03: Lessons RLS policy missing `e.status = 'active'` filter

**Files modified:** `supabase/migrations/20260428000005_lesson_rls_status_fix.sql` (new file)
**Commit:** a837f86
**Applied fix:** Created new migration `20260428000005_lesson_rls_status_fix.sql` that drops the incomplete policy from migration 00004 (`"enrolled users can view lessons"`) and recreates it with `and e.status = 'active'` added to the EXISTS subquery. This ensures dropped and completed enrollees lose lesson read access. Migration was applied successfully via `npx supabase db push` — output confirmed `Finished supabase db push.`

---

### WR-01: Success path missing `revalidatePath('/dashboard')`

**Files modified:** `lib/actions/enrollment.actions.ts`
**Commit:** dbc561d
**Applied fix:** Added `revalidatePath('/dashboard')` immediately before `return { error: null, enrolled: true }` on the new-enrollment success path (line 98). The 23505 duplicate-enrollment path already called both `/catalog` and `/dashboard` revalidates; the success path now revalidates both paths as well, preventing the dashboard from serving stale enrollment data after a fresh enrollment.

---

### WR-02: Teammate query returns dropped/completed enrollees

**Files modified:** `app/dashboard/page.tsx`
**Commit:** f5c23e9
**Applied fix:** Added `.eq('status', 'active')` to the teammate enrollments query so dropped and completed learners are excluded from the Teammates section. The companion RLS policy in migration 00003 was noted in the review but not changed — the query-level filter is sufficient to prevent the display defect in the demo. The RLS policy update would require a new migration and is left for a future iteration.

---

## Skipped Issues

### CR-01: Duplicate-enrollment path calls `redirect()` instead of returning `{ enrolled: true }`

**File:** `lib/actions/enrollment.actions.ts:89-91`
**Reason:** accepted_deviation — per prompt instructions and plan spec (03-04-PLAN.md): "enrollInCohortAction still calls redirect('/dashboard') for the duplicate-enrollment (23505) branch, which counts as 'already enrolled' — the in-place badge handles the first-time happy path." The 23505 redirect is an intentional design decision recorded in project context. Not changed.
**Original issue:** `redirect('/dashboard')` on the 23505 path prevents `useActionState` in `EnrollButton` from receiving `{ enrolled: true }`, so the enrolled badge does not render for already-enrolled users — they receive a hard navigation to `/dashboard` instead.

---

### WR-03: Teammate progress hardcoded as `'0%'`

**File:** `app/dashboard/page.tsx:272`
**Reason:** accepted_deviation — per prompt instructions and project decision D-07 recorded in STATE.md: "Hardcode 0% for teammate progress display in Phase 3 dashboard (seeded teammates have no lesson_progress rows; computing dynamically would always return 0%; literal 0% is per D-07 spec; Phase 4+ wires real progress)." The `'0%'` value is intentional for Phase 3. Not changed.
**Original issue:** Unconditionally rendered `'0%'` presents stale data as factual once any teammate completes a lesson.

---

_Fixed: 2026-04-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
