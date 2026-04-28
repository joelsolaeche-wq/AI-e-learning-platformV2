<!-- GSD:project-start source:PROJECT.md -->
## Project

**AI Platform v2**

An AI-native e-learning platform that delivers structured, hands-on education in Artificial Intelligence — starting with Generative AI, Agentic AI, and Large Language Models — built for enterprise teams.

The platform combines video lessons, quizzes, and an AI-powered course assistant (tutor) within a cohort-based learning model, where employees learn together on a shared schedule.

**The demo goal:** A live walkthrough where a real learner signs up → joins a scheduled cohort → watches a video lesson → takes a quiz → chats with an AI tutor. Every click must work.

**Core Value:** A learner at an enterprise company can sign up, join their team's AI cohort, consume a lesson with video + quiz, and get instant AI tutoring — all in one seamless, premium experience.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Core Stack (Decided)
### Next.js 15 — App Router
### Supabase
- **Row Level Security (RLS)**: Enforce cohort membership at the DB layer so no server-side guard logic is needed in every route.
- **Realtime**: Subscribe to `cohort_progress` table changes to show live cohort completion stats without polling.
- **Storage**: Can host short demo videos (< 500 MB). For production-grade video, see Video section below.
## Video & Media
### Recommended: Mux + `@mux/mux-player-react`
- Upload once via the Mux API, get an adaptive bitrate HLS stream automatically. No FFmpeg pipeline to maintain.
- `<MuxPlayer>` is a drop-in Web Component wrapper with a clean headless API, fully styleable with CSS custom properties. Dark theme is trivial.
- Built-in analytics: per-viewer playback quality, buffer events, completion rates — critical for an e-learning product.
- Signed URLs out of the box: restrict video playback to authenticated cohort members using JWT tokens generated server-side.
- Demo-tier free: 500 minutes stored / 500 minutes delivered free per month — enough for a demo.
## AI Integration Layer
### Recommended: Vercel AI SDK + Anthropic Provider
- `ai@^4.x` (Vercel AI SDK core)
- `@ai-sdk/anthropic@^1.x` (Anthropic provider for the AI SDK)
- Persist chat history in Supabase (`tutor_sessions` table, keyed on `user_id + lesson_id`). Load last N messages from DB and pass as initial `messages` to `useChat`.
- Inject lesson context (title, transcript excerpt, quiz topics) as a system prompt on the server — never trust the client to send this. Validate the user's cohort membership in the Route Handler before calling Claude.
- Use prompt caching (`anthropic.cache()`) on the lesson system prompt once transcript length exceeds ~1000 tokens. This cuts latency and cost significantly for repeated questions on the same lesson.
- Use `claude-sonnet-4-5` (or the current Sonnet generation) for the tutor. Haiku is too weak for nuanced lesson Q&A. Opus is overkill and expensive for interactive chat.
## UI Component Library
### Recommended: shadcn/ui + Tailwind CSS v4 + Radix UI primitives
- `tailwindcss@^4.x`
- `shadcn/ui` (not a package — it's a CLI: `npx shadcn@latest init`)
- `@radix-ui/react-*` (installed automatically by shadcn)
- `lucide-react@^0.400+` (icons)
- `next-themes@^0.3.x` (dark mode)
- shadcn's "New York" style variant with a zinc/slate dark base maps almost directly to the Linear color system.
- Tailwind v4 brings CSS-first configuration (no `tailwind.config.ts`) and significantly faster build times.
- Radix UI primitives (Dialog, Dropdown, Popover, etc.) provide fully accessible, unstyled behavior — you style them, Radix handles keyboard nav, focus traps, and ARIA.
- Lucide icons are clean, consistent, and actively maintained (unlike Heroicons which has slowed).
## State & Data Fetching
### Recommended: TanStack Query v5 + Zustand v5 (minimal use)
- `@tanstack/react-query@^5.x`
- `zustand@^5.x`
| Data type | Fetching strategy |
|---|---|
| Cohort data, lesson metadata, user enrollment | Server Component fetch (RSC, cached) |
| Real-time cohort progress | Supabase Realtime subscription (client component) |
| Quiz submissions, enrollment mutations | Server Actions |
| Client-side session data (chat history load, quiz state mid-attempt) | TanStack Query |
| Ephemeral UI state (sidebar open, modal open) | `useState` / Zustand |
- Loading previous tutor chat messages from Supabase when the chat panel opens
- Invalidating and refetching quiz results after submission
- Optimistic updates on cohort progress
## Deployment
### Recommended: Vercel (app) + Supabase Cloud (managed)
- `vercel deploy` from the CLI or a GitHub push gives you a preview URL in under 2 minutes.
- Zero-config Next.js support: App Router, Route Handlers, Server Actions, Edge Runtime, and ISR all work without any `next.config.ts` tuning.
- Environment variables are managed in the Vercel dashboard and injected at build time — set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, and `MUX_TOKEN_ID`/`MUX_TOKEN_SECRET` there.
- Preview deployments per PR branch are automatic — every feature branch gets a unique URL. Essential for stakeholder demos.
- 500 MB database, 1 GB storage, 50,000 MAU on the free plan.
- No infrastructure to manage — Supabase handles Postgres, auth, storage, and realtime.
- Upgrade to Pro ($25/month) when you need > 8 GB storage or daily backups.
## What NOT to Use
### 1. `@supabase/auth-helpers-nextjs` (deprecated)
### 2. `next-auth` (Auth.js) for auth
### 3. Raw Anthropic SDK (`@anthropic-ai/sdk`) called directly from client components
### 4. `video.js` or `plyr` for the player
### 5. `react-query v4` or `swr` with a custom fetch layer replacing Server Components
## Summary — Full Dependency List
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
