---
phase: 5
slug: quiz-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest / next test |
| **Config file** | none — Next.js built-in test runner |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | QUIZ-01 | — | Quiz button disabled when lesson_progress.completed = false | manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | QUIZ-02 | T-5-01 | correct_answer stripped from client response | manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | QUIZ-02 | T-5-01 | POST /api/quiz/submit scores server-side | manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | QUIZ-03 | — | Score + per-question breakdown returned in single response | manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | QUIZ-03 | — | quiz_attempts row upserted with score, user_id, lesson_id | manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx tsc --noEmit` passes cleanly before any new files are added

*Existing infrastructure covers all phase requirements — no new test framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Take Quiz button disabled/hidden when lesson not complete | QUIZ-01 | No test framework for UI gating | Visit lesson page as enrolled user with completed=false; confirm button absent or disabled |
| correct_answer absent from /api/quiz/[lessonId] GET response | QUIZ-02 | Requires browser DevTools network inspection | Open DevTools → Network → confirm no correct_answer key in quiz fetch response |
| Score + breakdown returned in single POST /api/quiz/submit response | QUIZ-02, QUIZ-03 | Requires manual submission test | Submit quiz → confirm response contains score and per-question results without second request |
| quiz_attempts row written to Supabase | QUIZ-03 | Requires DB inspection | After submit, check Supabase quiz_attempts table for row with correct user_id, lesson_id, score |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
