---
phase: 03-cohort-enrollment-learner-dashboard
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - lib/actions/enrollment.actions.ts
  - components/EnrollButton.tsx
  - app/dashboard/page.tsx
  - supabase/migrations/20260428000004_lesson_enrollment_rls.sql
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 03: Code Review Report (Gap-Closure Pass)

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four gap-closure files were reviewed: the enrollment server action, the new EnrollButton client component, the dashboard page, and the lessons RLS migration. The enrollment action and EnrollButton are largely well-structured — the `useActionState` wiring and duplicate-enrollment guard are correct in isolation — but three critical defects exist. The duplicate-enrollment path (23505) calls `redirect()` instead of returning `{ enrolled: true }`, so the EnrollButton badge never appears for already-enrolled users and a hard navigation away from the catalog fires unexpectedly. The seat-capacity check is a non-atomic read-then-write that can be raced. The new RLS lessons policy gates on enrollment existence but not enrollment status, so users with dropped or completed enrollments retain read access to lesson rows indefinitely. Three warnings cover the missing `revalidatePath('/dashboard')` on the success path, an unfiltered teammate query that surfaces dropped enrollees, and the hardcoded `'0%'` teammate progress stub that misrepresents real data. Two info items address minor type-safety and contract clarity.

---

## Critical Issues

### CR-01: Duplicate-enrollment path calls `redirect()` instead of returning `{ enrolled: true }` — EnrollButton badge never renders

**File:** `lib/actions/enrollment.actions.ts:89-91`

**Issue:** When the Postgres `INSERT` fails with `error.code === '23505'` (unique violation — user already enrolled), the action calls:

```ts
revalidatePath('/dashboard')
redirect('/dashboard')
```

`redirect()` in a Next.js Server Action throws a special `NEXT_REDIRECT` response that aborts execution and navigates the browser. Because it throws rather than returning, `useActionState` in `EnrollButton` never receives `{ enrolled: true }`. The consequence is two-fold:

1. If the user is on the catalog page and clicks "Join Cohort" a second time (or if the form is submitted on a fresh page load after an earlier enrollment), the action hard-navigates them to `/dashboard` instead of showing the "Enrolled" badge in-place — violating the in-place confirmation described in the component JSDoc and ROADMAP SC-1.
2. If the user was already enrolled and a re-render causes the form to appear (e.g., stale cache), the badge replacement never happens and the "Join Cohort" button remains indefinitely.

**Fix:**
```typescript
// lib/actions/enrollment.actions.ts  ~line 89
if (error.code === '23505') {
  revalidatePath('/dashboard')
  revalidatePath('/catalog')
  return { error: null, enrolled: true }   // return, do NOT redirect
}
```

---

### CR-02: Seat-capacity check is a non-atomic read-then-write — allows overbooking under concurrent requests

**File:** `lib/actions/enrollment.actions.ts:64-73`

**Issue:** The action reads the current enrollment count in one statement and inserts in a separate statement with no database-level serialization between them:

```ts
const { count } = await supabase
  .from('enrollments')
  .select('id', { count: 'exact', head: true })
  .eq('cohort_id', cohortId)
  .eq('status', 'active')

if ((count ?? 0) >= cohort.max_seats) {
  return { error: 'This cohort is full.' }
}
// ... then insert
```

Two concurrent requests that both read `count = max_seats - 1` will both pass the guard and both insert, producing `max_seats + 1` enrollments. For a demo with a tight seat limit this is a real risk. The `unique (user_id, cohort_id)` constraint on the `enrollments` table prevents the same user from double-enrolling, but does not prevent two different users from racing past the same seat count.

**Fix:** Move the capacity enforcement to the database layer using a `SECURITY DEFINER` RPC function that executes count-and-insert inside a single transaction with a `FOR UPDATE` lock:

```sql
-- supabase/functions/enroll_if_capacity.sql
create or replace function public.enroll_if_capacity(
  p_user_id   uuid,
  p_cohort_id uuid
) returns void language plpgsql security definer as $$
declare
  v_max integer;
  v_cur integer;
begin
  select max_seats into v_max
    from public.cohorts where id = p_cohort_id for update;
  select count(*) into v_cur
    from public.enrollments
    where cohort_id = p_cohort_id and status = 'active';
  if v_max > 0 and v_cur >= v_max then
    raise exception 'cohort_full';
  end if;
  insert into public.enrollments (user_id, cohort_id)
    values (p_user_id, p_cohort_id);
end;
$$;
```

Call via `supabase.rpc('enroll_if_capacity', { p_user_id: user.id, p_cohort_id: cohortId })` and handle the `cohort_full` exception as the seat-full error return.

---

### CR-03: Lessons RLS policy does not filter on `e.status = 'active'` — dropped and completed users retain lesson read access

**File:** `supabase/migrations/20260428000004_lesson_enrollment_rls.sql:28-40`

**Issue:** The new `"enrolled users can view lessons"` SELECT policy is:

```sql
using (
  exists (
    select 1
    from public.enrollments e
    join public.cohorts c on c.id = e.cohort_id
    join public.modules m on m.course_id = c.course_id
    where e.user_id = auth.uid()
      and m.id = lessons.module_id
  )
);
```

There is no `e.status = 'active'` predicate. The `enrollments` table has a `status` column with values `'active'`, `'dropped'`, `'completed'`. A learner whose enrollment is set to `'dropped'` retains a row in `enrollments`; the `EXISTS` subquery still matches and grants lesson access. The intent of the migration ("replace the permissive policy with an enrollment-scoped policy") is therefore not fulfilled for users whose enrollment has lapsed.

**Fix:**
```sql
create policy "enrolled users can view lessons"
  on public.lessons
  for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      join public.modules m on m.course_id = c.course_id
      where e.user_id  = auth.uid()
        and e.status   = 'active'          -- required
        and m.id       = lessons.module_id
    )
  );
```

---

## Warnings

### WR-01: Successful new enrollment does not call `revalidatePath('/dashboard')`

**File:** `lib/actions/enrollment.actions.ts:97-98`

**Issue:** The happy-path return on line 97 only revalidates `/catalog`:

```ts
revalidatePath('/catalog')
return { error: null, enrolled: true }
```

The duplicate-enrollment path (line 90) does call `revalidatePath('/dashboard')`, but the new-enrollment path does not. If the user navigates to `/dashboard` within Next.js's cache window after completing a fresh enrollment, the page will render the previously-cached result and show zero cohorts.

**Fix:**
```typescript
revalidatePath('/catalog')
revalidatePath('/dashboard')   // add
return { error: null, enrolled: true }
```

---

### WR-02: Teammate roster query has no `status = 'active'` filter — dropped learners appear as active teammates

**File:** `app/dashboard/page.tsx:159-170`

**Issue:** The teammates query:

```ts
await supabase
  .from('enrollments')
  .select('cohort_id, user_id, profiles ( id, full_name, email )')
  .in('cohort_id', cohortIds)
  .neq('user_id', user.id)
```

…has no `.eq('status', 'active')` filter. Users whose enrollment status is `'dropped'` or `'completed'` will still appear in the Teammates section. Additionally, the companion RLS policy in migration 00003 (`"Users can view enrollments in their cohorts"`) also lacks a status filter, so PostgREST will return those rows through the policy.

**Fix:**
```typescript
await supabase
  .from('enrollments')
  .select('cohort_id, user_id, profiles ( id, full_name, email )')
  .in('cohort_id', cohortIds)
  .neq('user_id', user.id)
  .eq('status', 'active')   // add
```

The RLS policy in migration 00003 should also be updated to add `and status = 'active'` in the `cohort_id in (select cohort_id from public.enrollments where user_id = auth.uid())` subquery.

---

### WR-03: Teammate progress hardcoded as `'0%'` — presents stale data as factual

**File:** `app/dashboard/page.tsx:272`

**Issue:**

```tsx
<span className="text-xs text-muted-foreground">
  0%
</span>
```

This is unconditionally rendered as the string `'0%'` for every teammate. Once any teammate completes a lesson the displayed value is wrong. There is no visual indicator to the user that this is a placeholder, so it reads as real progress data. This causes silent misinformation in the dashboard.

**Fix:** Replace the hardcoded value with a neutral placeholder until real per-teammate progress is fetched, to make the unimplemented state explicit rather than misleading:

```tsx
<span className="text-xs text-muted-foreground">
  {'—'}
</span>
```

Alternatively, omit the span entirely. Real teammate progress requires either a separate `lesson_progress` query scoped to cohort-member `user_id` values, or an aggregate view — both are out of scope until implemented.

---

## Info

### IN-01: `insert(enrollmentRow as never)` suppresses TypeScript type safety on the insert call

**File:** `lib/actions/enrollment.actions.ts:83`

**Issue:** `insert(enrollmentRow as never)` uses `as never` to silence a type mismatch between `TablesInsert<'enrollments'>` and the Supabase client's `.insert()` overload. This prevents TypeScript from catching future schema changes (e.g., a new `NOT NULL` column added to `enrollments`) that would make the insert fail at runtime. The `as never` cast is an unusually aggressive suppression.

**Fix:** Pass an object literal directly, which typically avoids the type inference conflict:

```typescript
const { error } = await supabase
  .from('enrollments')
  .insert({ user_id: user.id, cohort_id: cohortId })
```

If `TablesInsert<'enrollments'>` is genuinely misaligned, regenerate the types with `supabase gen types typescript --local` to confirm the schema matches the generated types, then remove the cast.

---

### IN-02: `enrolled?: boolean` optional type allows action returns without the field — tighten the contract

**File:** `lib/actions/enrollment.actions.ts:8-11` / `components/EnrollButton.tsx:19`

**Issue:** `EnrollmentActionResult` declares `enrolled` as optional (`enrolled?: boolean`). This means any return of `{ error: null }` without an `enrolled` key is type-valid, yet `state.enrolled` in `EnrollButton` would be `undefined` (falsy). The guard `if (state.enrolled)` still works correctly because `undefined` is falsy, but the loose type permits a future maintainer to add an early-return `{ error: null }` path that silently skips the badge. Making `enrolled` required makes the contract explicit.

**Fix:**
```typescript
// lib/actions/enrollment.actions.ts
export type EnrollmentActionResult = {
  error: string | null
  enrolled: boolean   // required, not optional
}
```

Update all return sites that omit `enrolled` to include it explicitly (e.g., the seat-capacity error return should become `{ error: 'This cohort is full.', enrolled: false }`).

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
