# Phase 1 Research: Auth + RLS Foundation

> Stack: Next.js 15 App Router · Supabase (`@supabase/ssr@^0.5.x`) · shadcn/ui · Tailwind v4
> Requirements covered: AUTH-01, AUTH-02, AUTH-03, AUTH-04
> Date: 2026-04-28

---

## Supabase SSR Setup

### The two clients and where each lives

`@supabase/ssr@^0.5.x` replaces the deprecated `auth-helpers-nextjs` package entirely. Do not install `@supabase/auth-helpers-nextjs`. The two clients are:

**`createServerClient`** — used in any server context (Server Components, Server Actions, Route Handlers, middleware). It reads/writes session cookies via Next.js `cookies()`. Because `cookies()` returns a read-only store in some contexts (Server Components), the `setAll` handler must be wrapped in a `try/catch` so it does not throw when the store is read-only.

**`createBrowserClient`** — used only in Client Components (`"use client"`). It manages the session in browser memory (no cookie access needed; the server client already set the cookie).

### Server client (`lib/supabase/server.ts`)

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()   // must be awaited in Next.js 15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies are read-only, ignore
          }
        },
      },
    }
  )
}
```

### Browser client (`lib/supabase/client.ts`)

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Usage rules

| Context | Client to use | Import from |
|---|---|---|
| Server Component (async function) | `createServerClient` | `@/lib/supabase/server` |
| Server Action (`"use server"`) | `createServerClient` | `@/lib/supabase/server` |
| Route Handler (`route.ts`) | `createServerClient` | `@/lib/supabase/server` |
| Middleware (`middleware.ts`) | `createServerClient` with `request`/`response` cookie adapter | inline in middleware |
| Client Component (`"use client"`) | `createBrowserClient` | `@/lib/supabase/client` |

### Critical: `cookies()` must be awaited in Next.js 15

In Next.js 15, `cookies()` is an async API. Always `await cookies()` before calling `getAll()` or `set()`. Forgetting this is a silent bug — the client will be created but the session cookies will be empty, making every server-side auth check return `null`.

---

## Middleware Pattern

Middleware is the only place that can refresh the Supabase session token and set updated cookies before a route renders. Without it, sessions silently expire mid-visit (AUTH-02 fails — users get logged out between requests).

### `middleware.ts` (project root, alongside `app/`)

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Must set on both request and response for Next.js 15 cookie propagation
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT call supabase.auth.getSession() here.
  // getSession() reads from the cookie without verifying the JWT.
  // getUser() validates the JWT with the Supabase Auth server — use this.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protected route redirect
  const protectedPaths = ['/dashboard', '/cohorts', '/admin']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals.
     * This ensures middleware runs on every navigation for session refresh.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Why `getUser()` not `getSession()` in middleware

`supabase.auth.getSession()` returns the session object from the JWT stored in the cookie without contacting the Supabase Auth server. It cannot detect a revoked/invalidated session. `supabase.auth.getUser()` makes a network call to verify the JWT is still valid. Always use `getUser()` in middleware and in any security-sensitive server context. The performance cost is one network round-trip, which is acceptable in middleware.

---

## Auth Route Structure

### Next.js App Router folder layout for Phase 1

```
app/
├── layout.tsx                  # Root layout — providers only, no "use client" on layout
├── page.tsx                    # Landing/marketing page (public)
│
├── auth/
│   ├── login/
│   │   └── page.tsx            # Login form (Client Component)
│   ├── register/
│   │   └── page.tsx            # Register form (Client Component)
│   ├── callback/
│   │   └── route.ts            # GET: exchange PKCE code for session, redirect to /dashboard
│   └── logout/
│       └── route.ts            # POST: sign out, clear cookies, redirect to /login
│
├── dashboard/
│   └── page.tsx                # Protected: authenticated home (Server Component)
│
middleware.ts                   # Session refresh + redirect guard
```

### Auth callback route (`app/auth/callback/route.ts`)

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error state on failure
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
```

### Logout route (`app/auth/logout/route.ts`)

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
```

### Login/Register pages

Both are Client Components (`"use client"`) that use the browser Supabase client for `signInWithPassword` / `signUp`. After a successful call, redirect via `router.push('/dashboard')` — but the middleware will have already refreshed the session cookie by the time the redirect resolves.

### Dashboard page (protected Server Component)

```ts
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')   // belt-and-suspenders; middleware already guards this

  return <div>Welcome, {user.email}</div>
}
```

### Root layout — no `"use client"` on layout files

The root `app/layout.tsx` must remain a Server Component. If you need a provider (e.g., `ThemeProvider`), wrap only the provider element inside the layout JSX — do not put `"use client"` on the layout file itself.

```tsx
// app/layout.tsx — Server Component
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## Supabase Migrations

### CLI setup (one-time, run from project root)

```bash
# Install Supabase CLI (if not already installed)
npm install --save-dev supabase

# Initialize Supabase project config (creates supabase/ folder)
npx supabase init

# Link to your cloud project (get project ref from Supabase dashboard URL)
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### Folder structure after init

```
supabase/
├── config.toml               # Project config (db port, auth settings, etc.)
├── migrations/
│   └── 20260428000001_create_profiles.sql   # First migration
└── seed.sql                  # Optional: demo data seed (run separately)
```

### Migration file naming convention

Always use a timestamp prefix: `YYYYMMDDHHMMSS_description.sql`. The Supabase CLI applies migrations in lexicographic order, so the timestamp prefix ensures correct ordering.

### First migration commands

```bash
# Create the migration file (auto-timestamps it)
npx supabase migration new create_profiles

# After editing the file, apply to cloud DB:
npx supabase db push

# Apply to local dev DB (requires Docker):
npx supabase db reset
```

### First migration content (`supabase/migrations/20260428000001_create_profiles.sql`)

```sql
-- Enable pgcrypto for gen_random_uuid() if not already available
create extension if not exists "pgcrypto";

-- profiles table — extends auth.users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'learner'
                check (role in ('learner', 'instructor', 'admin')),
  org_id      uuid,   -- FK to organizations added in Phase 2
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: enable and add policies (see RLS section)
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger function: auto-create profile on new auth.users row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

-- Trigger: fires after every new row in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Key CLI commands to know

```bash
npx supabase db push          # Push all pending migrations to linked cloud project
npx supabase db pull          # Pull remote schema changes into a new migration file
npx supabase migration list   # Show applied/pending migration status
npx supabase db reset         # Drop and recreate local DB, replay all migrations + seed.sql
npx supabase status           # Show local service URLs and status
```

Rule from architecture decisions: **never modify schema via the Supabase dashboard**. All schema changes go through migration files committed to version control.

---

## RLS Policies for Phase 1

Phase 1 only creates the `profiles` table. All other tables are created in Phase 2. RLS must be enabled and policies added in the same migration that creates each table.

### Profiles table — Phase 1 policies

```sql
-- Enable RLS (table is locked down by default after this)
alter table public.profiles enable row level security;

-- SELECT: a user can only read their own profile row
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- UPDATE: a user can only update their own profile row
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT: block direct client inserts — the trigger handles profile creation
-- (no INSERT policy = INSERT is blocked for all authenticated users via RLS)
-- The trigger runs as SECURITY DEFINER so it bypasses RLS.

-- DELETE: no policy = delete is blocked (intentional — profiles are not user-deletable in v1)
```

### Policy rationale

- No INSERT policy is needed because the `handle_new_user` trigger is `SECURITY DEFINER` — it runs with the permissions of the function owner (postgres), not the calling user, so it bypasses RLS.
- No DELETE policy is intentional. In v1, account deletion is out of scope.
- The `for all` shorthand (as used in the architecture doc) is functionally equivalent to separate policies but less explicit. Prefer separate per-operation policies for auditability.

### Verifying RLS blocks unauthenticated reads (Success Criterion 5)

Test this from the Supabase SQL editor using an anon role query:

```sql
-- Run as anon (no JWT) — should return 0 rows
set role anon;
select * from public.profiles;
-- Expected: 0 rows (RLS blocks unauthenticated access)
reset role;
```

Or from a terminal with the anon key (not the service role key):

```bash
curl -H "apikey: <SUPABASE_ANON_KEY>" \
     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
     "https://<project>.supabase.co/rest/v1/profiles"
# Expected: [] (empty array)
```

---

## Profile Auto-Creation Trigger

The trigger bridges `auth.users` (managed by Supabase, in the `auth` schema) and `public.profiles` (your app schema). Every time a new user signs up, the trigger fires and inserts a matching profiles row.

```sql
-- Function: runs with SECURITY DEFINER to bypass RLS on profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public        -- prevents search_path injection attacks
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'  -- populated if passed at signUp()
  );
  return new;
end;
$$;

-- Trigger: after insert on auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Passing full_name at sign-up

On the client, when calling `supabase.auth.signUp()`, pass `full_name` via the `options.data` field — Supabase stores this in `auth.users.raw_user_meta_data`:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName },
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

### Important: `emailRedirectTo` for the PKCE flow

Supabase uses PKCE (Proof Key for Code Exchange) by default in `@supabase/ssr`. After email confirmation, Supabase redirects to `emailRedirectTo?code=<code>`. Your `/auth/callback` route handler must call `supabase.auth.exchangeCodeForSession(code)` to complete the session handshake. Omitting `emailRedirectTo` will cause the redirect to go to the default Supabase confirmation page — not your app.

---

## shadcn/ui + Tailwind v4 Dark Setup

### Install shadcn/ui with Tailwind v4

```bash
npx shadcn@latest init
```

When prompted, select:
- Style: New York (recommended for the dark premium aesthetic)
- Base color: Zinc or Slate (works best with forced dark)
- CSS variables: Yes

### Forced dark mode — never light, never system

The goal is a forced dark theme that ignores the OS preference. This requires two things:

1. `next-themes` with `forcedTheme="dark"`
2. Tailwind v4 configured to use the `class` strategy

### `components/theme-provider.tsx`

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### `app/layout.tsx` — forced dark

```tsx
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"    // this is the key — ignores OS preference entirely
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Tailwind v4 configuration (`app/globals.css`)

Tailwind v4 uses CSS-first configuration. The `tailwind.config.ts` file is no longer the primary config location. Add dark mode via CSS:

```css
@import "tailwindcss";

/* Tell Tailwind v4 to use the .dark class strategy */
@variant dark (&:where(.dark, .dark *));

/* shadcn/ui CSS variables — dark theme values */
:root {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;
  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;
  --radius: 0.5rem;
}
```

Since `forcedTheme="dark"` is set, `next-themes` will always add the `dark` class to `<html>`. The `:root` CSS variables above define dark values by default — there is no light-mode `:root` block because the app is dark-only.

### `suppressHydrationWarning` on `<html>`

This attribute is required when using `next-themes`. Without it, React will warn about a class mismatch between server render (no `dark` class) and client hydration (next-themes adds `dark` class). The warning is a false positive; `suppressHydrationWarning` silences it.

---

## Environment Variables

### Required variables

```bash
# .env.local (never committed to git)

# Supabase project URL — safe to expose in browser (used by browser client)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co

# Supabase anon key — safe to expose in browser (RLS is the security layer)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Supabase service role key — SERVER ONLY, never expose to browser
# Needed for admin operations that bypass RLS (e.g., seeding, background jobs)
# Do NOT prefix with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Where to find these values

In the Supabase dashboard: Project Settings → API → Project URL and Project API Keys.

### Phase 1 does not need these yet (noted for completeness)

```bash
# Needed in Phase 6 (AI tutor)
ANTHROPIC_API_KEY=sk-ant-...

# Needed in Phase 4 (video)
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...
```

### `.env.example` (committed to git)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# ANTHROPIC_API_KEY=        # Phase 6
# MUX_TOKEN_ID=             # Phase 4
# MUX_TOKEN_SECRET=         # Phase 4
```

### Boot-time env validation (recommended)

Add a check in `lib/env.ts` that throws at startup if required variables are missing, rather than getting cryptic `undefined` errors at runtime:

```ts
// lib/env.ts
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}
```

### Vercel deployment

Add each variable in Vercel dashboard → Project → Settings → Environment Variables. The `NEXT_PUBLIC_` prefix makes variables available on the client bundle — do not use this prefix for secrets. The `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never appear in a `NEXT_PUBLIC_` variable.

---

## File List

Every file that needs to be created or modified in Phase 1, grouped by concern.

### Supabase / Database

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260428000001_create_profiles.sql` | Create | Profiles table + RLS policies + trigger |
| `supabase/config.toml` | Generated by `supabase init` | Project config |

### Supabase Client Utilities

| File | Action | Purpose |
|---|---|---|
| `lib/supabase/server.ts` | Create | `createClient()` for server contexts |
| `lib/supabase/client.ts` | Create | `createClient()` for client components |

### Middleware

| File | Action | Purpose |
|---|---|---|
| `middleware.ts` | Create | Session refresh + protected route redirects |

### Auth Routes

| File | Action | Purpose |
|---|---|---|
| `app/auth/login/page.tsx` | Create | Login form (Client Component) |
| `app/auth/register/page.tsx` | Create | Registration form (Client Component) |
| `app/auth/callback/route.ts` | Create | PKCE code exchange → session cookie |
| `app/auth/logout/route.ts` | Create | Sign out + redirect to /auth/login |

### Server Actions

| File | Action | Purpose |
|---|---|---|
| `lib/actions/auth.actions.ts` | Create | `signUp`, `signIn`, `signOut` server actions |

### Dashboard

| File | Action | Purpose |
|---|---|---|
| `app/dashboard/page.tsx` | Create | Protected home page skeleton |

### Root Layout + Theme

| File | Action | Purpose |
|---|---|---|
| `app/layout.tsx` | Create/modify | Root layout with ThemeProvider |
| `app/globals.css` | Create/modify | Tailwind v4 import + dark CSS variables |
| `components/theme-provider.tsx` | Create | `next-themes` wrapper component |

### Environment

| File | Action | Purpose |
|---|---|---|
| `.env.local` | Create (not committed) | Local Supabase credentials |
| `.env.example` | Create (committed) | Template for team members and Vercel |
| `lib/env.ts` | Create | Boot-time env validation |

### Config / Project Root

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add `@supabase/ssr`, `@supabase/supabase-js`, `next-themes` |

---

## Pitfalls for This Phase

### Pitfall 1: `cookies()` is async in Next.js 15 — silent session bugs if not awaited

In Next.js 15, `cookies()` returns a Promise. If you write `const cookieStore = cookies()` (without `await`), the Supabase server client is created with an unresolved promise as its cookie store. All `getAll()` calls return empty arrays, making `supabase.auth.getUser()` return `null` for every request — the app appears to have broken auth with no error message.

Fix: always `await cookies()` before passing to the Supabase client factory.

### Pitfall 2: Using `getSession()` instead of `getUser()` in middleware — sessions that "never expire"

`supabase.auth.getSession()` reads the JWT from the cookie and returns it without contacting the Supabase Auth server. A revoked, expired, or invalidated session will still pass `getSession()` as long as the cookie exists. The correct call in middleware (and any server-side auth gate) is `supabase.auth.getUser()`, which validates the JWT server-side. Using `getSession()` in middleware is a security gap that passes the Supabase linter warning.

### Pitfall 3: Not returning the `supabaseResponse` object from middleware — cookies never written to the browser

In `@supabase/ssr`, the middleware Supabase client writes refreshed session cookies onto the response object it was given. If you return a different `NextResponse` object (e.g., a freshly constructed redirect that doesn't carry the updated cookies), the token refresh is lost. The browser never receives the updated cookie, the session expires on the next request, and AUTH-02 (stay logged in across sessions) fails.

The fix is to always use the `supabaseResponse` variable constructed inside the middleware for all returns (both the pass-through and the redirect cases). The redirect `NextResponse` must be rebuilt from `supabaseResponse` headers, or session cookies must be manually copied onto it.

---

## RESEARCH COMPLETE
