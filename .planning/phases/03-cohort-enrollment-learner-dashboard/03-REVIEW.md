---
phase: 03-cohort-enrollment-learner-dashboard
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - supabase/migrations/20260428000003_enrollment_rls.sql
  - supabase/seed.sql
  - lib/actions/enrollment.actions.ts
  - app/catalog/[courseId]/page.tsx
  - app/dashboard/page.tsx
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 3 delivers cohort enrollment (a Server Action + RLS migration) and a learner dashboard page. The enrollment action itself is clean and the RLS self-enrollment policy is correct. However, four critical defects were found: a conflicting SELECT policy that makes the teammate query silently return zero rows, a broken lesson-filter query that will always be empty (causing every course to show 0% progress), an open enrollment flow that never checks seat capacity, and the enrollment form bypassing the Server Action signature contract in a way that swallows all error feedback. Five additional warnings cover a missing SELECT policy on enrollments for the dashboard, a hardcoded `"0%"` teammate-progress label, seat-count display copy showing total seats rather than available seats, a missing `notFound()` guard on modules/cohorts query errors, and a missing `moduleIdx` variable usage. Three informational items are also noted.

---

## Critical Issues

### CR-01: RLS conflict — new `profiles` SELECT policy overlaps with existing one, causing teammate query to return no rows

**File:** `supabase/migrations/20260428000003_enrollment_rls.sql:26-38`

**Issue:** Migration 00001 already creates a `"Users can view their own profile"` SELECT policy on `public.profiles`. In Supabase/PostgreSQL, multiple permissive SELECT policies are OR-combined at query time. That means the new cohort-mate policy is additive with respect to the current user's own row, which is fine. However, the real problem is in `app/dashboard/page.tsx` line 146: the teammate query uses `.select('cohort_id, user_id, profiles ( id, full_name, email )')` — this is a **join** that reads each teammate's profile row. The reading user is the current user, so `auth.uid()` is their own ID; the profile row being read belongs to the teammate. Under the original migration-00001 policy (`auth.uid() = id`) those rows are **blocked** unless the new cohort-mate policy fires. The new policy fires only if there is a matching pair of enrollment rows (`e1.user_id = auth.uid()` and `e2.user_id = profiles.id`). This part is logically correct.

The actual bug is that `public.enrollments` has **no SELECT policy that allows the current user to read other users' enrollment rows**. The only enrollments SELECT policy is `"Users can view their own enrollments"` (`auth.uid() = user_id`). The subquery inside the cohort-mate profiles policy (`select 1 from public.enrollments e1 join public.enrollments e2 …`) runs in the security context of the calling user and is therefore subject to RLS on `enrollments`. `e2.user_id = profiles.id` is a teammate row — `auth.uid() ≠ e2.user_id` — so that row is filtered out by the `enrollments` SELECT policy before the join can match. The EXISTS subquery always returns false, the policy never grants access, and the teammate profiles query returns empty.

**Fix:** Add a SELECT policy on `enrollments` that allows a user to read enrollment rows for cohorts they are themselves enrolled in:

```sql
create policy "Users can view enrollments in their cohorts"
  on public.enrollments
  for select
  using (
    cohort_id in (
      select cohort_id
      from public.enrollments
      where user_id = auth.uid()
    )
  );
```

Note: this policy references `enrollments` recursively. Postgres evaluates it with the original security context using the policy it already matched for the current user's own rows, so the self-reference is safe (Supabase documents this pattern for cohort/team use cases).

---

### CR-02: Lesson progress query is broken — `in('modules.course_id', courseIds)` does not filter via the joined relation

**File:** `app/dashboard/page.tsx:125-126`

**Issue:** The query to count total lessons per course is:

```ts
supabase
  .from('lessons')
  .select('id, module_id, modules!inner(course_id)')
  .in('modules.course_id', courseIds)
```

The `.in('modules.course_id', courseIds)` call passes a **dotted column path** as the column name. PostgREST / Supabase JS client v2 does **not** support filtering on a joined relation's column via `.in()` using dot notation — that syntax is only valid for `.select()` column aliases. The filter is silently ignored, so `lessonsData` returns **all lessons in the database** (for every course), not just those belonging to the user's enrolled courses. The grouping logic on lines 131–138 then works correctly on that full set, but for a large catalog this is also a correctness issue: if two courses happen to share the same lesson (which cannot happen here due to FK constraints, but the intent is still wrong).

More practically: the filter being ignored means `lessonsByCourse` is populated from all lessons, so `totalLessons` and `completedCount` will be correct only by accident when the seed data has one course. In any multi-course deployment `totalLessons` counts all lessons platform-wide per course, inflating the denominator and making progress always appear lower than it is.

**Fix:** Use a server-side subquery approach or filter after the join using an RPC, or restructure the query to filter by `module_id` in a subquery:

```ts
// Fetch module ids belonging to the enrolled courses first
const { data: moduleData } = await supabase
  .from('modules')
  .select('id, course_id')
  .in('course_id', courseIds)

const moduleIds = (moduleData ?? []).map((m) => m.id)
const moduleToCourse = new Map(
  (moduleData ?? []).map((m) => [m.id, m.course_id])
)

const { data: lessonsData } = await supabase
  .from('lessons')
  .select('id, module_id')
  .in('module_id', moduleIds)
```

Then group by `moduleToCourse.get(row.module_id)` instead of `row.modules?.course_id`.

---

### CR-03: Enrollment action accepts any `cohort_id` without validating seat availability or cohort status

**File:** `lib/actions/enrollment.actions.ts:48-66`

**Issue:** `enrollInCohortAction` inserts an enrollment row for any `cohort_id` the client submits. There is no server-side check that:
1. The cohort exists and has `status = 'active'` (a user could enroll in a `'draft'` or `'cancelled'` cohort by forging the form value).
2. The current seat count is below `max_seats` (when `max_seats > 0`). The RLS INSERT policy only checks `auth.uid() = user_id` — it does not guard on cohort state or capacity.

An attacker (or a race condition in the demo) can bypass seat limits entirely by POSTing directly to the Server Action endpoint with a valid `cohort_id`.

**Fix:** Add a guard before the insert:

```ts
// Validate cohort exists, is active, and has capacity
const { data: cohort, error: cohortError } = await supabase
  .from('cohorts')
  .select('id, status, max_seats')
  .eq('id', cohortId)
  .single()

if (cohortError || !cohort) {
  return { error: 'Cohort not found.' }
}
if (cohort.status !== 'active') {
  return { error: 'This cohort is not open for enrollment.' }
}
if (cohort.max_seats > 0) {
  const { count } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  if ((count ?? 0) >= cohort.max_seats) {
    return { error: 'This cohort is full.' }
  }
}
```

---

### CR-04: Enrollment form bypasses the Server Action `_prevState` contract — errors are never surfaced to the user

**File:** `app/catalog/[courseId]/page.tsx:208`

**Issue:** The form wires the action as:

```tsx
<form action={enrollInCohortAction.bind(null, { error: null }) as (formData: FormData) => void}>
```

`enrollInCohortAction` has the signature `(_prevState, formData) => Promise<EnrollmentActionResult>`. Using `.bind(null, { error: null })` pre-fills `_prevState` and produces a function of arity 1 (`(formData) => Promise<EnrollmentActionResult>`), which Next.js accepts as a form action. However, the return value `EnrollmentActionResult` containing `{ error: "Couldn't enroll — try again" }` is **never consumed**. There is no `useFormState` / `useActionState` call, no error boundary, and no mechanism to display the returned error string to the user. On any non-23505 DB error (network blip, constraint violation, unexpected Supabase error) the user sees nothing — the form silently fails.

This is a blocker because the demo walkthrough requirement is "every click must work" — if enrollment fails the user is stuck with no feedback and no retry path.

**Fix:** Convert the cohort card to a client component using `useActionState` (React 19 / Next.js 15):

```tsx
'use client'
import { useActionState } from 'react'
import { enrollInCohortAction } from '@/lib/actions/enrollment.actions'

export function EnrollButton({ cohortId }: { cohortId: string }) {
  const [state, formAction] = useActionState(enrollInCohortAction, { error: null })

  return (
    <form action={formAction}>
      <input type="hidden" name="cohort_id" value={cohortId} />
      {state.error && (
        <p className="text-xs text-destructive mb-1">{state.error}</p>
      )}
      <Button size="sm" type="submit">Join Cohort</Button>
    </form>
  )
}
```

---

## Warnings

### WR-01: Missing SELECT policy on `enrollments` for the dashboard teammate query

**File:** `supabase/migrations/20260428000003_enrollment_rls.sql` (missing addition)

**Issue:** `app/dashboard/page.tsx` line 146 queries `enrollments` filtering by `cohort_id in (cohortIds)` and `user_id != current_user`. The only SELECT policy on `enrollments` (from migration 00002) is `auth.uid() = user_id`. Rows where `user_id` is a teammate are blocked. The dashboard teammate section will always be empty even if the cohort-mate profiles policy is fixed (see CR-01), because the enrollment rows for teammates cannot be read at all.

This is partially covered by CR-01 but is a distinct policy gap that needs its own fix in the migration file. See the fix proposed in CR-01.

---

### WR-02: Teammate progress is hardcoded as `"0%"` — misleading for any real user

**File:** `app/dashboard/page.tsx:258`

**Issue:**

```tsx
<span className="text-xs text-muted-foreground">
  0%
</span>
```

The teammate's lesson progress is hardcoded to `"0%"` unconditionally. This will display incorrect data for any real teammate who has completed lessons — including the seeded teammates once their lesson_progress rows exist. This is not a placeholder comment; the UI presents it as live data.

**Fix:** Either fetch `lesson_progress` for all cohort members (gated by RLS, which already allows users to view their own progress; a separate per-user progress query or aggregated view would be needed), or label it honestly as "progress unavailable" until the data is fetched. At minimum remove the hardcoded value and show a dash or skeleton.

---

### WR-03: Seat count display says "N seats available" but shows `max_seats` (total), not remaining

**File:** `app/catalog/[courseId]/page.tsx:201-203`

**Issue:**

```tsx
{cohort.max_seats > 0 && (
  <p>{cohort.max_seats} seats available</p>
)}
```

`max_seats` is the capacity ceiling, not the number of open seats. As users enroll, this number stays static at the total. A full cohort will still show "20 seats available". The copy is factually wrong once any enrollment exists.

**Fix:** Either fetch the current enrollment count per cohort and compute `max_seats - enrolledCount`, or change the label to "Up to {max_seats} seats" to accurately reflect that it is a capacity, not remaining availability.

---

### WR-04: `modulesResult.error` is never checked before rendering modules

**File:** `app/catalog/[courseId]/page.tsx:81`

**Issue:** After the parallel fetch, `cohortsResult.error` and `modulesResult.error` are never inspected. Only `courseResult.error` is checked (line 91). If the modules or cohorts query fails (transient DB error, RLS denial, network timeout), the page silently renders with empty sections rather than surfacing a meaningful error to the user or triggering a 500.

**Fix:**

```ts
if (modulesResult.error) {
  // Log server-side; render graceful degradation or throw
  console.error('modules fetch error', modulesResult.error)
}
if (cohortsResult.error) {
  console.error('cohorts fetch error', cohortsResult.error)
}
```

At minimum log the errors server-side so they appear in Vercel function logs.

---

### WR-05: `moduleIdx` variable is declared but the separator logic is fragile

**File:** `app/catalog/[courseId]/page.tsx:136, 161`

**Issue:** The `moduleIdx` variable in `modules.map((module, moduleIdx) => ...)` is used at line 161 to render a `<Separator>` between module cards:

```tsx
{moduleIdx < modules.length - 1 && <Separator className="mt-6" />}
```

This is fine functionally, but there is also a top-level `<Separator />` at line 167 that unconditionally renders after the entire modules section, creating a double separator if `modules.length > 0` — the last module renders no inner separator, then the outer separator fires. The visual result is two separators in a row (the outer one after modules, and the one after the cohorts section header). Low-severity visual defect but inconsistent with the Linear-style design goal.

**Fix:** Remove the outer `<Separator />` at line 167, or remove the inner conditional at line 161 and keep only the outer separator.

---

## Info

### IN-01: `insert … as never` type cast suppresses compile-time type safety

**File:** `lib/actions/enrollment.actions.ts:55`

**Issue:**

```ts
const { error } = await supabase
  .from('enrollments')
  .insert(enrollmentRow as never)
```

The `as never` cast works around a typing mismatch but disables TypeScript's ability to catch future schema changes that would break this insert. The root cause is likely the `TablesInsert<'enrollments'>` type being slightly mismatched with what `supabase-js` expects internally (a known issue with Supabase's generated types and the JS client's overloads). Use `as unknown as Parameters<...>[0]` if a cast is truly needed, or better, remove the cast and fix the underlying type if the generated types are correct.

**Fix:** Replace `as never` with a specific cast or remove it entirely:

```ts
const { error } = await supabase
  .from('enrollments')
  .insert({ user_id: user.id, cohort_id: cohortId })
```

Passing the object literal directly often avoids the type mismatch.

---

### IN-02: `displayName` falls back to email prefix without sanitization

**File:** `app/dashboard/page.tsx:51-54`

**Issue:**

```ts
function displayName(p: TeammateProfile): string {
  if (p.full_name && p.full_name.trim().length > 0) return p.full_name
  return p.email.split('@')[0]
}
```

`p.email` comes from the `profiles` table, which is populated from `auth.users.email`. It is not user-controlled at this layer, so the risk is low. However, if `p.email` is somehow null (profiles email column is `NOT NULL` but the TypeScript type is `string`, not `string | null`, so this is consistent) the `.split()` call would throw. The type is consistent here — no immediate bug — but worth noting for robustness.

**Fix:** No immediate change needed. Acceptable as-is given the NOT NULL DB constraint.

---

### IN-03: Seed auth.users rows use empty string for `encrypted_password`

**File:** `supabase/seed.sql:200, 215`

**Issue:** The stub auth.users rows for Jane Doe and Alex Kim have `encrypted_password = ''`. Supabase's auth system will not allow password-based login for these accounts (bcrypt hashes are never empty strings), which is intentional for seed-only demo accounts. However, if someone accidentally tries to use these emails to sign up via the normal flow, the trigger will hit a `unique (email)` violation on `auth.users` and the sign-up will fail with a confusing error. A code comment would help clarify intent; more importantly, the seed should consider using a properly hashed placeholder or setting `is_sso_user = true` to make it clear these are not real accounts.

**Fix:** Add a comment; optionally set `is_anonymous = true` or use a different dummy email domain that is clearly not real:

```sql
-- These are display-only seed accounts. Login is intentionally disabled
-- (empty encrypted_password). Do not attempt to authenticate as these users.
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
