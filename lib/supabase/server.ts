import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

/**
 * Creates a Supabase client for server contexts:
 * - Server Components (async functions)
 * - Server Actions ("use server")
 * - Route Handlers (route.ts)
 * - Middleware (via a different cookie adapter — see middleware.ts)
 *
 * IMPORTANT: cookies() must be awaited in Next.js 15.
 * Forgetting the await causes every auth check to return null (silent bug).
 */
export async function createClient() {
  const cookieStore = await cookies()   // await is required in Next.js 15

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // The middleware will handle writing the refreshed session cookie.
            // This catch is intentional and expected; do not remove it.
          }
        },
      },
    }
  )
}
