---
phase: 02
status: issues_found
depth: standard
files_reviewed: 7
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
reviewed_at: 2026-04-28
---

# Code Review: Phase 02 — Data Model + Course Catalog

## Summary

The overall architecture is sound — correct auth patterns (getUser), awaited cookies/params, and proper RLS coverage on all tables. One critical issue exists: the catalog detail page uses the route param `courseId` directly in a Supabase `.eq()` filter without UUID validation, enabling a potential DoS/error-path via malformed input. Several warnings cover missing FK indexes, a seed idempotency gap, a quiz_definitions RLS over-exposure, and a cohort link routing mismatch.

---

## Findings

### CR-01: Unvalidated UUID param passed directly to DB query (critical)
**File:** `app/catalog/[courseId]/page.tsx` line 46
**Issue:** `courseId` comes from the URL path and is passed directly to `.eq('id', courseId)` and `.eq('course_id', courseId)` without any format validation. If a visitor (or bot) hits `/catalog/not-a-uuid`, Postgres will throw an `invalid_text_representation` error (22P02). Supabase surfaces this as a non-null `error` object from `single()`, which triggers `notFound()` — so there is no data leak — but it also generates noisy server-side error logs and wastes a round-trip to the database on every malformed request. More critically, the modules and cohorts queries run in `Promise.all` alongside the course query, meaning *all three* DB calls fire before any UUID check occurs.
**Fix:** Add a lightweight UUID format guard before the parallel fetches:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(courseId)) notFound()
```
Place this immediately after `await params` (line 34), before the `Promise.all` block.

---

### WR-01: Missing indexes on all FK columns (warning)
**File:** `supabase/migrations/20260428000002_create_remaining_tables.sql` lines 26–159
**Issue:** None of the FK columns have explicit `CREATE INDEX` statements. Postgres does not automatically index FK targets. The following FK columns will cause sequential scans as data grows:
- `courses.org_id`
- `modules.course_id`
- `lessons.module_id`
- `cohorts.course_id`
- `enrollments.user_id`, `enrollments.cohort_id`
- `lesson_progress.user_id`, `lesson_progress.lesson_id`
- `quiz_attempts.user_id`, `quiz_attempts.lesson_id`, `quiz_attempts.cohort_id`
- `ai_chat_sessions.user_id`, `ai_chat_sessions.lesson_id`
- `ai_chat_messages.session_id`
- `quiz_definitions.lesson_id` (unique constraint creates an index, this one is fine)

The unique constraints on `(course_id, position)` in modules and `(module_id, position)` in lessons do create implicit indexes for those pairs, but the individual FK columns are still unindexed for reverse-lookup joins.
**Fix:** Add a block of `CREATE INDEX` statements at the end of the migration, e.g.:
```sql
create index on public.courses (org_id);
create index on public.modules (course_id);
create index on public.lessons (module_id);
create index on public.cohorts (course_id);
create index on public.enrollments (user_id);
create index on public.enrollments (cohort_id);
create index on public.lesson_progress (user_id);
create index on public.lesson_progress (lesson_id);
create index on public.quiz_attempts (user_id);
create index on public.quiz_attempts (lesson_id);
create index on public.quiz_attempts (cohort_id);
create index on public.ai_chat_sessions (user_id);
create index on public.ai_chat_sessions (lesson_id);
create index on public.ai_chat_messages (session_id);
```

---

### WR-02: quiz_definitions RLS exposes correct_answer to all authenticated users (warning)
**File:** `supabase/migrations/20260428000002_create_remaining_tables.sql` lines 235–238
**Issue:** The policy `"Authenticated users can view quiz definitions"` grants `SELECT` on the entire `quiz_definitions` row — including the `questions` JSONB column which embeds `correct_answer` for every question (visible in seed.sql lines 118, 130, 142). Any authenticated user can run `SELECT questions FROM quiz_definitions` via the Supabase client and read all correct answers before submitting. The comment on line 69 in the migration explicitly warns "NEVER expose correct_answer to the client — server-side scoring only," but the RLS policy contradicts this intent.
**Fix:** Two options — either (a) split `questions` into two JSONB columns: `questions_display` (no answers) and `questions_answers` (answers only, no SELECT policy for users), or (b) keep the current schema but strip `correct_answer` from the JSONB in a server-side DB view or in the Route Handler before sending to the client. Option (a) is cleaner long-term. For Phase 2 where quizzes are not yet interactive, add a comment marking this as a known issue to fix before Phase 4 (quiz submission).

---

### WR-03: Seed ON CONFLICT does not update stale rows (warning)
**File:** `supabase/seed.sql` lines 16–162
**Issue:** All inserts use `ON CONFLICT (id) DO NOTHING`. This is safe for idempotent re-runs but means that if seed data changes (e.g., a lesson transcript is updated, a cohort date shifts), re-running the seed will silently leave the old data in place with no indication of the skip. For a demo platform where seed data is actively iterated, this is a maintenance footgun.
**Fix:** Change to `ON CONFLICT (id) DO UPDATE SET ...` for mutable fields, or document clearly that seed changes require `supabase db reset` (which wipes and replays from scratch). At minimum add a comment warning that `DO NOTHING` means stale fields survive re-runs.

---

### WR-04: Catalog detail page links to courseId but catalog list navigates by id (warning)
**File:** `app/catalog/page.tsx` line 94
**Issue:** The "View Course" button links to `/catalog/${course.id}` (UUID), and the detail page route is `[courseId]` which accepts this. However, the `courses` table has a `slug` column (unique, human-readable) that is populated in seed data (`generative-ai-fundamentals`). The migration comment at line 22 explicitly states "slug is unique so /catalog/[slug] is human-readable in future." Using the raw UUID in the URL produces ugly, non-shareable URLs and undermines the slug investment. The route param is also named `courseId` suggesting UUID intent, but `courseSlug` + slug-based lookup would be more consistent with the stated design.
**Fix:** For Phase 2, this is acceptable as a known gap. Add a TODO comment on line 94 of `catalog/page.tsx`: `{/* TODO Phase 3+: switch to /catalog/${course.slug} once slug-based lookup is wired */}`. If switching now, update the detail page to query `.eq('slug', courseSlug)` instead of `.eq('id', courseId)`.

---

### WR-05: Cohort status filter missing — cancelled/draft cohorts shown to users (warning)
**File:** `app/catalog/[courseId]/page.tsx` lines 68–71
**Issue:** The cohorts query fetches all cohorts for a course ordered by `starts_at`, with no filter on `status`. This means `draft` cohorts (not yet announced) and `cancelled` cohorts will appear in the "Available Cohorts" section alongside `active` and `completed` ones. A user could attempt to join a cancelled cohort.
**Fix:** Add a status filter to show only relevant cohorts to learners:
```ts
.in('status', ['active', 'completed'])
```
Or for the demo, just `.eq('status', 'active')` if only joinable cohorts should appear.

---

### IN-01: profiles FK migration is not idempotent (info)
**File:** `supabase/migrations/20260428000002_create_remaining_tables.sql` lines 163–168
**Issue:** The `ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_org ...` statement has no guard. If the migration is applied twice (e.g., during a `db reset` cycle where the first migration already ran `create table if not exists public.profiles`), this will fail with `constraint "fk_profiles_org" for relation "profiles" already exists`. The table creation statements use `if not exists`, but the `alter table` does not.
**Fix:** Wrap with a conditional or use the Supabase migration idempotency pattern:
```sql
do $$ begin
  alter table public.profiles add constraint fk_profiles_org
    foreign key (org_id) references public.organizations(id) on delete set null;
exception when duplicate_object then null;
end $$;
```

---

### IN-02: thumbnail_url rendered without domain validation — open redirect risk (info)
**File:** `app/catalog/page.tsx` line 65; `app/catalog/[courseId]/page.tsx` line 93
**Issue:** `course.thumbnail_url` is rendered directly in an `<img src={...}>` tag. If a malicious admin inserts a `javascript:` URI or a data URI, browsers will refuse to load it as an image (img src does not execute JS), so this is not XSS. However, it is worth noting that `thumbnail_url` is entirely untrusted data from the DB. The risk is low given RLS prevents public writes, but the field has no format validation in the schema.
**Fix:** Low priority for demo. For production, add a `CHECK (thumbnail_url ~ '^https?://')` constraint to the `courses` table, or validate at insert time. Consider using Next.js `<Image>` component with a configured `domains` allowlist in `next.config.ts` which provides implicit URL validation and optimization.

---

### IN-03: Error from DB query silently discarded in detail page (info)
**File:** `app/catalog/[courseId]/page.tsx` lines 75–76
**Issue:** Errors from `modulesResult` and `cohortsResult` are silently swallowed — the code falls back to empty arrays (`?? []`) with no error logged or surfaced. If the modules query fails due to a transient DB error, the page renders with an empty course outline and no indication to the user or developer.
**Fix:** Add error logging at minimum:
```ts
if (modulesResult.error) console.error('[CourseDetailPage] modules fetch error:', modulesResult.error)
if (cohortsResult.error) console.error('[CourseDetailPage] cohorts fetch error:', cohortsResult.error)
```
For user-facing feedback, consider a banner similar to the one in `catalog/page.tsx` (lines 40–43).

---

### IN-04: middleware setAll recreates NextResponse on every cookie write (info)
**File:** `middleware.ts` lines 18–22
**Issue:** Inside `setAll`, the code calls `NextResponse.next({ request })` to create a new response object each time cookies need to be written. This is the pattern from the official Supabase SSR docs and is functionally correct, but it discards any response headers set before `setAll` is called (since `supabaseResponse` is reassigned). For Phase 2 this is harmless, but if middleware is extended to set custom headers (e.g., `x-user-id`, CSP headers) before the Supabase client is created, those headers will be lost.
**Fix:** No action needed for Phase 2. Document this behavior with a comment so future middleware additions set custom headers *after* the `supabase.auth.getUser()` call, not before.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `supabase/migrations/20260428000002_create_remaining_tables.sql` | 337 | ⚠ issues (WR-01, WR-02, IN-01) |
| `supabase/seed.sql` | 163 | ⚠ issues (WR-03) |
| `lib/supabase/server.ts` | 41 | ✓ clean |
| `lib/supabase/client.ts` | 18 | ✓ clean |
| `middleware.ts` | 61 | ⚠ issues (IN-04) |
| `app/catalog/page.tsx` | 103 | ⚠ issues (WR-04, IN-02) |
| `app/catalog/[courseId]/page.tsx` | 208 | ⚠ issues (CR-01, WR-05, IN-02, IN-03) |
