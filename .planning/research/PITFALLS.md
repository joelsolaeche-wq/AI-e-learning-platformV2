# Pitfalls Research

> Stack: Next.js (App Router) + Supabase + Claude API
> Demo path: sign up → join cohort → watch video → take quiz → AI tutor chat

---

## Auth & Supabase

### Pitfall: Session Not Propagated to Server Components
- **Warning sign:** `supabase.auth.getUser()` returns `null` inside a Server Component even though the client shows the user as logged in. API routes return 401 unexpectedly.
- **Prevention:** Use the `@supabase/ssr` package (not `@supabase/supabase-js` directly). Create one client via `createServerClient` in a shared `lib/supabase/server.ts` that reads cookies with Next.js `cookies()`. Never instantiate `createClient` from `@supabase/supabase-js` on the server — it has no cookie context.
- **Phase to address:** Week 1 — before writing any protected route or RLS policy. Getting this wrong early cascades into every data-fetch pattern in the app.

### Pitfall: Row Level Security Left Disabled During Development
- **Warning sign:** You can query any table without a `WHERE user_id = auth.uid()` clause and get data. No 403 errors during testing.
- **Prevention:** Enable RLS on every table at creation time — `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`. Write a `SELECT` policy immediately. Add a Supabase CI check or a `COMMENT ON TABLE` marker so you can grep for tables missing policies before demo day.
- **Phase to address:** Schema design phase. Never ship a table without RLS; retrofitting it after seeding data causes silent data leaks that are hard to reproduce.

### Pitfall: Auth Callback Route Missing or Misconfigured
- **Warning sign:** Magic link / OAuth redirects land on a 404. Users see a broken page after clicking their confirmation email.
- **Prevention:** Create `app/auth/callback/route.ts` that calls `supabase.auth.exchangeCodeForSession(code)` then redirects. Add the callback URL to Supabase Dashboard > Auth > URL Configuration > Redirect URLs. Also set `NEXT_PUBLIC_SITE_URL` in `.env`. Test this on the actual deployed URL, not just localhost — Supabase validates redirect origins strictly.
- **Phase to address:** Week 1, immediately after scaffolding auth. Email confirmation is on the critical demo path.

### Pitfall: `anon` Key Used for Server-Side Writes
- **Warning sign:** Service-side operations (e.g., auto-enrolling a user into a cohort on signup) silently fail or require overly permissive RLS policies to work.
- **Prevention:** Keep `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable (no `NEXT_PUBLIC_` prefix). Use it only in Route Handlers and Server Actions that need to bypass RLS. Never expose it to the browser. Use `anon` key only for client-side operations the authenticated user should be doing themselves.
- **Phase to address:** Week 1. Establish the pattern before any server-side write logic is built.

### Pitfall: Realtime Subscriptions Leaking Across Route Changes
- **Warning sign:** Multiple identical queries firing in the browser Network tab. Supabase Realtime connection count climbs on every page navigation.
- **Prevention:** Unsubscribe in a `useEffect` cleanup: `return () => { channel.unsubscribe(); }`. Use a single shared Supabase client instance (singleton pattern) in `lib/supabase/client.ts` — do not call `createClient()` inside a component body on every render.
- **Phase to address:** When adding any realtime feature (e.g., live quiz scoring, cohort member presence). Catch this in local testing by watching the Network > WS tab.

### Pitfall: JWT Expiry Not Handled — Silent Auth Failures After 1 Hour
- **Warning sign:** Users who stay on a page for >1 hour get 401s on the next action. No visible error — requests just fail.
- **Prevention:** Supabase JS client auto-refreshes tokens only when it detects activity. Wrap your client-side Supabase instance in a `SessionContextProvider` or call `supabase.auth.startAutoRefresh()`. In Server Components, always call `supabase.auth.getUser()` (not `getSession()`) — `getUser()` validates the JWT against Supabase's server, while `getSession()` only reads the local cookie and can return an expired session.
- **Phase to address:** Pre-demo hardening. This is a time-bomb that only triggers after prolonged use.

---

## Video & Media Delivery

### Pitfall: Serving Raw Video Files from Supabase Storage Directly
- **Warning sign:** Large video files served as direct Supabase Storage URLs cause slow Time-to-First-Frame. No seeking without full download. Storage bandwidth costs spike.
- **Prevention:** Use a dedicated video hosting service (Mux, Cloudflare Stream, or Bunny.net). Upload source videos, get back an HLS/DASH stream URL and a thumbnail. Embed with a player that supports adaptive bitrate (HLS.js, Video.js, or the Mux Player web component). Store only the `playback_id` in your database, not a raw file URL.
- **Phase to address:** Before any video is embedded in the product. Migrating video storage after lessons are built is disruptive.

### Pitfall: Video Player Hydration Mismatch in App Router
- **Warning sign:** `Error: Hydration failed because the initial UI does not match what was rendered on the server`. The video player flashes or disappears on load.
- **Prevention:** Video players that access `window` or `document` must be Client Components (`"use client"`). Wrap the player in dynamic import with `ssr: false`: `const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), { ssr: false })`. This is mandatory for any library that touches the DOM on import.
- **Phase to address:** First time you add a video player component.

### Pitfall: No Progress Tracking — Resuming from Start Every Time
- **Warning sign:** Users who leave mid-video restart from 0 on return. Quiz unlock logic has no reliable checkpoint.
- **Prevention:** Persist `currentTime` to Supabase on `timeupdate` events — but throttle writes to once every 10–15 seconds using a debounce/interval, not on every event (which fires 4x per second). Use an `upsert` on a `video_progress (user_id, lesson_id, position_seconds, completed)` table. On load, set `player.currentTime = savedPosition`.
- **Phase to address:** Lesson view screen build. Required before demo — the reviewer will leave and return.

### Pitfall: Autoplay Blocked by Browser Policy
- **Warning sign:** Video does not play automatically when lesson page loads. Console shows `DOMException: play() failed because the user didn't interact with the document first`.
- **Prevention:** Never rely on autoplay with sound. If autoplay is desired, pass `muted` attribute to the video element — muted autoplay is allowed by all major browsers. Otherwise, show a prominent play button as the default state. Do not call `player.play()` in a `useEffect` without a user gesture.
- **Phase to address:** During video component development.

### Pitfall: Signed Storage URLs Expiring Mid-Lesson
- **Warning sign:** If you store videos in Supabase Storage with signed URLs (not public), the URL expires (default 1 hour) while the user is watching. The video stops or refuses to seek to new segments.
- **Prevention:** Either make the video bucket public (acceptable for non-sensitive content) or generate signed URLs with a 12–24 hour TTL server-side at lesson load time. Never generate signed URLs client-side — the service role key must stay on the server.
- **Phase to address:** Storage architecture decision, before any lesson is shipped to staging.

---

## AI Integration (Claude API + Next.js)

### Pitfall: Streaming Response Not Wired Up — Blank Screen Until Full Response
- **Warning sign:** The AI tutor chat input is disabled for 5–15 seconds, then the full response appears at once. Users think it's broken.
- **Prevention:** Use the Anthropic SDK's streaming API (`anthropic.messages.stream()`). In your Route Handler, return a `ReadableStream` using the Web Streams API: pipe `stream.toReadableStream()` directly into the `Response`. On the client, consume with `fetch` + `response.body.getReader()` or use the Vercel AI SDK (`useChat` hook), which handles all of this transparently. Test that partial chunks appear within 500ms of sending.
- **Phase to address:** Day 1 of AI tutor feature. Do not build the UI around non-streaming first — it's harder to retrofit.

### Pitfall: No System Prompt Context — AI Gives Generic Answers
- **Warning sign:** The AI tutor answers general knowledge questions unrelated to the course. It has no awareness of which lesson the user is on, what the quiz covered, or the cohort's learning objectives.
- **Prevention:** Inject structured context into every system prompt: current lesson title and summary, the last quiz question and the user's answer (especially wrong answers), and the cohort's topic domain. Store lesson content as embeddings in `pgvector` (Supabase supports this) for retrieval-augmented generation if the lesson corpus is large. At minimum, pass the current lesson's text content in the system prompt as a grounding document.
- **Phase to address:** AI tutor feature build. The system prompt architecture must be designed before the first conversation is persisted.

### Pitfall: API Key Exposed in Client Bundle
- **Warning sign:** `ANTHROPIC_API_KEY` has the `NEXT_PUBLIC_` prefix, or Claude API calls are made directly from a Client Component. The key appears in browser DevTools > Network tab.
- **Prevention:** All Claude API calls must go through a Route Handler (`app/api/chat/route.ts`) or a Server Action. The API key must be a server-only env var (no `NEXT_PUBLIC_` prefix). Add `ANTHROPIC_API_KEY` to `.gitignore` audit and Vercel's environment variable settings as non-exposed.
- **Phase to address:** Before writing the first API call. One accidental commit with the key in a client file and it must be rotated immediately.

### Pitfall: No Rate Limiting — Single User Can Exhaust API Budget
- **Warning sign:** One user (or a bot) sends 500 messages to the AI tutor in a session. API costs spike. Other users get throttled by Anthropic's rate limits.
- **Prevention:** Implement per-user rate limiting in the Route Handler before calling the Claude API. Use Supabase to track message counts per user per hour in a `rate_limits` table, or use an in-memory store with Upstash Redis if available. Return HTTP 429 with a user-friendly message when the limit is hit. Set a hard token budget per conversation turn using `max_tokens`.
- **Phase to address:** Before any user can access the AI tutor. This is a cost and stability issue.

### Pitfall: Conversation History Not Managed — Context Window Overflow
- **Warning sign:** Long tutor sessions throw API errors (`context_length_exceeded`) or become extremely slow and expensive as the full history is passed every turn.
- **Prevention:** Cap the messages array passed to the API. Strategies in order of preference: (1) sliding window — keep only the last N messages; (2) summarize older turns with a separate cheap Claude call and inject the summary as a system message; (3) use `max_tokens` to control output size per turn. Store the full history in Supabase for display, but only send a truncated version to the API.
- **Phase to address:** AI tutor feature. Design the history management strategy before the conversation data model is finalized.

### Pitfall: No Loading / Error State for Streaming — Silent Failures
- **Warning sign:** If the Anthropic API returns an error mid-stream (network drop, overload), the UI freezes. No retry, no error message, no way for the user to know what happened.
- **Prevention:** Wrap the stream reader in try/catch. Display an error state with a "Try again" button. Implement exponential backoff on the client for transient errors. Use `AbortController` so the user can cancel a slow response. Log all non-200 responses server-side for debugging.
- **Phase to address:** During AI tutor UI implementation. Required before demo.

---

## Data Model & Migrations

### Pitfall: Migrations Run Manually — No Version Control
- **Warning sign:** The production schema and the local dev schema diverge. A teammate applies a column rename in the Supabase dashboard but doesn't update the local migration files. The next deployment breaks.
- **Prevention:** Use Supabase CLI exclusively for schema changes: `supabase migration new <name>`, write SQL, then `supabase db push`. Never modify schema through the Supabase dashboard on any environment other than local. Commit all files in `supabase/migrations/` to git. Run `supabase db diff` before any deployment to catch drift.
- **Phase to address:** Project setup, day 1. Establish this discipline before any table exists.

### Pitfall: `completed` Boolean Instead of a Progress State Machine
- **Warning sign:** You can't tell the difference between "user never started", "user is in progress", and "user completed". Resuming, analytics, and unlock logic all require hacks.
- **Prevention:** Use an enum or status column: `not_started | in_progress | completed | passed | failed`. This applies to lessons, quizzes, and cohort enrollment. A boolean `completed` is always the wrong model for learning progress.
- **Phase to address:** Initial schema design. Changing this after data is seeded requires a migration and backfill.

### Pitfall: No `deleted_at` Soft Delete — Hard Deletes Break History
- **Warning sign:** Deleting a cohort or lesson cascades and removes all enrollment and quiz records. Users lose their learning history. Foreign key violations appear on deletion.
- **Prevention:** Add `deleted_at TIMESTAMPTZ DEFAULT NULL` to all content tables (`cohorts`, `lessons`, `quizzes`). Filter with `WHERE deleted_at IS NULL` in all queries. Create a Supabase view that applies this filter so application code stays clean. Never hard-delete content that has user activity attached to it.
- **Phase to address:** Schema design. Add this to a table-creation checklist.

### Pitfall: N+1 Query Pattern in Cohort/Lesson Listings
- **Warning sign:** Loading the cohort dashboard makes 1 query to get cohorts, then N queries to get lesson counts, then N more to get user progress. The page takes 2–4 seconds on a dataset of 10 cohorts.
- **Prevention:** Use Supabase's `select` with joins and aggregates in a single query, or create a Postgres view/materialized view for the dashboard. Use `supabase-js` nested selects (`cohorts(*, lessons(*), enrollments(*))`) to let PostgREST generate an efficient join. Profile queries in the Supabase Dashboard > Database > Query Performance before demo.
- **Phase to address:** When building any listing screen. Catch this during the first integration of real data.

### Pitfall: Missing Indexes on Foreign Keys and Filter Columns
- **Warning sign:** Queries slow down noticeably as rows accumulate. `EXPLAIN ANALYZE` shows sequential scans on large tables.
- **Prevention:** Index every foreign key column and every column used in `WHERE` or `ORDER BY` clauses: `user_id`, `cohort_id`, `lesson_id`, `created_at`. In Supabase, add these in your migration files: `CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);`. Supabase does NOT automatically index foreign keys.
- **Phase to address:** During schema migration creation, before any table has production data.

---

## Cohort & Enrollment Logic

### Pitfall: No Enrollment Guard on Lesson Access
- **Warning sign:** A user can navigate directly to `/cohorts/[id]/lessons/[id]` without being enrolled. They can access all content by guessing IDs.
- **Prevention:** In the Server Component (or Route Handler) for lesson pages, query `enrollments WHERE user_id = auth.uid() AND cohort_id = :id AND status != 'cancelled'`. If no row exists, redirect to `/cohorts/[id]` with an enrollment prompt. Enforce this at the RLS level as well: `CREATE POLICY "enrolled users only" ON lessons FOR SELECT USING (EXISTS (SELECT 1 FROM enrollments WHERE user_id = auth.uid() AND cohort_id = lessons.cohort_id))`.
- **Phase to address:** When building the lesson view route. Do not leave this as a "we'll add it later" item.

### Pitfall: Cohort State Not Modeled — Open/Closed/Archived Are Just Booleans
- **Warning sign:** You can't gracefully handle "enrollment closed", "cohort in progress", or "cohort completed" without adding more boolean columns. Business logic becomes a maze of `if (active && !archived && enrollment_open)`.
- **Prevention:** Use a `status` enum on the `cohorts` table: `draft | enrollment_open | in_progress | completed | archived`. Drive all UI states (join button, locked content, etc.) from this single field. Add a `starts_at` and `ends_at` timestamp for scheduled transitions.
- **Phase to address:** Initial schema design, before any cohort management UI is built.

### Pitfall: Duplicate Enrollment Rows
- **Warning sign:** A user clicks "Join Cohort" twice quickly and gets two enrollment rows. Quiz scores and progress double-count.
- **Prevention:** Add a unique constraint: `UNIQUE (user_id, cohort_id)` on the `enrollments` table. Use `INSERT ... ON CONFLICT DO NOTHING` (or `DO UPDATE`) in the enrollment mutation. The constraint is the source of truth — do not rely on application-level deduplication alone.
- **Phase to address:** Schema creation and enrollment mutation implementation.

### Pitfall: Sequential Lesson Ordering Hardcoded as `created_at`
- **Warning sign:** You can't reorder lessons without changing their creation timestamps or doing a full data migration. Inserting a new lesson in the middle breaks the sequence.
- **Prevention:** Add an `order_index INTEGER NOT NULL` column to the `lessons` table. Fetch lessons with `ORDER BY order_index ASC`. Implement a simple drag-to-reorder admin UI that updates `order_index` values in batch. Reserve gaps (e.g., 10, 20, 30) to allow insertions without rewriting all rows.
- **Phase to address:** Lesson data model creation.

---

## Demo-Day Risks

### Risk: Demo Account Not Pre-Seeded
- **What breaks:** You sign up live on stage, wait for a confirmation email, it goes to spam. The cohort is empty. Lessons have no content. You improvise under pressure and the demo falls apart in the first 60 seconds.
- **Prevention:** Create a dedicated demo user (`demo@yourapp.com`) with a known password. Pre-enroll it in a demo cohort with at least 3 lessons, a quiz with 5 questions, and 10+ messages of AI tutor history. Test the full demo path end-to-end the night before using this account. Have a second identical account as a backup.

### Risk: Supabase Free Tier Pauses the Database
- **What breaks:** Supabase free tier projects pause after 7 days of inactivity. The demo opens to a 500 error.
- **Prevention:** Upgrade to Supabase Pro ($25/month) at least one week before the demo. Alternatively, set up a cron job (GitHub Actions or Vercel Cron) that hits a lightweight API route every 24 hours to keep the project active. Verify the project is unpaused the morning of the demo.

### Risk: Anthropic API Latency Spike During Demo
- **What breaks:** The AI tutor takes 8–12 seconds to respond during the live walkthrough. Silence on stage. You fill time awkwardly.
- **Prevention:** Have a pre-recorded or cached demo response for the AI tutor chat. Implement optimistic UI so the input clears and a typing indicator appears instantly. Pre-warm the connection by making an API call 5 minutes before the demo starts. Know Anthropic's status page URL to check in real time.

### Risk: Video Doesn't Load in Demo Environment Network
- **What breaks:** Corporate firewalls or conference Wi-Fi blocks video CDN domains. The lesson page shows a spinner indefinitely.
- **Prevention:** Test the full demo on the same network (or network type) as the venue at least 24 hours before. Have an offline fallback: a local video file served from Next.js `/public` folder as a last resort. Know which CDN domains your video provider uses and whether they require whitelisting.

### Risk: RLS Policy Blocks Demo Data Fetch
- **What breaks:** The demo account can't see the pre-seeded cohort because a RLS policy is scoped to a different `user_id`. The cohort list is empty.
- **Prevention:** After seeding demo data, log in as the demo account and walk through every step of the demo path at least once. Verify each data-fetch succeeds. Keep a Supabase SQL editor tab open during the demo to run emergency queries if needed.

### Risk: Environment Variables Missing in Production
- **What breaks:** Deployment succeeds but the app crashes on any page that uses Supabase or Claude API because `NEXT_PUBLIC_SUPABASE_URL` or `ANTHROPIC_API_KEY` is undefined at runtime.
- **Prevention:** Maintain a `.env.example` file with all required variable names (no values). Before each deployment, diff it against Vercel's environment variable list. Add a startup check in `app/layout.tsx` or a utility that throws a descriptive error at boot time if required vars are missing — fail fast with a clear message rather than a cryptic runtime error.

### Risk: Mobile/Tablet Layout Broken on Projector or Shared Screen
- **What breaks:** The demo is viewed on a large screen or shared via screenshare at a non-standard zoom level. Navigation collapses, the video player overflows, text truncates awkwardly.
- **Prevention:** Test at 1280px, 1440px, and 1920px viewport widths. Test at 125% and 150% browser zoom. Fix any layout-breaking issues at these sizes specifically. Do not rely on looking good only at your development resolution.

---

## Next.js App Router Gotchas

### Pitfall: Mixing `async` Server Components and Client State Without Boundaries
- **Warning sign:** You try to use `useState` or `useEffect` in a component that also does `await fetch()` or `await supabase.from(...)`. The build fails with `Error: async/await is not yet supported in Client Components`.
- **Prevention:** Strict separation: Server Components fetch data and pass it as props to Client Components. Client Components handle interactivity. If a subtree needs both, split it: a Server Component wrapper fetches data, renders a Client Component child with data as a prop. Never mark a data-fetching component `"use client"` — use a Server Action instead if you need a mutation.
- **Phase to address:** Architecture phase, before writing any component. This is the single most common App Router mistake.

### Pitfall: `cookies()` and `headers()` Called Outside of a Request Context
- **Warning sign:** Build error: `cookies() was called outside a request scope`. Happens when you try to access auth context in a shared utility called at module load time or in a static page.
- **Prevention:** Never call `cookies()` or `headers()` at the module level or inside `generateStaticParams`. They are request-scoped. Pass auth context down as function arguments or use dynamic rendering (`export const dynamic = 'force-dynamic'`) on pages that require per-request auth.
- **Phase to address:** When building any route that requires auth. This surfaces quickly in local dev — don't ignore it.

### Pitfall: `useRouter` from `next/navigation` Used in a Server Component
- **Warning sign:** `Error: useRouter only works in Client Components. Add the "use client" directive.`
- **Prevention:** For server-side redirects, use the `redirect()` function from `next/navigation` (imported without hooks). `useRouter`, `usePathname`, and `useSearchParams` are client-only hooks. Build a habit: if a component uses any `use*` hook, it must have `"use client"`.
- **Phase to address:** Any time navigation logic is added.

### Pitfall: Route Handler Cache Behavior Serving Stale Data
- **Warning sign:** A Route Handler returns data that was correct 30 minutes ago. Newly enrolled users don't appear. POST responses are cached when they shouldn't be.
- **Prevention:** Route Handlers with `GET` methods are cached by default in App Router when there is no dynamic usage. Add `export const dynamic = 'force-dynamic'` to any Route Handler that reads live data. All `POST`/`PATCH`/`DELETE` handlers are not cached, but `GET` handlers that read from databases always should be marked dynamic.
- **Phase to address:** Every Route Handler that reads from Supabase. Add this as a code review checklist item.

### Pitfall: `Suspense` Boundary Missing — Entire Page Blocked by Slow Fetch
- **Warning sign:** A page that loads a video, a quiz, and AI tutor history all waits for the slowest fetch before rendering anything. The user sees a blank screen for 2–3 seconds.
- **Prevention:** Wrap independent async sections in `<Suspense fallback={<Skeleton />}>`. Use parallel data fetching with `Promise.all` for data that is needed together. Introduce streaming by splitting slow sections (AI tutor history) into their own async Server Component subtrees. The lesson video should not wait for the AI tutor history to load.
- **Phase to address:** When building any page with multiple async data sources. This is a UX issue that is visually obvious during the demo.

### Pitfall: `"use client"` Directive Placed on a Layout — Kills Server Rendering for Entire Subtree
- **Warning sign:** You added `"use client"` to `app/(dashboard)/layout.tsx` to access a context provider. Now every page in that layout is a Client Component. Data fetching moves to the client. Performance degrades. Supabase server client calls fail silently.
- **Prevention:** Never add `"use client"` to layout files unless absolutely necessary. Instead, create a thin Client Component wrapper for just the context provider and place it inside the layout's JSX, leaving the layout itself as a Server Component: `<DashboardProviders>{children}</DashboardProviders>` where `DashboardProviders` is the only Client Component.
- **Phase to address:** When setting up the authenticated dashboard layout. This is a structural decision that is costly to reverse.
