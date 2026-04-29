# Phase 3: Discussion Log

**Date:** 2026-04-28
**Areas discussed:** Dashboard structure
**Areas not discussed (left to Claude's discretion):** Enrollment action mechanics, Realtime vs. page-reload

---

## Area: Dashboard structure

### Q1: After enrolling, where does the user land and what page shows progress + teammates?

**Options presented:**
- `/dashboard` (all-in-one) — single page, cohort card with progress + teammates inline
- `/dashboard` + `/cohorts/[id]` — summary card linking to a dedicated cohort detail page

**Selected:** `/dashboard` (all-in-one)

---

### Q2: After enrolling, how should the transition happen?

**Options presented:**
- Redirect to /dashboard (Server Action → redirect)
- Stay on course detail + show confirm banner

**Selected:** Redirect to /dashboard

---

### Q3: What level of teammate detail is needed for the demo?

**Options presented:**
- Name + progress bar (no avatar component needed)
- Avatar + name + progress (requires new initials/avatar component)

**Selected:** Name + progress bar

---

### Q4: How should teammate data be handled?

**Options presented:**
- Seed 2–3 fake profiles + enrollments in seed.sql (DB-driven)
- Hardcoded placeholder display names in UI (cosmetic only)

**Selected:** Seed fake profiles + enrollments in seed.sql

---

## Claude's Discretion

- Enrollment Server Action mechanics: Server Action consistent with existing patterns (no client component)
- Realtime updates: page reload sufficient for Phase 3
- Progress bar CSS/visual implementation
- Empty and error state designs

## Deferred Ideas

- `/cohorts/[cohortId]` dedicated page — not needed for single-path demo
- Realtime subscription for live teammate progress — Phase 4+ concern
- Avatar component — out of scope
