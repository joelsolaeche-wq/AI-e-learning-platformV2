# Roadmap

> 6 phases | 21 requirements | Demo target: sign up → browse catalog → join cohort → watch video → take quiz → chat with AI tutor

---

## Phase 1: Auth + RLS Foundation
**Goal:** A user can register, log in, stay authenticated across sessions, log out, and be blocked from protected routes when unauthenticated — with RLS enforced at the database layer for every table.
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04
**UI hint:** yes

### Success Criteria
1. A new visitor can complete the sign-up form with email and password and land on a protected dashboard page without any manual redirect.
2. A returning user who closes and reopens the browser is still logged in and reaches the dashboard directly — no re-login required.
3. A logged-out user who navigates to `/dashboard` or any protected route is redirected to `/login` immediately.
4. A logged-in user clicking "Log out" from any page is redirected to `/login` and cannot reach protected pages without re-authenticating.
5. A direct Supabase query against any protected table without an authenticated session returns zero rows (RLS blocks unauthenticated reads at the DB layer).

---

## Phase 2: Data Model + Course Catalog
**Goal:** All 12 production tables exist with RLS enabled and seeded with demo data, and a user can browse the course catalog and view a full course detail page.
**Requirements:** CATALOG-01, CATALOG-02
**UI hint:** yes

### Success Criteria
1. All 12 tables (`profiles`, `organizations`, `courses`, `modules`, `lessons`, `quiz_definitions`, `cohorts`, `enrollments`, `lesson_progress`, `quiz_attempts`, `ai_chat_sessions`, `ai_chat_messages`) are present in Supabase with RLS enabled on every table — confirmed via `supabase db push` and schema inspection.
2. An authenticated user can visit `/catalog` and see at least one AI course card with title, description, and a visual thumbnail.
3. Clicking a course card navigates to a course detail page that shows the full module/lesson outline, course description, and available cohort schedule.
4. Demo seed data is fully populated: at least one course, three modules, three lessons, one cohort with a start date, and one quiz definition — visible on the catalog page without any manual DB edits.
5. An unauthenticated user visiting `/catalog` is redirected to `/login`, confirming RLS and route protection extend to catalog routes.

---

## Phase 3: Cohort Enrollment + Learner Dashboard ✓ COMPLETE (3/3 plans)
**Goal:** An authenticated user can view available cohorts for a course, enroll in one, and land on a dashboard that shows their enrolled cohort with progress indicators and cohort teammates.
**Requirements:** COHORT-01, COHORT-02, COHORT-03, COHORT-04
**UI hint:** yes

### Success Criteria
1. From a course detail page, a user can see at least one cohort listed with its start date, available seats, and an "Enroll" action — and clicking "Enroll" creates an `enrollments` row and immediately reflects in the UI without a page reload.
2. After enrolling, the user is redirected to (or the dashboard updates to show) the newly enrolled cohort with a visible progress bar at 0%.
3. The learner dashboard lists all enrolled cohorts with per-cohort progress indicators (e.g., "0 of 3 lessons complete") that update in real time after lesson completions.
4. A cohort member roster is visible on the cohort dashboard page, showing at least the demo teammate accounts with their current module and a completion bar — confirming the social/team context.
5. A user who is not enrolled in a cohort cannot access that cohort's lesson pages — Supabase RLS returns an empty result for lesson queries scoped to unenrolled cohorts.

---

## Phase 4: Video Lesson Experience
**Goal:** An enrolled user can open a lesson, watch the Mux-hosted video with full playback controls, have their position saved automatically, and have the lesson marked complete upon reaching 90% of the video.
**Requirements:** LESSON-01, LESSON-02, LESSON-03, LESSON-04
**UI hint:** yes

### Success Criteria
1. An enrolled user navigating to a lesson page sees the Mux video player render with functional play/pause, seek scrubber, and a playback speed control offering 0.75×, 1×, 1.25×, 1.5×, and 2× options.
2. A user who watches 40% of a video, closes the tab, and returns to the same lesson resumes from the 40% position (± 5 seconds) — confirmed by a visible `lesson_progress` row with a non-zero `last_position` value in Supabase.
3. When a user reaches 90% of the video duration, a `lesson_progress` row is upserted with `completed = true` — and this happens without any manual user action (auto-marked).
4. The cohort dashboard reflects the newly completed lesson immediately (or on next page load): the progress bar advances and the completed lesson is visually distinguished from incomplete ones.
5. A user who has not enrolled in a cohort receives a non-200 response (or empty data) from the `/api/video/progress` heartbeat endpoint — confirming that unenrolled users cannot write progress events.

---

## Phase 5: Quiz Engine
**Goal:** A user who has completed a lesson can take a post-lesson quiz, receive a server-side score, and immediately see their total score and per-question answer review.
**Requirements:** QUIZ-01, QUIZ-02, QUIZ-03
**UI hint:** yes

### Success Criteria
1. The "Take Quiz" button on a lesson page is only enabled (or visible) after the corresponding `lesson_progress` row has `completed = true` — confirming quiz unlock depends on lesson completion.
2. A user who clicks "Take Quiz" is presented with a functional quiz interface showing all questions and answer options drawn from `quiz_definitions` — and the raw answer key is never present in any client-side network response (confirmed via browser DevTools).
3. After submitting a quiz, the server returns a score and per-question breakdown (correct / incorrect + correct answer) within the same response — no second round trip required.
4. The user sees their score (e.g., "4 / 5 — 80%") and a per-question review with their selected answer highlighted green (correct) or red (incorrect) with the correct answer shown.
5. A `quiz_attempts` row is written to Supabase with the correct `score`, `user_id`, and `lesson_id` values — confirming the attempt is persisted for dashboard and AI context consumption.

---

## Phase 6: AI Tutor
**Goal:** An enrolled user watching a lesson can open a persistent AI chat panel, ask questions grounded in the lesson transcript, receive streaming responses, and have the conversation persist across sessions — with graceful refusal for out-of-scope questions.
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05
**UI hint:** yes

### Success Criteria
1. A user watching a lesson can click an "Ask AI" button or tab to open a chat panel without leaving or reloading the lesson page — the panel renders inline alongside or overlaid on the video player.
2. After the user submits a question, the AI response begins streaming character-by-character (or token-by-token) within under 2 seconds — there is no blank waiting period followed by a full batch response appearing at once.
3. When asked a question directly referencing lesson content (e.g., "What did the instructor mean by token context window?"), the AI tutor's response cites or paraphrases specific content from the lesson transcript — confirming the transcript grounding is active (not generic LLM knowledge only).
4. A user who closes the lesson tab, reopens it, and returns to the AI chat panel sees their full prior conversation history for that lesson — confirmed by `ai_chat_messages` rows scoped to the correct `(user_id, lesson_id)` pair.
5. When asked a question clearly outside course scope (e.g., "What's the weather in Paris?" or "Write me a poem"), the AI tutor responds with a polite, visible refusal message that redirects to course topics — no hallucinated off-topic answer is returned.
