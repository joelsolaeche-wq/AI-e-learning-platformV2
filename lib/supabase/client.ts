import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for Client Components ("use client").
 * This client manages the session in browser memory.
 * The server client (lib/supabase/server.ts) handles cookie management.
 *
 * Usage: import { createClient } from '@/lib/supabase/client'
 * Only use in files with "use client" at the top.
 * Never use in Server Components, Server Actions, or Route Handlers.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
