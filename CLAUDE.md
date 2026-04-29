## Project

**AI Platform v2**

An AI-native e-learning platform that delivers structured, hands-on education in Artificial Intelligence — starting with Generative AI, Agentic AI, and Large Language Models — built for enterprise teams.

The platform combines video lessons, quizzes, and an AI-powered course assistant (tutor) within a cohort-based learning model, where employees learn together on a shared schedule.

**The demo goal:** A live walkthrough where a real learner signs up → joins a scheduled cohort → watches a video lesson → takes a quiz → chats with an AI tutor. Every click must work.

**Core Value:** A learner at an enterprise company can sign up, join their team's AI cohort, consume a lesson with video + quiz, and get instant AI tutoring — all in one seamless, premium experience.

## Technology Stack

### Core Stack
- **Next.js 15** — App Router
- **Supabase** — Postgres, Auth, RLS, Realtime, Storage
- **Mux** + `@mux/mux-player-react` — adaptive video streaming
- **Vercel AI SDK** + Anthropic provider — AI tutor chat
- **shadcn/ui** + Tailwind CSS v4 + Radix UI — component library
- **lucide-react** — icons (note: `transpilePackages: ['lucide-react']` required in next.config.ts)

### What NOT to Use
1. `@supabase/auth-helpers-nextjs` (deprecated)
2. `next-auth` (Auth.js) for auth
3. Raw Anthropic SDK called directly from client components
4. `video.js` or `plyr` for the player

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
