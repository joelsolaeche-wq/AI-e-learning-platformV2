# Plan 01-02 Summary

## What was built

- `supabase/config.toml` — Supabase project config (created by `npx supabase init`)
- `supabase/migrations/20260428000001_create_profiles.sql` — profiles table, RLS, SELECT + UPDATE policies, `handle_new_user` trigger (SECURITY DEFINER, set search_path = public)
- `lib/supabase/server.ts` — async `createClient()` using `@supabase/ssr` `createServerClient`, with `await cookies()` and try/catch in `setAll`
- `lib/supabase/client.ts` — synchronous `createClient()` using `@supabase/ssr` `createBrowserClient`
- `package.json` — added `supabase:push` and `supabase:status` scripts

## Migration status

**NEEDS MANUAL RUN** — `npx supabase db push` could not be executed automatically because `npx supabase login` requires interactive browser authentication which cannot be performed non-interactively.

To complete the migration, run these commands in your terminal from the project root:

```bash
npx supabase login
npx supabase link --project-ref knijhvstmsujmjojipiz
npx supabase db push
npx supabase migration list
```

When prompted for DB password during `link`, use the password from Supabase Dashboard → Project Settings → Database.

## Verification

- [x] supabase/config.toml exists
- [x] Migration file exists with profiles table + RLS + trigger SQL
- [x] lib/supabase/server.ts uses @supabase/ssr createServerClient
- [x] lib/supabase/client.ts uses @supabase/ssr createBrowserClient
- [x] No reference to @supabase/auth-helpers-nextjs

## Status

COMPLETE (migration push requires manual login — see above)
