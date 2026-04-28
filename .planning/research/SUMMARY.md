# Research Summary
> Synthesized from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md — April 2026
> Platform: AI-native e-learning for enterprise cohorts. Demo path: sign up -> join cohort -> watch video -> take quiz -> chat with AI tutor.

---

## Recommended Stack

Next.js 15 (App Router) with React Server Components for data fetching and Server Actions for mutations — no hand-rolled API routes except where streaming is required. Supabase handles auth (via `@supabase/ssr@^0.5.x` — the `auth-helpers` package is deprecated and must not be used), Postgres with RLS enforced at the DB layer, and private Storage for assets. Video is served exclusively through Mux (`@mux/mux-player-react@^2.x`) — not Supabase Storage, not YouTube — for adaptive bitrate HLS, signed playback tokens, and resume support. Claude API is accessed only via the Vercel AI SDK (`ai@^4.x` + `@ai-sdk/anthropic@^1.x`) through a Route Handler; never from client components. UI is shadcn/ui + Tailwind v4 + Radix primitives, forced dark theme via `next-themes`. State split: RSC for initial loads, TanStack Query v5 for post-hydration client data, Zustand v5 only for ephemeral UI state (video timestamp, quiz in-progress). Deployed on Vercel + Supabase Cloud free tier, with Supabase CLI managing all migrations in version control.

---

## Table Stakes Features (must have for demo)

- Email/password sign-up with verification + Google OAuth (covers enterprise SSO expectation cheaply)
- Invite link that lands the user directly inside their cohort (not a generic dashboard)
- Enrolled cohort list on the dashboard with visual progress indicator per course
- Cohort member roster so the experience feels like a team, not solo learning
- Lesson sequencing locked by cohort start date + weekly module unlocks
- In-browser video playback with play/pause/seek, playback speed control (0.75x-2x), and resume from last position
- Closed captions (ADA/WCAG compliance is a hard enterprise requirement)
- Lesson completion auto-marked at 90% watch + manual override
- Quiz with server-side scoring, immediate score display, and per-question answer review
- AI tutor chat scoped to lesson content, with persistent history across sessions and streaming response (not batch)
- Graceful AI refusal for out-of-scope questions with visible AI disclosure
- Progress state updates after every lesson/quiz completion (feeds dashboard, manager view, and AI context)

---

## Differentiating Features (demo talking points)

- Role-aware AI responses: developer gets a code example, PM gets a process analogy — same question, different answer based on role collected at sign-up
- AI-generated quiz explanations: after a wrong answer, the tutor explains the correct answer referencing the specific lesson section
- Cohort dashboard showing all teammates, their current module, and a completion bar — the visual that sells the cohort model in demos
- Lesson transcript grounding for AI: the assistant can cite specific moments from the video, not generic knowledge
- Proactive AI nudge when a learner re-watches the same segment or fails a quiz twice
- Chapter/timestamp markers on the video scrubber for scannable, re-watchable lessons
- Cohort progress visible to learner (social accountability, ~25% completion lift per 360Learning data)

---

## Architecture in One Page

**Core Tables (12):** `profiles`, `organizations`, `courses`, `modules`, `lessons`, `quiz_definitions`, `cohorts`, `enrollments`, `lesson_progress`, `quiz_attempts`, `ai_chat_sessions`, `ai_chat_messages`

**Key Component Boundaries:**

| Boundary | Rule |
|---|---|
| Server Components | Fetch all initial page data — no client loading states |
| Server Actions | All mutations (enroll, submit quiz, create chat session) |
| Route Handlers | Streaming only: AI chat SSE + video progress heartbeat (5 s) |
| Client Components | VideoPlayer (ssr: false), QuizRunner, AIChatPanel, CohortDashboard |
| "use client" boundary | Never on layout files — wrap only the provider inside the layout JSX |

**2 Route Handlers that must be API routes** (Server Actions cannot stream):
1. `POST /api/ai/chat` — SSE streaming Claude response
2. `POST /api/video/progress` — high-frequency upsert heartbeat (5 s)

---

## Critical Sequencing Constraints

1. **Auth and RLS before everything.** Enable RLS on every table at creation. The `@supabase/ssr` client pattern must be established before any protected route is written.
2. **Full data model before any feature work.** `lesson_progress` is consumed by the cohort dashboard, AI context, and manager view. Build and test the progress event model first; everything else reads from it.
3. **Video + progress tracking before quizzes.** Quiz unlock logic depends on `lesson_progress` rows existing.
4. **Transcript data populated before AI tutor.** If transcripts are not indexed when AI chat is built, the tutor gives generic answers — the core differentiator fails.
5. **Role signal collected at sign-up before AI prompt engineering.** One field on the onboarding form, but retrofitting it after the system prompt is built requires reworking the context builder.
6. **Cohort locking rules decided before content is seeded.** Changing unlock logic after seeding breaks demo rehearsals. Default: start date + weekly module unlocks.
7. **Mux integration before any lesson page is built.** Migrating video storage mid-build is disruptive.

---

## Top 5 Risks to Address Early

| Rank | Risk | Demo Impact | Mitigation |
|---|---|---|---|
| 1 | AI tutor gives generic, ungrounded answers | Kills the core differentiator on stage | Build and test transcript ingestion and system prompt context injection before the first conversation is persisted |
| 2 | Supabase free tier pauses the DB | Demo opens to a 500 error | Upgrade to Pro ($25/mo) one week before demo or set a 24 h keep-alive cron; verify the morning of the demo |
| 3 | Demo account not pre-seeded or RLS blocks seeded data | Empty cohort, broken demo in first 60 s | Create demo@yourapp.com, pre-enroll in cohort with 3 lessons + quiz + 10 AI chat turns; walk full path as that user after every seed |
| 4 | Missing env vars crash production | App unusable on first load | Maintain .env.example; add boot-time env check; diff against Vercel env list before each deploy |
| 5 | Anthropic API latency spike during live demo | 8-12 s silence on stage | Optimistic UI with instant typing indicator; pre-warm with API call 5 min before demo; have cached fallback response ready |

---

## Key Decisions Already Made

| Decision | Locked Choice | Rationale |
|---|---|---|
| Auth package | @supabase/ssr@^0.5.x | auth-helpers-nextjs deprecated; next-auth duplicates session systems |
| Video infrastructure | Mux + MuxPlayer | No Supabase Storage for video, no YouTube/Vimeo embeds, no video.js |
| AI SDK | Vercel AI SDK (ai + @ai-sdk/anthropic) | No raw SDK calls; no client-side API calls; streaming protocol handled |
| AI model | claude-sonnet-4-5 (current Sonnet gen) | Haiku too weak for nuanced Q&A; Opus overkill for interactive chat |
| Mutations strategy | Server Actions for all writes | Route Handlers only for streaming + high-frequency heartbeat |
| UI system | shadcn/ui + Tailwind v4 + Radix, forced dark | MUI/Chakra/Mantine fight the dark premium aesthetic |
| State model | RSC + TanStack Query v5 + Zustand v5 (ephemeral only) | No Redux; no SWR; no useQuery as primary fetching layer |
| Deployment | Vercel + Supabase Cloud | No Dockerfile platforms for Next.js; no self-hosted Supabase |
| Schema migrations | Supabase CLI only (supabase db push) | Never modify schema via Supabase dashboard |
| Quiz scoring | Server-side only (Server Action) | Never trust client-submitted scores |
| Cohort model | cohorts table separate from courses | One course runs as N cohorts; enrollment is always to a cohort |
| Demo scope | Two roles only: learner and admin | No SCIM, no TOTP, no self-paced fallback, no multi-cohort enrollment for v1 |
