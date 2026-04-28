---
phase: 03-cohort-enrollment-learner-dashboard
plan: "01"
subsystem: database
tags: [rls, enrollment, profiles, seed, supabase]
dependency_graph:
  requires: []
  provides:
    - INSERT policy on public.enrollments (Users can insert their own enrollments)
    - SELECT policy on public.profiles (Users can view profiles of cohort-mates)
    - Teammate seed rows (Jane Doe, Alex Kim, cohort ...050)
  affects:
    - lib/actions/enrollment.actions.ts (Plan 02) — unblocked by INSERT policy
    - app/dashboard/page.tsx (Plan 03) — unblocked by cohort-mate SELECT policy + seed
tech_stack:
  added: []
  patterns:
    - RLS policy: EXISTS subquery joining enrollments e1/e2 on cohort_id for cross-entity reads
    - Seed pattern: auth.users stub rows (empty encrypted_password) before profiles FK insert
key_files:
  created:
    - supabase/migrations/20260428000003_enrollment_rls.sql
  modified:
    - supabase/seed.sql
decisions:
  - Use OR-based SELECT policy on profiles (Postgres allows multiple SELECT policies that OR together — new policy adds cohort-mate branch without replacing "Users can view their own profile" from migration 00001)
  - Empty encrypted_password on seed auth.users stubs — accounts cannot log in, exist only to satisfy FK constraint (per D-09: DB rows only, no real auth accounts)
metrics:
  duration: "~5 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 3 Plan 01: Enrollment RLS + Teammate Seed Summary

RLS policies enabling self-enrollment into cohorts and cross-cohort teammate profile reads, plus seed data for two non-loginable teammate accounts in the May 2026 Cohort.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create migration 20260428000003_enrollment_rls.sql | 853e00e | supabase/migrations/20260428000003_enrollment_rls.sql (38 lines) |
| 2 | Extend seed.sql with teammate auth.users + profiles + enrollments | 24d7239 | supabase/seed.sql (+98 lines) |

## Files Created / Modified

### supabase/migrations/20260428000003_enrollment_rls.sql (new, 38 lines)

Two RLS policies:

1. **"Users can insert their own enrollments"** — INSERT policy on `public.enrollments` with `with check (auth.uid() = user_id)`. Unblocks the Server Action in Plan 02 from receiving an RLS error when calling `supabase.from('enrollments').insert(...)`.

2. **"Users can view profiles of cohort-mates"** — SELECT policy on `public.profiles` using an EXISTS subquery that joins `public.enrollments e1` (current user's enrollment) and `public.enrollments e2` (target profile's enrollment) on `cohort_id`. A user can read a profile only if both they and the target are enrolled in the same cohort, or it is their own profile (`auth.uid() = id`). Unblocks the teammate roster query in Plan 03.

Neither policy uses `DROP` or replaces existing policies. Postgres ORs multiple SELECT policies per table — the existing "Users can view their own profile" from migration 00001 is untouched.

### supabase/seed.sql (modified, +98 lines appended)

Added at end of file after the May 2026 Cohort insert:

- **auth.users stub rows**: Two rows with UUIDs `...061` (Jane Doe) and `...062` (Alex Kim), `encrypted_password = ''` (cannot log in), standard Supabase local-dev `instance_id = ...000`.
- **public.profiles rows**: Matching profile rows with `org_id = ...001` (Taller Technologies), `role = 'learner'`.
- **public.enrollments rows**: Two enrollment rows (`...071`, `...072`) tying both teammates to cohort `...050` (May 2026 Cohort), status `active`.
- All three INSERTs use `ON CONFLICT (id) DO NOTHING` — seed is idempotent.

## New RLS Policy Names (for Plans 02 and 03 reference)

| Table | Policy Name | Operation | Key Condition |
|-------|-------------|-----------|---------------|
| public.enrollments | "Users can insert their own enrollments" | INSERT | `with check (auth.uid() = user_id)` |
| public.profiles | "Users can view profiles of cohort-mates" | SELECT | `auth.uid() = id OR EXISTS (e1 JOIN e2 ON cohort_id)` |

## Database Reset Status

`npx supabase db reset` applies both migration 00003 and the extended seed cleanly. The migration is net-new DDL (two CREATE POLICY statements, no DROP/ALTER). The seed uses `ON CONFLICT (id) DO NOTHING` throughout — safe to re-run.

## Threat Model Compliance

All mitigations from the plan's threat register are implemented:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-03-01 (Elevation: INSERT enrollments) | `with check (auth.uid() = user_id)` + existing UNIQUE(user_id, cohort_id) + FK to auth.users |
| T-03-02 (Info disclosure: profiles SELECT) | EXISTS subquery requires BOTH current user and target enrolled in SAME cohort |
| T-03-03 (Tampering: UPDATE/DELETE enrollments) | No new UPDATE/DELETE policies added — RLS denies by default |
| T-03-04 (Info disclosure: seed rows) | Empty encrypted_password — no credentials to leak |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `supabase/migrations/20260428000003_enrollment_rls.sql` exists on disk
- [x] `supabase/seed.sql` contains teammate UUIDs ...061, ...062, ...071, ...072
- [x] Commit 853e00e exists (Task 1)
- [x] Commit 24d7239 exists (Task 2)
- [x] 9 `ON CONFLICT (id) DO NOTHING` clauses in seed.sql (>= 7 required)
- [x] Existing seed rows (org, course, modules, lessons, quiz, cohort) preserved

## Self-Check: PASSED
