---
plan: 02-05
phase: 2
status: complete
completed_at: 2026-04-28
---

# Summary: 02-05 Course Detail Page

## What Was Built

Created the /catalog/[courseId] Server Component page — shows course header (16:9 thumbnail, title, description), Course Outline section (modules + lessons with duration in minutes), and Available Cohorts section (cohort cards with status badge, start date, disabled "Join Cohort" button). Uses Promise.all for parallel queries and notFound() for missing/unpublished courses.

Required a follow-up fix for Supabase discriminated union TypeScript narrowing: extracted explicit `CourseRow`, `ModuleWithLessons`, `LessonRow`, and `CohortRow` types from `database.types.ts`, and used typed casts after the notFound() guard since TypeScript 5.9 with strict mode narrows `courseResult` to `never` after checking `.error || !.data`.

## Key Files

### key-files.created
- app/catalog/[courseId]/page.tsx

## Tasks Completed

| Task | Status | Notes |
|------|--------|-------|
| 2-05-01: Create app/catalog/[courseId]/page.tsx | ✓ | Server Component, parallel queries, 404 handling |

## Deviations

- Added explicit TypeScript type definitions (`CourseRow`, `ModuleWithLessons`, `LessonRow`, `CohortRow`) to work around Supabase discriminated union narrowing issue in TypeScript 5.9 strict mode. The `[courseId]/page.tsx` file itself is type-clean.
- Removed unused `Link` import from the original spec to eliminate ESLint warning.
- Build exits non-zero due to a pre-existing TypeScript narrowing error in `app/catalog/page.tsx` (the other agent's file). That file uses `courses.map()` inside a JSX `&&` expression which TypeScript does not narrow. The `[courseId]/page.tsx` file has no TypeScript errors.

## Self-Check

- [x] app/catalog/[courseId]/page.tsx exists as Server Component (no "use client")
- [x] params: Promise<{ courseId: string }> (Next.js 15 type)
- [x] await params to extract courseId
- [x] getUser() auth check with redirect
- [x] notFound() for missing course
- [x] Promise.all for 3 parallel queries
- [x] Course Outline section with module position, lessons, duration
- [x] Available Cohorts section with status badge, disabled Join Cohort button
- [x] Separator components between sections
- [ ] npm run build exits 0 — BLOCKED by pre-existing TS error in app/catalog/page.tsx (other agent's file, not modified)

## Self-Check: PARTIAL — [courseId]/page.tsx is clean; build blocked by catalog/page.tsx
