---
status: partial
phase: 05-quiz-engine
source: [05-VERIFICATION.md]
started: 2026-04-29T02:10:00Z
updated: 2026-04-29T02:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Quiz unlock gate — lesson incomplete
expected: Visiting a lesson page where `lesson_progress.completed = false` shows a "Take Quiz" button that is disabled (greyed out) with a Lock icon and the text "Complete the lesson to unlock the quiz"
result: [pending]

### 2. Quiz unlock gate — lesson complete
expected: Visiting a lesson page where `lesson_progress.completed = true` shows an enabled "Take Quiz" button; clicking it reveals all quiz questions from `quiz_definitions` with RadioGroup answer options
result: [pending]

### 3. Answer key absent from network responses
expected: With browser DevTools Network tab open, quiz questions appear only as React props (no network request to `quiz_definitions`); the only quiz-related network request is the POST to `/api/quiz/submit`, and its *request* payload contains `answers` but no `correct_answer`; the response contains `breakdown[i].correctAnswer` only after submission
result: [pending]

### 4. RESULTS state UI
expected: After submitting all answers, the UI transitions to a Results card showing "Quiz Results" heading, a score like "4 / 5 — 80%", a Progress bar filled proportionally, each question with the user's selected answer highlighted green (correct) or red (incorrect), and the correct answer text shown for wrong answers; a "Retake Quiz" outline button is visible
result: [pending]

### 5. quiz_attempts row written to Supabase
expected: After submitting a quiz, the Supabase `quiz_attempts` table has a new row with the correct `user_id`, `lesson_id`, `score`, and `max_score` values matching the quiz results shown in the UI
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
