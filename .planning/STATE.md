# Project State

## Current Phase
4

## Status
Complete (3/3 plans)

## Phases
| # | Name | Status | Requirements |
|---|------|--------|--------------|
| 1 | Auth + RLS Foundation | complete | AUTH-01, AUTH-02, AUTH-03, AUTH-04 |
| 2 | Data Model + Course Catalog | complete (5/5 plans) | CATALOG-01, CATALOG-02 |
| 3 | Cohort Enrollment + Learner Dashboard | complete (5/5 plans) | COHORT-01, COHORT-02, COHORT-03, COHORT-04 |
| 4 | Video Lesson Experience | complete (3/3 plans) | LESSON-01, LESSON-02, LESSON-03, LESSON-04 |
| 5 | Quiz Engine | ready to execute (3/3 plans) | QUIZ-01, QUIZ-02, QUIZ-03 |
| 6 | AI Tutor | pending | AI-01, AI-02, AI-03, AI-04, AI-05 |

## Current Plan
04-01

## Decisions
- Use OR-based SELECT policy on profiles (Postgres allows multiple SELECT policies that OR together — new cohort-mate branch does not replace migration 00001 existing policy)
- Empty encrypted_password on seed auth.users stubs — accounts cannot log in, exist solely to satisfy FK constraint
- TablesInsert<'enrollments'> + (enrollmentRow as never) cast for Supabase v2.105.x / PostgREST 14.5 schema inference workaround in Server Actions
- enrollInCohortAction.bind(null, { error: null }) as (FormData) => void cast for Next.js form action type compatibility
- Hardcode 0% for teammate progress display in Phase 3 dashboard (seeded teammates have no lesson_progress rows; computing dynamically would always return 0%; literal 0% is per D-07 spec; Phase 4+ wires real progress)
- LessonProgressRow inline type cast for PostgREST 14.5 schema inference workaround (consistent with Plan 02 EnrollmentCohortIdRow pattern)

## Last Updated
2026-04-28 — Phase 5 Quiz Engine planned: 3 plans (shadcn install + RLS migration, schema push + submit route, lesson page + QuizSection UI)

## Decisions
- Use OR-based SELECT policy on profiles (Postgres allows multiple SELECT policies that OR together — new cohort-mate branch does not replace migration 00001 existing policy)
- Empty encrypted_password on seed auth.users stubs — accounts cannot log in, exist solely to satisfy FK constraint
- TablesInsert<'enrollments'> + (enrollmentRow as never) cast for Supabase v2.105.x / PostgREST 14.5 schema inference workaround in Server Actions
- enrollInCohortAction.bind(null, { error: null }) as (FormData) => void cast for Next.js form action type compatibility
- Hardcode 0% for teammate progress display in Phase 3 dashboard (seeded teammates have no lesson_progress rows; computing dynamically would always return 0%; literal 0% is per D-07 spec; Phase 4+ wires real progress)
- LessonProgressRow inline type cast for PostgREST 14.5 schema inference workaround (consistent with Plan 02 EnrollmentCohortIdRow pattern)
- Mux demo playback ID DS00Spx1CV902MCtPj5WknGlR102V5HFkDe used for all 3 seed lessons (migration 00007)
- onTimeUpdate cast to unknown as () => void for Mux v3 type compat with generic event listener signature
