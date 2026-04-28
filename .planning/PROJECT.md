# AI Platform v2

## What This Is

An AI-native e-learning platform that delivers structured, hands-on education in Artificial Intelligence — starting with Generative AI, Agentic AI, and Large Language Models — built for enterprise teams.

The platform combines video lessons, quizzes, and an AI-powered course assistant (tutor) within a cohort-based learning model, where employees learn together on a shared schedule.

**The demo goal:** A live walkthrough where a real learner signs up → joins a scheduled cohort → watches a video lesson → takes a quiz → chats with an AI tutor. Every click must work.

## Core Value

A learner at an enterprise company can sign up, join their team's AI cohort, consume a lesson with video + quiz, and get instant AI tutoring — all in one seamless, premium experience.

## Target Users

- **Primary:** Enterprise employees across roles — developers, product managers, business analysts, and leadership — enrolled together in the same cohort
- **Secondary (post-demo):** Instructors who manage cohorts and track progress

## Context

- **Stage:** Greenfield — building from scratch toward a demo
- **Demo audience:** Live walkthrough for stakeholders — every feature shown must be real and functional
- **Timeline priority:** Demo-readiness over feature completeness
- **Stack decided:** Next.js + Supabase (auth, database, storage)
- **Design direction:** Dark, premium, techy — Linear/Vercel aesthetic

## Scope

### Demo Must-Haves (v1)
- Auth: register, login, logout, protected routes
- Course catalog: browse available AI courses
- Cohort enrollment: join a scheduled cohort with a start date
- Lesson player: video playback with progress tracking
- Quiz: post-lesson questions with feedback
- AI assistant: in-lesson chat that answers questions about course content (Claude API)
- Dashboard: learner home showing enrolled cohorts and progress

### Post-Demo (v2)
- Instructor dashboard (create/manage cohorts, give feedback)
- Coding labs / embedded sandbox
- Cohort peer chat / community
- Certificates and completion badges
- Admin panel
- Mobile app

### Out of Scope for Demo
- Payments / billing — not needed for demo
- Instructor-side UX — learner only
- Live video / synchronous sessions — async video only
- Custom course builder — seed data is sufficient for demo

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Supabase | Full-stack React with auth + DB out of the box; fastest path to demo | Confirmed |
| Dark premium UI | Signals serious AI-native product to enterprise stakeholders; Linear/Vercel aesthetic | Confirmed |
| Cohort-based model | Differentiates from self-paced LMS; shared progress creates enterprise stickiness | Confirmed |
| Learner-only for demo | Reduces scope; instructor tools don't block demo narrative | Confirmed |
| Claude API for AI tutor | AI-native product should use Claude; course Q&A is a clear, bounded use case | Confirmed |

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can register with email and password
- [ ] User can log in and stay logged in across sessions
- [ ] User can log out from any page
- [ ] User can browse the course catalog
- [ ] User can view a cohort and its schedule
- [ ] User can enroll in a scheduled cohort
- [ ] User can watch a video lesson with progress tracking
- [ ] User can take a quiz after a lesson
- [ ] User can chat with the AI tutor during a lesson
- [ ] User has a dashboard showing enrolled cohorts and progress

### Out of Scope

- Instructor dashboard — post-demo
- Payments — not part of demo narrative
- Coding labs — simplifies demo scope
- Live sessions — async video sufficient for demo

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-28 after initialization*
