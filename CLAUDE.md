## Project

**AI Platform v2**

An AI-native e-learning platform that delivers structured, hands-on education in Artificial Intelligence — starting with Generative AI, Agentic AI, and Large Language Models — built for enterprise teams.

The platform combines video lessons, quizzes, and an AI-powered course assistant (tutor) within a cohort-based learning model, where employees learn together on a shared schedule.

**The demo goal:** A live walkthrough where a real learner signs up → joins a scheduled cohort → watches a video lesson → takes a quiz → chats with an AI tutor. Every click must work.

**Core Value:** A learner at an enterprise company can sign up, join their team's AI cohort, consume a lesson with video + quiz, and get instant AI tutoring — all in one seamless, premium experience.

## Technology Stack

### Core Stack
- **Next.js 15** — App Router. Server Components by default; `'use client'` only when needed.
- **Supabase** — Postgres, Auth (cookie-based SSR), RLS, Realtime, Storage.
- **Mux** + `@mux/mux-player-react` — adaptive video streaming.
- **Vercel AI SDK** with dual provider — Anthropic direct or OpenRouter, switched via `AI_PROVIDER` env. See `lib/ai/model.ts`.
- **shadcn/ui** + Tailwind CSS v4 + Radix UI — component library (shadcn primitives in `components/ui/` are treated as vendor code; don't refactor them).
- **lucide-react** — icons. Note: `transpilePackages: ['lucide-react']` required in `next.config.ts`.
- **Zod** — runtime validation at trust boundaries.

### What NOT to Use
1. `@supabase/auth-helpers-nextjs` (deprecated — use `@supabase/ssr`).
2. `next-auth` / Auth.js for auth — Supabase handles auth.
3. Raw Anthropic SDK called directly from client components — go through `/api/tutor/chat` or a server action that uses `lib/ai/model.ts`.
4. `video.js` or `plyr` — use `@mux/mux-player-react`.
5. `supabase.auth.getSession()` for server-side checks — **always use `supabase.auth.getUser()`** which validates server-side. `getSession()` reads the cookie and is unsafe for authorization.

## Architecture

Effective 4-layer separation. Each layer has a single responsibility and a strict import direction (upper layers import lower, never the reverse).

```
┌──────────────────────────────────────────────────────────────┐
│ UI Layer       app/**/page.tsx, layout.tsx, components/**    │
│                JSX + props + light client interactivity      │
└────────────────────────┬─────────────────────────────────────┘
                         │ imports
┌────────────────────────▼─────────────────────────────────────┐
│ Action/Route   lib/actions/*.actions.ts, app/api/**/route.ts │
│                Auth gate → input validation (Zod) →          │
│                orchestration → typed response                │
└────────────────────────┬─────────────────────────────────────┘
                         │ imports
┌────────────────────────▼─────────────────────────────────────┐
│ Domain         lib/labs/*, lib/learner-stats.ts,             │
│                lib/transcript/*, lib/lab-utils.ts            │
│                Pure-ish business logic; takes `supabase` as  │
│                a parameter so callers own auth context       │
└────────────────────────┬─────────────────────────────────────┘
                         │ imports
┌────────────────────────▼─────────────────────────────────────┐
│ Infrastructure lib/supabase/*, lib/ai/model.ts,              │
│                lib/github/fetch-repo.ts, lib/env.ts          │
│                External integrations + boundary modules      │
└──────────────────────────────────────────────────────────────┘
```

### Layer rules (hard)

1. **Service-role isolation.** `@/lib/supabase/admin` (which exposes `createAdminClient` and bypasses RLS) may only be imported from `lib/**` and `app/api/admin/**`. **Never** from `app/**/page.tsx`, `app/**/layout.tsx`, or `components/**`. If a server page needs admin data, call a function in `lib/queries/admin/*` that gates with `assertAdmin` first.
2. **Env access is centralized.** `process.env.X` may only appear in `lib/env.ts` and the three Supabase boundary modules (`lib/supabase/{client,server,admin}.ts`). Every other file imports `env` from `@/lib/env`. Never fall back to `''` for required vars — `lib/env.ts` fails fast at startup if any required var is missing.
3. **Authz lives in one module.** Role gates (`assertAdmin`, `assertAdminOrInstructor`, `assertAdminOrOwner`, `requireCompanyAccess`) live in `lib/auth/guards.ts`. Pages, server actions, and route handlers all call those helpers — they do not re-implement `profiles.role === 'admin'` checks inline.
4. **Server Components stay thin.** A page contains JSX + at most one or two top-level `await`s into `lib/queries/*` or `lib/actions/*`. Multi-query orchestration moves to `lib/queries/*`.
5. **Route handlers stay thin.** `app/api/**/route.ts` is: parse → validate (Zod) → auth/enrollment guard → call an action or domain function → shape the response. No table joins inline; no business rules.

## Conventions

### Server Actions
- File location: `lib/actions/<resource>.actions.ts` (one file per resource — users, cohorts, courses, etc.). Never mix resources by audience (e.g. don't put "all admin actions" in one file).
- Every action starts with `'use server'`.
- Return type is `ActionResult<T> = { error: string | null; success?: boolean } & T`. Imported from `lib/actions/types.ts`.
- First step is always an auth/role guard from `lib/auth/guards.ts`. Never read `auth.getUser()` + `profiles.role` inline.
- Validate inputs explicitly. Don't trust `FormData` values; cast → trim → length-check → enum-check.
- Mutations finish with `revalidatePath(...)` for the affected route(s).

### API Routes
- Same gate pattern as actions, but return `NextResponse.json({ error }, { status })` for errors.
- Validate every caller-supplied UUID with `UUID_RE` from `lib/constants/regex.ts`.
- Validate every caller-supplied email with `EMAIL_RE`.
- For protected resources, add an **explicit enrollment check** even if RLS would block — RLS handles row visibility, enrollment handles authorization. See `app/api/tutor/chat/route.ts` for the pattern.

### Roles & Authorization
- Roles: `learner`, `instructor`, `admin`, `company_owner`. Source of truth is the DB CHECK constraint in `supabase/migrations/20260506000001_company_workspace.sql`.
- Role string literals and arrays live in `lib/auth/roles.ts` (`Role` type, `ALL_ROLES`, `ADMIN_ROLES`, `STAFF_ROLES`, `ROLE_LABELS`). Never inline a role list as `['learner', ...]`.
- **Role-assignment matrix** (who can create whom):
  - `admin`: can assign any role.
  - `company_owner`: can only create `learner` users **within their own `org_id`**.
  - `instructor` / `learner`: cannot create users.
- **Tenant scope:** when a `company_owner` mutates a resource, the resource's `company_id` (or the enclosing cohort's `company_id`) must equal `caller.orgId`. Use `requireCompanyAccess(companyId)` from `lib/auth/guards.ts`.
- **Defense in depth:** middleware-only role checks are not enough. Every `/admin/*` page that uses `createAdminClient` calls `assertAdmin()` (or a stricter helper) at the top of the Server Component before fetching.

### PostgREST query safety
- **Never** interpolate user input into `.or()`, `.filter()`, or `.rpc()` filter strings — commas, parens, and operators (`ilike`, `eq`, etc.) are PostgREST metacharacters and a parameter like `q=,role.eq.admin` breaks out of the wildcard. Use chained `.ilike()` calls or pre-sanitize with `q.replace(/[,()*]/g, '\\$&')` if you must interpolate.
- `.eq()`, `.ilike()`, `.in()`, etc. with a single value parameter are safe (parameterized).

### Database types
- `lib/database.types.ts` is generated by `supabase gen types typescript --linked > lib/database.types.ts`. Regenerate after every migration; do not edit by hand.
- If the regenerated types lag a column you just added, cast through a typed inline interface (`type X = { … }`) rather than `(supabase as any)`. The `(supabase as any)` cast is a known smell — see `tech debt` below.

### Naming
- **Use the same noun across the stack.** The current codebase mixes `organization`, `company`, and `org` (e.g. DB column `org_id`, URL param `companyId`, type field `orgId`). When adding new code, prefer `company` consistently — there is a planned migration to rename `org_id → company_id` and the `organizations` table → `companies`. Comment with `// TODO: align with org→company rename` if you must add a new use of `org_id`.
- Filenames: kebab-case for utility files (`lab-utils.ts`), PascalCase for components (`LabSection.tsx`), `<resource>.actions.ts` for server actions, `<resource>.queries.ts` for query modules.

### Constants
- AI/LLM caps (`maxTokens`, transcript char limits, timeouts) and validation lengths (`PASSWORD_MIN_CHARS`, `NAME_MAX_CHARS`, etc.) live in `lib/constants/limits.ts`. Never inline as a literal in a route handler or component.
- Regexes (`UUID_RE`, `EMAIL_RE`) live in `lib/constants/regex.ts`.

### Comments
- Default to no comments. Add one when the **why** is non-obvious (a hidden constraint, a workaround for a specific bug, a security trade-off).
- Don't explain what well-named code already says.
- Don't reference current tasks, PRs, or issue numbers — those rot.

## Known tech debt / Phase 7 PR backlog

These are tracked items, currently being addressed via small dedicated PRs:

1. **PostgREST OR-filter injection** in `app/admin/users/page.tsx` and `app/api/admin/user-by-email/route.ts` — caller-supplied query interpolated into `.or()`. Fix: in-page admin gate + input sanitization.
2. **Cross-tenant IDOR** in `lib/actions/cohorts.actions.ts` enrollment/cohort mutations (unenroll/enroll/bulkEnroll/archive/clone) — accept caller-supplied IDs without scoping to `caller.orgId`.
3. **Open redirect** in `app/auth/callback/route.ts` via the `next` param — payload like `?next=@evil.tld/...`.
4. **Stale `database.types.ts`** — missing `cohorts.image_url`, `transcript_segments`, role `company_owner`. Root cause of ~140 `(supabase as any)` casts + matching `eslint-disable`. Regenerate to unlock cleanup.
5. **Role string arrays duplicated** across ~7 files; centralize in `lib/auth/roles.ts`.
6. **`assertAdmin`/`assertAdminOrInstructor` duplicated** in 5 files (and `assertAdminOrInstructor` has different role sets in `cohorts.actions.ts` vs `courses.actions.ts` — bug-prone); centralize in `lib/auth/guards.ts`.
7. **AI/LLM magic numbers + duplicate `MAX_TRANSCRIPT_CHARS` with different values** (`lib/labs/evaluate.ts:20` = 12_000 vs `app/api/admin/labs/draft/route.ts:12` = 24_000); centralize in `lib/constants/limits.ts`.
8. **`MIN_TEXT_LEN`/`MAX_TEXT_LEN` declared on both client and server** (`components/LabSection.tsx` + `app/api/labs/submit/route.ts`); risk of silent drift.
9. **18 server pages import `createAdminClient` directly**, including the learner-facing `app/(app)/dashboard/lesson/[lessonId]/page.tsx`. Move admin reads behind `lib/queries/admin/*`.
10. **God modules** — `lib/actions/admin.actions.ts` (296 LOC mixing users + members + CSV) and `lib/actions/cohorts.actions.ts` (392 LOC mixing CRUD + enrollment + invites); split by resource.
11. **`lib/github/fetch-repo.ts:235`** — comment claims `0x00` check but code is `sample.includes(' ')` (regular space). Correctness + minor security bug.
12. **`process.env.NEXT_PUBLIC_SITE_URL ?? ''`** in `lib/actions/auth.actions.ts:31` and `profile.actions.ts:48` — silent fallback to empty string in production.

## Don't do (anti-patterns observed historically)

- Don't add another `assertAdmin*` helper. Use the one in `lib/auth/guards.ts`.
- Don't add another `UUID_RE` declaration. Import from `lib/constants/regex.ts`.
- Don't interpolate user input into Supabase `.or()` / `.filter()` strings.
- Don't read `process.env` outside `lib/env.ts` or the Supabase boundary modules.
- Don't put `createAdminClient` in a server page. Wrap it in a `lib/queries/*` function that gates first.
- Don't add `eslint-disable @typescript-eslint/no-explicit-any` to silence a Supabase type lag. Regenerate types or use a typed inline interface.
- Don't trust the middleware as the only auth check on admin pages.
- Don't use `getSession()` for server-side authorization. Use `getUser()`.
- Don't add comments that explain WHAT the code does. Only WHY.
