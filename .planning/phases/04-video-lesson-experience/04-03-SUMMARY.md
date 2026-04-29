---
phase: 4
plan: "04-03"
subsystem: "navigation"
tags: ["lesson-links", "dashboard", "catalog", "completion-badges"]
dependency_graph:
  requires: ["04-01", "04-02"]
  provides: ["lesson-navigation-from-catalog", "lesson-navigation-from-dashboard", "completion-badges"]
  affects: ["app/catalog/[courseId]/page.tsx", "app/dashboard/page.tsx"]
tech_stack:
  added: []
  patterns: ["Next.js Link component for client-side navigation", "Set.has() for O(1) completion lookup"]
key_files:
  modified:
    - "app/catalog/[courseId]/page.tsx"
    - "app/dashboard/page.tsx"
decisions:
  - "Lesson title added to LessonRowMin type and select query; title is propagated through the lessonsByCourse map push (arr.push includes title) so it reaches the render layer"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 4 Plan 03: Lesson Navigation + Dashboard Wiring Summary

Lesson links wired into both the course detail outline and the dashboard cohort cards; completed lessons show a Done badge using the existing completedLessonIds Set from Phase 3.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 04-03-T1 | Add lesson links in course detail page outline | 8221f25 | app/catalog/[courseId]/page.tsx |
| 04-03-T2 | Add lesson links on dashboard cohort cards | f4d552d | app/dashboard/page.tsx |

## What Was Built

**Task 1 — Catalog course outline links**
- Added `import Link from 'next/link'` to `app/catalog/[courseId]/page.tsx`
- Replaced the `<span>` lesson title with a `<Link href={/dashboard/lesson/${lesson.id}}>` with hover transition

**Task 2 — Dashboard cohort card lesson list**
- Extended `LessonRowMin` type to include `title`
- Updated `lessons` select query to `'id, module_id, title'`
- Updated `arr.push(...)` in the `lessonsByCourse` map to include `title`
- Added a "Lessons" subsection inside each cohort card (between progress bar and teammates), rendering each lesson as a `<Link>` to `/dashboard/lesson/[id]`
- Completed lessons show a `<Badge variant="secondary">Done</Badge>` using `completedLessonIds.has(lesson.id)`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. Lesson titles are fetched from DB. Completion state is computed from real `lesson_progress` rows.

## Threat Flags

None. These changes are read-only UI navigation — no new endpoints, no new auth paths, no schema changes.

## Self-Check: PASSED

- app/catalog/[courseId]/page.tsx contains `href={\`/dashboard/lesson/${lesson.id}\`}` — FOUND
- app/dashboard/page.tsx LessonRowMin includes 'title' — FOUND
- Lessons select query includes 'title' — FOUND
- Dashboard contains `href={\`/dashboard/lesson/${lesson.id}\`}` — FOUND
- Done badge rendered via `completedLessonIds.has(lesson.id)` — FOUND
- Commits 8221f25 and f4d552d exist in git log — FOUND
