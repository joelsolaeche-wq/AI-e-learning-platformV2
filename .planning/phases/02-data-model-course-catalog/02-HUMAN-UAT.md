---
status: partial
phase: 02-data-model-course-catalog
source: [02-VERIFICATION.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Catalog page renders course card
expected: Sign in, visit http://localhost:3000/catalog — see "Generative AI Fundamentals" card with picsum.photos thumbnail, title, description excerpt, "AI" badge, "View Course" button
result: [pending]

### 2. Unauthenticated /catalog redirect
expected: Sign out, visit http://localhost:3000/catalog — browser URL changes to /auth/login?redirectTo=%2Fcatalog
result: [pending]

### 3. "View Course" navigates to detail page
expected: Click "View Course" — URL becomes /catalog/00000000-0000-0000-0000-000000000010, page shows 3 modules, 3 lessons with durations (10 min, 12 min, 14 min), "May 2026 Cohort" cohort card with "active" badge, "May 1, 2026" start date, "20 seats available", disabled "Join Cohort" button
result: [pending]

### 4. 404 for unknown course
expected: Visit http://localhost:3000/catalog/00000000-0000-0000-0000-999999999999 — renders Next.js 404 page
result: [pending]

### 5. Supabase live DB — 12 tables with RLS
expected: SQL Editor query returns 12 rows all with rowsecurity=t:
  select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('profiles','organizations','courses','modules','lessons','quiz_definitions','cohorts','enrollments','lesson_progress','quiz_attempts','ai_chat_sessions','ai_chat_messages') order by tablename;
result: [pending]

### 6. Supabase live DB — seed data present
expected: select title, is_published from public.courses; → 1 row 'Generative AI Fundamentals', true. select count(*) from public.modules; → 3. select count(*) from public.lessons; → 3. select count(*) from public.cohorts where status='active'; → 1
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
