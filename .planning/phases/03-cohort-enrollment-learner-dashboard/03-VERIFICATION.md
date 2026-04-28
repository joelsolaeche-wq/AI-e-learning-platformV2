---
phase: 03-cohort-enrollment-learner-dashboard
verified: 2026-04-28T00:00:00Z
status: gaps_found
score: 9/13 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Clicking 'Enroll' creates an enrollments row and immediately reflects in the UI without a page reload (ROADMAP SC-1)"
    status: failed
    reason: "The implementation redirects to /dashboard after enrollment — a full navigation — rather than updating the cohort card in-place. useActionState in EnrollButton provides optimistic error display but not badge-in-place after success. The ROADMAP SC-1 requirement explicitly states 'without a page reload'."
    artifacts:
      - path: "components/EnrollButton.tsx"
        issue: "On successful enrollment, the action calls redirect('/dashboard') which is a page navigation, not an in-page state update. The 'Enrolled' badge only appears when the user returns to the catalog page after redirect."
      - path: "lib/actions/enrollment.actions.ts"
        issue: "redirect('/dashboard') on success — SC-1 requires the badge to appear without leaving the course detail page."
    missing:
      - "Either (a) handle success in EnrollButton client state to swap button→badge in-place after the action completes, or (b) update ROADMAP SC-1 via override if redirect behavior is acceptable for the demo."
  - truth: "A user who is not enrolled in a cohort cannot access that cohort's lesson pages — Supabase RLS returns an empty result for lesson queries scoped to unenrolled cohorts (ROADMAP SC-5)"
    status: failed
    reason: "The lessons RLS policy in migration 00002 gates access on auth.role() = 'authenticated' AND course is_published = true — it does NOT scope by enrollment. Any authenticated user can SELECT from public.lessons for any published course regardless of enrollment. No migration in Phase 3 adds an enrollment-scoped RLS policy on lessons."
    artifacts:
      - path: "supabase/migrations/20260428000002_create_remaining_tables.sql"
        issue: "Lesson RLS policy 'Authenticated users can view lessons of published courses' does not check enrollments. Any authenticated user gets lesson rows for published courses."
      - path: "supabase/migrations/20260428000003_enrollment_rls.sql"
        issue: "No enrollment-scoped RLS policy on lessons table added in Phase 3."
    missing:
      - "Add an RLS policy on public.lessons (or public.lesson_progress) that restricts SELECT to users enrolled in the cohort whose course contains that lesson. Alternatively, scope restriction can be enforced at the API/page layer in Phase 4 when lesson pages are built, and override SC-5 if that is the accepted approach."
  - truth: "Each teammate row displays the display name (or email prefix as fallback) and a percentage label"
    status: failed
    reason: "The dashboard renders an em dash (—) instead of a percentage value (0%) for each teammate. The must-have truth and UI-SPEC state '{display_name} · {N}%'. The actual render is displayName(t.profiles) plus literal '—' in a span."
    artifacts:
      - path: "app/dashboard/page.tsx"
        issue: "Line 271-273: teammate percentage column renders <span>—</span> not <span>0%</span>. The literal em dash is not a percentage label."
    missing:
      - "Replace the em dash with the literal '0%' string (per Phase 3 D-07 spec) or compute actual teammate progress percentage."
  - truth: "Clicking 'Join Cohort' on a course detail page submits a Server Action that inserts a public.enrollments row for the current user and the selected cohort, then redirects to /dashboard (Plan 02 truth 1) — via enrollInCohortAction import in catalog page"
    status: partial
    reason: "The server action is correctly implemented and wired, but the catalog page does not directly import enrollInCohortAction. Instead it imports EnrollButton from components/EnrollButton.tsx which is a 'use client' component that internally uses useActionState. The wiring works but introduces a client component boundary into what was designed as a pure Server Component page. Plan 02 key_link specifies the pattern 'action={enrollInCohortAction}' directly in the catalog page JSX, not via a client wrapper."
    artifacts:
      - path: "app/catalog/[courseId]/page.tsx"
        issue: "Does not import enrollInCohortAction directly. Uses <EnrollButton cohortId={cohort.id} /> client component instead of the inline form described in Plan 02."
    missing:
      - "This is a valid alternative implementation. Consider adding an override if the EnrollButton client component approach is intentional and acceptable."
human_verification:
  - test: "Verify 'Enrolled' badge appears without page reload after clicking Join Cohort"
    expected: "The cohort card on /catalog/[courseId] should show an 'Enrolled' badge in place of the Join Cohort button immediately after clicking, without navigating away"
    why_human: "The current implementation redirects to /dashboard. Whether SC-1's 'without a page reload' requirement is satisfied requires manual browser testing to confirm whether useActionState optimistic update keeps badge in place."
  - test: "Verify unenrolled user cannot access lesson data for unenrolled cohorts"
    expected: "An authenticated user enrolled in cohort A should receive empty rows when querying lessons for cohort B's course"
    why_human: "The current lesson RLS is not enrollment-scoped. This requires a Supabase Studio SQL query or browser test against the lessons endpoint to confirm the gap."
  - test: "Verify teammate roster appears with Jane Doe and Alex Kim after enrolling in May 2026 Cohort"
    expected: "Dashboard shows teammate cards for Jane Doe and Alex Kim after user enrolls in cohort 00000000-0000-0000-0000-000000000050"
    why_human: "Requires supabase db reset + sign-up + enrollment click + dashboard visit to confirm the RLS cohort-mate policy enables the profiles query."
---

# Phase 3: Cohort Enrollment + Learner Dashboard Verification Report

**Phase Goal:** An authenticated user can view available cohorts for a course, enroll in one, and land on a dashboard that shows their enrolled cohort with progress indicators and cohort teammates.
**Verified:** 2026-04-28
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | RLS allows INSERT into enrollments (auth.uid() = user_id) | VERIFIED | `create policy "Users can insert their own enrollments" on public.enrollments for insert with check (auth.uid() = user_id)` present in migration 00003 |
| 2 | Cohort-mate SELECT policy on profiles exists and uses EXISTS subquery | VERIFIED | `create policy "Users can view profiles of cohort-mates"` with e1/e2 join on cohort_id present in migration 00003 |
| 3 | Unauthenticated users cannot SELECT profiles of non-cohort-mates | VERIFIED | Existing policies + new cohort-mate policy: both require `auth.uid()` — unauthenticated returns nothing |
| 4 | seed.sql contains teammate UUIDs ...061, ...062, ...071, ...072 with Jane Doe, Alex Kim | VERIFIED | All 4 UUIDs, auth.users inserts, profiles, enrollments rows confirmed in supabase/seed.sql lines 174-260 |
| 5 | Seed is idempotent (ON CONFLICT DO NOTHING) | VERIFIED | All three Phase 3 INSERTs use `on conflict (id) do nothing`; seed already used this pattern for org/course/etc. |
| 6 | enrollInCohortAction exported with correct signature and error handling | VERIFIED | File exists 99 lines; exports `EnrollmentActionResult` + `enrollInCohortAction`; auth guard, 23505 handler, "Couldn't enroll — try again" exact string all present |
| 7 | Catalog page fetches user enrollments and renders Enrolled badge for enrolled cohorts | VERIFIED | `enrolledCohortIds` Set derived from 4th Promise.all entry; `enrolledCohortIds.has(cohort.id)` conditional renders `<Badge variant="secondary">Enrolled</Badge>` |
| 8 | Dashboard renders "Your Cohorts" heading, progress bar, empty state | VERIFIED | All UI-SPEC strings present: "Your Cohorts", "No cohorts yet", "Browse catalog →", "Go to Course →", progress bar with role="progressbar" aria attributes |
| 9 | Dashboard fetches enrollments with nested cohorts+courses and lesson_progress | VERIFIED | Promise.all queries enrollments (with cohorts/courses nested) and lesson_progress; teammate query with `profiles ( id, full_name, email )` and `neq('user_id', user.id)` |
| 10 | Teammate percentage label shows percentage value | FAILED | Dashboard renders `—` (em dash) not `0%`. UI-SPEC requires `{display_name} · {N}%` format |
| 11 | Clicking Enroll immediately reflects in UI without page reload (ROADMAP SC-1) | FAILED | Implementation uses redirect('/dashboard') — full navigation. EnrollButton's useActionState does not keep badge in-place on success |
| 12 | Unenrolled user cannot access lesson pages via RLS (ROADMAP SC-5) | FAILED | Lesson RLS in migration 00002 scopes on `is_published = true`, not enrollment membership. No enrollment-scoped lesson policy in any migration |
| 13 | enrollInCohortAction wired directly in catalog page JSX (Plan 02 key_link) | PARTIAL | Action is wired via EnrollButton client component; catalog page does not import enrollInCohortAction directly. Functionally equivalent but deviates from plan pattern and adds client boundary |

**Score:** 9/13 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260428000003_enrollment_rls.sql` | INSERT policy on enrollments + cohort-mate SELECT on profiles | VERIFIED | 56 lines; contains both required policies plus bonus "Users can view enrollments in their cohorts" SELECT policy (needed to unblock RLS subquery) |
| `supabase/seed.sql` | Two teammate auth.users + profiles + enrollments rows | VERIFIED | 261 lines; teammate section appended at line 165; all 4 fixed UUIDs present with ON CONFLICT DO NOTHING |
| `lib/actions/enrollment.actions.ts` | enrollInCohortAction Server Action + EnrollmentActionResult type | VERIFIED | 99 lines; both exports present; 'use server'; auth guard; 23505 handling; exact UI-SPEC error string |
| `app/catalog/[courseId]/page.tsx` | Enrollment-aware Join Cohort / Enrolled badge rendering | VERIFIED (PARTIAL) | Contains enrolledCohortIds Set and conditional badge; but delegates to EnrollButton client component rather than inline form |
| `app/dashboard/page.tsx` | Full Phase 3 learner dashboard | VERIFIED (with gaps) | 297 lines replacing 59-line skeleton; all required queries, UI strings, and progress bar present; teammate % is em dash not 0% |
| `components/EnrollButton.tsx` | Client component wrapping enrollInCohortAction | VERIFIED | 31 lines; 'use client'; useActionState(enrollInCohortAction); form with cohort_id hidden input; error display; Join Cohort button |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/actions/enrollment.actions.ts` | `public.enrollments INSERT policy` | `supabase.from('enrollments').insert(enrollmentRow as never)` | WIRED | TablesInsert<'enrollments'> cast used; insert call present line 81 |
| `components/EnrollButton.tsx` | `lib/actions/enrollment.actions.ts` | `useActionState(enrollInCohortAction, { error: null })` | WIRED | Direct import and use via React hook |
| `app/catalog/[courseId]/page.tsx` | `components/EnrollButton.tsx` | `<EnrollButton cohortId={cohort.id} />` | WIRED | Imported line 7; rendered conditionally line 213 |
| `app/dashboard/page.tsx` | `public.enrollments + cohorts + courses` | `.from('enrollments').select(...cohorts(courses(...)))` | WIRED | Nested select with cohorts.courses present lines 71-93 |
| `app/dashboard/page.tsx` | `public.profiles cohort-mate SELECT policy` | `.from('enrollments').select('cohort_id, user_id, profiles ( id, full_name, email )')` | WIRED | Query present lines 159-163; `.neq('user_id', user.id)` present |
| `app/dashboard/page.tsx` | `public.lesson_progress` | `.from('lesson_progress').select('lesson_id, completed').eq('completed', true)` | WIRED | Query present lines 95-98 |
| `app/dashboard/page.tsx` empty state | `/catalog route` | `<Link href="/catalog">Browse catalog →</Link>` | WIRED | Present line 199 |
| `Plan 02 key_link: catalog page → enrollInCohortAction directly` | `lib/actions/enrollment.actions.ts` | Expected: `action={enrollInCohortAction}` in catalog JSX | NOT_WIRED (deviated) | Catalog page uses EnrollButton instead of direct form action; action import is in EnrollButton, not catalog page |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/dashboard/page.tsx` | `enrollments` | `supabase.from('enrollments')...eq('user_id', user.id)` | Yes — DB query scoped to authenticated user | FLOWING |
| `app/dashboard/page.tsx` | `lessonsByCourse` | 2-step: modules by course_id, then lessons by module_id | Yes — real DB queries; two-step workaround for PostgREST .in() dot-path limitation | FLOWING |
| `app/dashboard/page.tsx` | `teammatesByCohort` | `.from('enrollments').select('profiles')...neq('user_id')` | Yes — DB query; seeded teammates will appear when RLS cohort-mate policy is active | FLOWING |
| `app/dashboard/page.tsx` | teammate `0%` / `—` display | Hardcoded `—` string | N/A — intentional per D-07 (teammate progress Phase 4+) | STATIC (intentional) |
| `app/catalog/[courseId]/page.tsx` | `enrolledCohortIds` | 4th Promise.all entry: `.from('enrollments').select('cohort_id').eq('user_id', user.id)` | Yes — real DB query; Set populated from result | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable local server without `npx supabase start` and `npm run dev`. Code-level checks substituted.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Migration file contains both required policies | `grep -c 'create policy' migration 00003` | 3 policies found (2 required + 1 bonus) | PASS |
| Seed contains all 4 teammate UUIDs | Grep for ...061, ...062, ...071, ...072 | All 4 found in supabase/seed.sql | PASS |
| enrollment.actions.ts has 'use server' as first line | Read file line 1 | `'use server'` confirmed | PASS |
| enrollInCohortAction handles 23505 | Grep for error.code === '23505' | Present line 88 | PASS |
| Dashboard has role="progressbar" with aria attributes | Grep for role="progressbar" | Found line 242 with aria-valuenow, aria-valuemin, aria-valuemax | PASS |
| Dashboard teammate percentage is `0%` | Read lines 270-274 | Renders `—` not `0%` | FAIL |
| Lesson RLS scoped to enrollment | Search all migrations for enrollment+lesson RLS | Not found in any migration | FAIL |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COHORT-01 | Plan 02 | User can view available cohorts for a course with start dates | SATISFIED | Catalog page renders cohort cards with `starts_at` formatted date and `max_seats` display; existing Phase 2 cohort SELECT RLS allows read |
| COHORT-02 | Plans 01, 02 | User can enroll in a scheduled cohort | SATISFIED | enrollInCohortAction writes to enrollments; RLS INSERT policy in migration 00003 allows it; EnrollButton wires the form |
| COHORT-03 | Plan 03 | User has a dashboard showing all enrolled cohorts with progress indicators | SATISFIED (partial) | Dashboard shows cohort cards with "{N} of {M} lessons complete" label and progress bar; teammate % shows `—` not `0%` but core requirement is met |
| COHORT-04 | Plans 01, 03 | User can see teammates in their cohort and their progress | SATISFIED (partial) | Teammate roster shows names via cohort-mate RLS policy; seeded Jane Doe + Alex Kim appear; progress display shows `—` not a percentage value |

All 4 COHORT requirements mapped to Phase 3 are claimed. The two partial satisfactions (COHORT-03 and COHORT-04) relate to the teammate percentage rendering gap.

**No orphaned requirements** — all 4 COHORT IDs are declared across the 3 plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/dashboard/page.tsx` | 271-273 | Hardcoded `—` for teammate progress percentage | Warning | Teammates rows do not display a percentage label as specified by UI-SPEC and must-have truth |
| `lib/actions/enrollment.actions.ts` | 85 | `console.error('[enrollInCohortAction] insert error:', ...)` | Info | Logging present; acceptable for server-side debug; will appear in Vercel function logs |
| `supabase/seed.sql` | 75, 81, 87 | `PLACEHOLDER_PLAYBACK_ID_*` in lesson video_url and mux_playback_id | Info | Pre-existing from Phase 2; not a Phase 3 issue; Phase 4 will wire real Mux IDs |

---

## Human Verification Required

### 1. SC-1: In-place Enrollment Reflection

**Test:** Sign in, navigate to `/catalog/[courseId]`, click "Join Cohort" on the May 2026 Cohort card.
**Expected:** SC-1 requires the "Enrolled" badge to appear in place of the Join Cohort button without leaving the page or triggering a full navigation.
**Why human:** The current EnrollButton uses `useActionState` but the action calls `redirect('/dashboard')` on success, causing a full navigation. Whether this satisfies the spirit of SC-1 ("immediately reflects in the UI") requires developer judgement. A code-level check cannot determine whether the redirect was intentionally accepted as the demo UX.

### 2. SC-5: Lesson Page Access Control for Unenrolled Users

**Test:** In Supabase Studio, authenticate as a user NOT enrolled in any cohort. Run: `SELECT id, title FROM public.lessons WHERE module_id IN (SELECT id FROM public.modules WHERE course_id = '00000000-0000-0000-0000-000000000010');`
**Expected per SC-5:** Zero rows returned (enrollment-scoped RLS blocks the read).
**Why human:** The current lesson RLS (`is_published = true`) will return 3 rows for any authenticated user. This SC is not met. Developer must decide: add an enrollment-scoped RLS policy now, or override SC-5 as a Phase 4 deliverable (when the lesson page is built).

### 3. Teammate Roster End-to-End

**Test:** After `npx supabase db reset`, sign up a new user, enroll in the May 2026 Cohort, visit `/dashboard`.
**Expected:** Cohort card shows "Jane Doe" and "Alex Kim" in the Teammates section.
**Why human:** The cohort-mate RLS EXISTS subquery has been verified in code but the actual Supabase RLS execution with the new "Users can view enrollments in their cohorts" policy (added to unblock the subquery) cannot be confirmed without a live database.

---

## Gaps Summary

**4 gaps identified; 3 are blockers for full ROADMAP SC compliance:**

**Gap 1 (ROADMAP SC-1 — BLOCKER):** The "immediately reflects without page reload" requirement from the ROADMAP is not satisfied. After clicking Join Cohort, the user is navigated to `/dashboard` via `redirect()`. The Enrolled badge only appears when the user returns to the catalog page. If the demo requires the badge to appear in-place, an optimistic client update must be added. If redirect is acceptable, ROADMAP SC-1 needs an override.

**Gap 2 (ROADMAP SC-5 — BLOCKER):** No enrollment-scoped RLS on the lessons table. Any authenticated user can read lesson data for any published course regardless of enrollment. Phase 3 ROADMAP explicitly requires this gate to be in place before Phase 4 builds the lesson page.

**Gap 3 (teammate percentage — WARNING):** The dashboard renders `—` (em dash) for each teammate's progress percentage instead of `0%`. The UI-SPEC copywriting contract and Plan 03 must-have truth both specify a percentage label. This is a minor fix (one-line change in dashboard template).

**Gap 4 (catalog page wiring pattern — INFO/PARTIAL):** The plan specified `enrollInCohortAction` imported directly in the catalog page with an inline `<form action={...}>`. The actual implementation uses an `EnrollButton` client component. This is functionally correct and arguably better (useActionState enables error display) but deviates from the plan's specified pattern and introduces a client component boundary into the Server Component page.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
