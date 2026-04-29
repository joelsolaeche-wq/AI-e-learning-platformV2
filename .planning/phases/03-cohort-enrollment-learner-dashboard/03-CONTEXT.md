# Phase 3: Cohort Enrollment + Learner Dashboard - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

An authenticated user can enroll in a cohort from the course detail page, be redirected to their dashboard, and see a cohort card with a progress bar and inline teammate list. Creating or managing cohorts, lesson playback, and quiz/AI features are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Enrollment action
- **D-01:** Wire up the existing disabled "Join Cohort" Button in `app/catalog/[courseId]/page.tsx` using a Server Action that writes to the `enrollments` table, then calls `redirect('/dashboard')`.
- **D-02:** No client component needed for enrollment — Server Action + redirect is sufficient. The dashboard page re-fetches on load and the new cohort card appears immediately.
- **D-03:** If a user is already enrolled in a cohort, the button should be replaced with a "Enrolled" badge (disabled state) — no double-enrollment error UX needed beyond this.

### Dashboard structure
- **D-04:** Single `/dashboard` page (all-in-one). No separate `/cohorts/[cohortId]` route. The existing `app/dashboard/page.tsx` skeleton is replaced with a full implementation.
- **D-05:** Cohort card layout: cohort title + status badge at top, progress bar ("0 of 3 lessons — 0%") below, teammate rows inside the same card, "Go to Course →" link at the bottom.
- **D-06:** Progress bar shows `completed_lessons / total_lessons` as a percentage. For Phase 3, lesson_progress rows won't exist yet (Phase 4 writes them), so the bar renders at 0% — that's correct and expected.

### Teammate display
- **D-07:** Per-teammate row shows: display name (or email prefix if no display_name) + a completion bar (e.g., "Jane █░░ 33%"). No avatar component needed.
- **D-08:** Teammates are fetched by joining `enrollments → profiles` scoped to the same `cohort_id`, excluding the current user.

### Seed data
- **D-09:** Add 2–3 fake teammate profile rows to `supabase/seed.sql` with fixed UUIDs and display names. Add matching `enrollments` rows for the same cohort. No real auth accounts needed — DB rows only. RLS must allow the logged-in user to read cohort-mates' profiles via a shared enrollment.

### Claude's Discretion
- Enrollment Server Action file location (e.g., `app/catalog/[courseId]/actions.ts` or `lib/actions/enrollment.ts`)
- RLS policy wording for the profiles-via-enrollment read (researcher will determine exact policy)
- Progress bar visual implementation (CSS width percentage, Tailwind classes)
- Empty state when user has no enrolled cohorts ("No cohorts yet — browse the catalog")
- Error state when enrollment fails (toast or inline error message)

</decisions>

<specifics>
## Specific Ideas

- The course detail page already has the cohort cards with a disabled "Join Cohort" Button — Phase 3 enables this button, no layout changes needed to that page.
- Dashboard aesthetic should match the dark/premium Linear/Vercel feel already established. Cohort cards use the existing `Card`, `CardHeader`, `CardContent` components.
- "0 of 3 lessons complete" wording preferred over raw percentages for the user-facing progress label.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and success criteria
- `.planning/ROADMAP.md` §Phase 3 — Enrollment success criteria (SC-1 through SC-5), including RLS requirement that unenrolled users cannot access lesson pages

### Existing code to modify
- `app/catalog/[courseId]/page.tsx` — Contains the disabled "Join Cohort" Button in the cohorts section that Phase 3 wires up
- `app/dashboard/page.tsx` — Skeleton with placeholder text; Phase 3 replaces this entirely

### Data layer
- `supabase/seed.sql` — Needs teammate profile rows + enrollment rows added
- `lib/database.types.ts` — TypeScript types for enrollments, profiles, lesson_progress tables

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/card.tsx` (Card, CardContent, CardHeader): Used for cohort cards in course detail page — reuse exact same pattern on dashboard
- `components/ui/badge.tsx` (Badge): Used for cohort status display in course detail — reuse for "active" / "enrolled" badges
- `components/ui/button.tsx` (Button): The disabled "Join Cohort" button exists in the course detail page — enable it with a form action
- `components/ui/skeleton.tsx`: Available for loading states if needed
- `components/ui/separator.tsx`: Used in course detail between sections

### Established Patterns
- Server Components only (no `"use client"` in any page yet) — enrollment via Server Action keeps this pattern
- `createClient()` + `await supabase.auth.getUser()` + `redirect('/auth/login')` — belt-and-suspenders auth check on every page
- `Promise.all([...])` for parallel Supabase queries — use same pattern for dashboard's multi-table fetch
- Explicit TypeScript type aliases for Supabase discriminated unions (e.g., `type EnrollmentRow = Pick<Database['public']['Tables']['enrollments']['Row'], ...>`)
- Fixed UUIDs in seed.sql with `ON CONFLICT (id) DO NOTHING` — extend for teammate profiles

### Integration Points
- Enrollment writes to `enrollments(user_id, cohort_id, enrolled_at)` — cohort_id comes from the course detail page URL/card
- Dashboard queries: `enrollments → cohorts → courses` for the user's cohorts; `enrollments → profiles` for teammates scoped to same cohort; `lesson_progress` for completion counts (will be 0 in Phase 3)
- Middleware already protects `/dashboard` — no additional middleware changes needed

</code_context>

<deferred>
## Deferred Ideas

- Realtime progress updates via Supabase Realtime subscription — page reload is sufficient for Phase 3; Realtime is a Phase 4+ concern
- Dedicated `/cohorts/[cohortId]` page — all-in-one dashboard is sufficient for demo scope
- Avatar/initials component for teammate display — name + progress bar is sufficient
- Multi-cohort enrollment — out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 03-cohort-enrollment-learner-dashboard*
*Context gathered: 2026-04-28*
