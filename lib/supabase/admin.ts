import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

export function createAdminClient() {
  if (!env.supabaseServiceRoleKey) {
    throw new Error(
      '[supabase/admin] SUPABASE_SERVICE_ROLE_KEY is not set. createAdminClient() ' +
        'is for server-only privileged access and cannot run without it.',
    )
  }
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
