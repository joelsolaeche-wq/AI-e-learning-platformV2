# Phase 3: Cohort Enrollment + Learner Dashboard — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/actions/enrollment.actions.ts` | service / Server Action | request-response (CRUD insert + redirect) | `lib/actions/auth.actions.ts` | exact |
| `app/catalog/[courseId]/page.tsx` | route (page) | request-response (CRUD read + form render) | `app/catalog/[courseId]/page.tsx` (self — modify) | self |
| `app/dashboard/page.tsx` | route (page) | request-response (multi-table CRUD read) | `app/catalog/[courseId]/page.tsx` | exact |
| `supabase/seed.sql` | config / seed | batch (idempotent inserts) | `supabase/seed.sql` (self — extend) | self |
| `supabase/migrations/20260428000003_enrollment_rls.sql` | migration | CRUD + policy | `supabase/migrations/20260428000002_create_remaining_tables.sql` | exact |

---

## Pattern Assignments

### `lib/actions/enrollment.actions.ts` (Server Action, request-response)

**Analog:** `lib/actions/auth.actions.ts`

**Imports pattern** (lines 1–6):
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
```

**Return type pattern** (lines 7–9):
```typescript
export type EnrollmentActionResult = {
  error: string | null
}
```

**Core Server Action pattern** (lines 11–40 of analog, adapted):
```typescript
export async function enrollInCohortAction(
  _prevState: EnrollmentActionResult,
  formData: FormData
): Promise<EnrollmentActionResult> {
  const cohortId = formData.get('cohort_id') as string

  if (!cohortId) {
    return { error: 'Cohort ID is required.' }
  }

  const supabase = await createClient()

  // Auth guard inside the action — never trust the caller
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase
    .from('enrollments')
    .insert({ user_id: user.id, cohort_id: cohortId })

  if (error) {
    // Unique constraint violation = already enrolled — silently redirect
    if (error.code === '23505') {
      redirect('/dashboard')
    }
    return { error: 'Couldn\'t enroll — try again' }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
```

**Error handling pattern** (lines 35–40 of analog):
```typescript
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
```

---

### `app/catalog/[courseId]/page.tsx` (route modification — enable Join Cohort button)

**Analog:** Self (existing file being modified). Key patterns to preserve.

**Existing type alias pattern** (lines 9–27):
```typescript
type CohortRow = Pick<
  Database['public']['Tables']['cohorts']['Row'],
  'id' | 'title' | 'starts_at' | 'ends_at' | 'max_seats' | 'status'
>
```

**Enrollment check query** — add to the existing `Promise.all` block (lines 43–72):
```typescript
// Add fourth query to check existing enrollment
const [courseResult, modulesResult, cohortsResult, enrollmentsResult] = await Promise.all([
  // ... existing three queries unchanged ...
  supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('user_id', user.id),
])

const enrolledCohortIds = new Set(
  (enrollmentsResult.data ?? []).map((e) => e.cohort_id)
)
```

**Join Cohort button — current disabled state** (lines 196–198):
```tsx
{/* Phase 2: button present, enrollment wired in Phase 3 */}
<Button size="sm" disabled>
  Join Cohort
</Button>
```

**Join Cohort button — Phase 3 replacement pattern** (form action wrapping existing Button):
```tsx
{enrolledCohortIds.has(cohort.id) ? (
  <Badge variant="secondary">Enrolled</Badge>
) : (
  <form action={enrollInCohortAction}>
    <input type="hidden" name="cohort_id" value={cohort.id} />
    <Button size="sm" type="submit">
      Join Cohort
    </Button>
  </form>
)}
```

**Import additions needed:**
```typescript
import { enrollInCohortAction } from '@/lib/actions/enrollment.actions'
// EnrollmentRow type:
type EnrollmentCohortId = Pick<
  Database['public']['Tables']['enrollments']['Row'],
  'cohort_id'
>
```

---

### `app/dashboard/page.tsx` (route — full replacement, CRUD read)

**Analog:** `app/catalog/[courseId]/page.tsx` — same role, same data flow pattern.

**Imports pattern** (lines 1–7 of analog):
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Database } from '@/lib/database.types'
```

**Auth guard pattern** (lines 36–40 of analog):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/auth/login')
```

**Parallel multi-table fetch pattern** (lines 43–72 of analog):
```typescript
const [enrollmentsResult, progressResult] = await Promise.all([
  supabase
    .from('enrollments')
    .select(`
      id,
      cohort_id,
      enrolled_at,
      status,
      cohorts (
        id,
        title,
        status,
        starts_at,
        course_id,
        courses (
          id,
          title,
          slug
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active'),

  supabase
    .from('lesson_progress')
    .select('lesson_id, completed')
    .eq('user_id', user.id)
    .eq('completed', true),
])
```

**Explicit type alias pattern** (lines 9–27 of analog):
```typescript
type EnrollmentWithCohort = Pick<
  Database['public']['Tables']['enrollments']['Row'],
  'id' | 'cohort_id' | 'enrolled_at' | 'status'
> & {
  cohorts: (Pick<
    Database['public']['Tables']['cohorts']['Row'],
    'id' | 'title' | 'status' | 'starts_at' | 'course_id'
  > & {
    courses: Pick<
      Database['public']['Tables']['courses']['Row'],
      'id' | 'title' | 'slug'
    > | null
  }) | null
}

type TeammateRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email'
>
```

**Data cast pattern** (lines 75–76 of analog):
```typescript
const enrollments: EnrollmentWithCohort[] =
  (enrollmentsResult.data as EnrollmentWithCohort[] | null) ?? []
```

**Page layout pattern** (lines 88 of analog — max-width + spacing):
```tsx
<main className="mx-auto w-full max-w-[896px] px-8 pt-12 pb-16 space-y-8">
```

**Cohort card pattern** (lines 168–204 of analog — reuse exact Card structure):
```tsx
<Card key={cohort.id} className="border-border bg-card">
  <CardHeader className="p-4 pb-2">
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold">{cohort.title}</h3>
      <Badge variant={cohort.status === 'active' ? 'default' : 'secondary'} className="capitalize">
        {cohort.status}
      </Badge>
    </div>
  </CardHeader>
  <CardContent className="px-4 pb-4">
    {/* progress bar + teammate rows + "Go to Course →" link */}
  </CardContent>
</Card>
```

**Progress bar pattern** (UI-SPEC interaction patterns — CSS width on muted track):
```tsx
{/* Progress bar — bg-muted track, bg-primary fill, h-1.5 */}
<div className="mt-2">
  <p className="text-xs text-muted-foreground mb-1">
    {completedCount} of {totalLessons} lessons complete
  </p>
  <div
    className="h-1.5 w-full rounded-full bg-muted"
    role="progressbar"
    aria-label={`Lesson progress: ${completedCount} of ${totalLessons} complete`}
    aria-valuenow={pct}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div
      className="h-1.5 rounded-full bg-primary transition-all"
      style={{ width: `${pct}%` }}
    />
  </div>
</div>
```

**Teammate row pattern** (UI-SPEC D-07 + layout contract):
```tsx
{/* Teammate row — name · pct%, inline progress bar h-1 */}
<div className="flex items-center justify-between gap-4 py-1">
  <span className="text-sm">
    {teammate.full_name ?? teammate.email.split('@')[0]}
  </span>
  <span className="text-xs text-muted-foreground">{teammatePct}%</span>
</div>
```

**Empty state pattern** (UI-SPEC copywriting + centered stack):
```tsx
{enrollments.length === 0 && (
  <div className="flex flex-col items-center gap-4 py-16 text-center">
    <h2 className="text-lg font-semibold">No cohorts yet</h2>
    <p className="text-sm text-muted-foreground">
      Browse the catalog to find your team&apos;s AI course.
    </p>
    <Button variant="ghost" asChild>
      <Link href="/catalog">Browse catalog →</Link>
    </Button>
  </div>
)}
```

**Teammate fetch pattern** (separate per-cohort query using already-fetched cohort_ids):
```typescript
// After main Promise.all, fetch teammates for each enrolled cohort
const cohortIds = enrollments.map((e) => e.cohort_id)
const { data: teammatesData } = cohortIds.length > 0
  ? await supabase
      .from('enrollments')
      .select('cohort_id, profiles ( id, full_name, email )')
      .in('cohort_id', cohortIds)
      .neq('user_id', user.id)
  : { data: [] }
```

---

### `supabase/seed.sql` (config — extend with teammate profiles + enrollments)

**Analog:** `supabase/seed.sql` (self — extending the established pattern).

**Fixed UUID + ON CONFLICT pattern** (lines 16–22 of seed.sql):
```sql
insert into public.organizations (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'Taller Technologies',
  'taller-technologies'
)
on conflict (id) do nothing;
```

**Teammate profile rows to add** — note `profiles.id` must be a valid `auth.users` UUID.
Because seed.sql deliberately avoids auth.users rows (line 7–9), teammate profiles use
fixed fake UUIDs that reference non-existent auth.users rows. This requires temporarily
disabling the FK constraint or inserting into `auth.users` first, OR using a seeding
approach that inserts profiles only (requires FK deferrability). Pattern decision for planner:
either insert stub `auth.users` rows first, or note this in plan as requiring `auth.users` seed rows.

**Enrollment rows to add** — follow existing cohort UUID `00000000-0000-0000-0000-000000000050`:
```sql
-- Teammate profiles (fake UUIDs — require matching auth.users rows)
insert into public.profiles (id, email, full_name, role, org_id)
values
  (
    '00000000-0000-0000-0000-000000000061',
    'jane.doe@tallertechnologies.net',
    'Jane Doe',
    'learner',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000062',
    'alex.kim@tallertechnologies.net',
    'Alex Kim',
    'learner',
    '00000000-0000-0000-0000-000000000001'
  )
on conflict (id) do nothing;

-- Teammate enrollments in the May 2026 Cohort
insert into public.enrollments (id, user_id, cohort_id, status)
values
  (
    '00000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000050',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000072',
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000050',
    'active'
  )
on conflict (id) do nothing;
```

---

### `supabase/migrations/20260428000003_enrollment_rls.sql` (migration — RLS policies)

**Analog:** `supabase/migrations/20260428000002_create_remaining_tables.sql`

**RLS enable + policy pattern** (lines 250–258 of analog):
```sql
alter table public.enrollments enable row level security;

create policy "Users can view their own enrollments"
  on public.enrollments
  for select
  using (auth.uid() = user_id);
```

**INSERT policy pattern** (lines 270–273 of analog):
```sql
create policy "Users can insert their own lesson progress"
  on public.lesson_progress
  for insert
  with check (auth.uid() = user_id);
```

**New policies needed for Phase 3:**
```sql
-- INSERT: user can enroll themselves only
create policy "Users can insert their own enrollments"
  on public.enrollments
  for insert
  with check (auth.uid() = user_id);

-- SELECT on profiles: user can read cohort-mate profiles via shared enrollment
create policy "Users can view profiles of cohort-mates"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.enrollments e1
      join public.enrollments e2 on e2.cohort_id = e1.cohort_id
      where e1.user_id = auth.uid()
        and e2.user_id = profiles.id
    )
  );
```

**Existing enrollment SELECT policy** — already exists in migration 00002 as
`"Users can view their own enrollments"`. Phase 3 only adds the INSERT policy and the
profiles cohort-mate policy.

---

## Shared Patterns

### Auth Guard
**Source:** `app/catalog/[courseId]/page.tsx` lines 36–40, `lib/actions/auth.actions.ts` lines 24–25
**Apply to:** `app/dashboard/page.tsx`, `lib/actions/enrollment.actions.ts`
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/auth/login')
```

### Parallel Supabase Queries
**Source:** `app/catalog/[courseId]/page.tsx` lines 43–72
**Apply to:** `app/dashboard/page.tsx`
```typescript
const [result1, result2, result3] = await Promise.all([
  supabase.from('...').select('...').eq('...', value),
  supabase.from('...').select('...').eq('...', value),
  supabase.from('...').select('...').eq('...', value),
])
```

### Explicit TypeScript Type Aliases (Supabase discriminated union)
**Source:** `app/catalog/[courseId]/page.tsx` lines 9–27
**Apply to:** `app/dashboard/page.tsx`, `lib/actions/enrollment.actions.ts`
```typescript
type FooRow = Pick<
  Database['public']['Tables']['table_name']['Row'],
  'col1' | 'col2'
>
// Then cast after fetch:
const rows: FooRow[] = (result.data as FooRow[] | null) ?? []
```

### Server Action File Convention
**Source:** `lib/actions/auth.actions.ts` lines 1–9
**Apply to:** `lib/actions/enrollment.actions.ts`
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type XxxActionResult = {
  error: string | null
}
```

### Idempotent Seed Rows
**Source:** `supabase/seed.sql` lines 16–22
**Apply to:** teammate profile + enrollment additions in `supabase/seed.sql`
```sql
insert into public.table_name (id, col1, col2)
values ('00000000-0000-0000-0000-000000000XXX', 'val1', 'val2')
on conflict (id) do nothing;
```

### RLS Policy Structure
**Source:** `supabase/migrations/20260428000002_create_remaining_tables.sql` lines 250–295
**Apply to:** `supabase/migrations/20260428000003_enrollment_rls.sql`
```sql
-- Named descriptively: "Users can [action] their own [resource]"
create policy "Users can insert their own enrollments"
  on public.enrollments
  for insert
  with check (auth.uid() = user_id);
```

---

## No Analog Found

No files in this phase lack a codebase analog. All five files have strong exact or self matches.

| File | Reason |
|------|--------|
| — | — |

---

## Metadata

**Analog search scope:** `app/`, `lib/`, `supabase/migrations/`, `supabase/seed.sql`
**Files scanned:** 12 source files + 2 migration files
**Pattern extraction date:** 2026-04-28

**Key flags for planner:**
1. No Server Actions exist yet for non-auth mutations — `enrollment.actions.ts` will be the first. Follow `auth.actions.ts` exactly.
2. `profiles.id` is a FK to `auth.users.id` — seed.sql teammate profiles require `auth.users` stub rows inserted first. Planner must address this in the seed plan step.
3. The existing enrollment SELECT RLS policy (`"Users can view their own enrollments"`) in migration 00002 is sufficient for reading the current user's enrollments. Phase 3 only needs to ADD an INSERT policy for `enrollments` and a new SELECT policy on `profiles` for cohort-mate visibility.
4. `enrollments` table already has `unique (user_id, cohort_id)` — double-enrollment is blocked at DB layer. Action should catch error code `23505` and redirect silently (D-03).
