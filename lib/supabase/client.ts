import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

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
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
}
