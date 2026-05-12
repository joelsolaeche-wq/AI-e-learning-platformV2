// Centralized auth/role guards for Server Actions and Route Handlers.
//
// Before this module, each lib/actions/*.actions.ts file declared its own
// private `assertAdmin*` helper. The same name (`assertAdminOrInstructor`)
// existed in two files with DIFFERENT allowed-role sets — a silent
// bug-prone inconsistency: cohorts.actions.ts admitted company_owner,
// courses.actions.ts did not. This module replaces all of those.
//
// Every guard:
//   - validates the session via supabase.auth.getUser() (server-validated)
//   - reads profiles.role + org_id once
//   - returns `{ user, role, orgId } | null` so callers can early-return on null
//
// For the company-scope check used by company_owner mutations, see
// `requireCompanyAccess()` below.

import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import {
  ADMIN_ONLY,
  ADMIN_OR_INSTRUCTOR,
  ADMIN_OR_INSTRUCTOR_OR_OWNER,
  ADMIN_OR_OWNER,
  type Role,
} from './roles'

export type Caller = {
  user: User
  role: Role
  orgId: string | null
}

async function loadCaller(): Promise<Caller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Cast through unknown: even with the regenerated database.types.ts, the
  // generic chain in @supabase/supabase-js@2.105.1 widens the result to
  // `never` here. Tracked alongside the rest of the codebase's
  // `supabase` casts in the cast-cleanup PR.
  type ProfileRow = { role: string; org_id: string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single<ProfileRow>()

  if (!profile) return null
  return {
    user,
    role: profile.role as Role,
    orgId: profile.org_id,
  }
}

function callerWithRoleIn(allowed: readonly Role[]) {
  return async (): Promise<Caller | null> => {
    const caller = await loadCaller()
    if (!caller) return null
    return (allowed as readonly string[]).includes(caller.role) ? caller : null
  }
}

/** Allow callers with role === 'admin'. */
export const assertAdmin = callerWithRoleIn(ADMIN_ONLY)

/** Allow callers with role === 'admin' OR role === 'company_owner'. */
export const assertAdminOrOwner = callerWithRoleIn(ADMIN_OR_OWNER)

/** Allow callers with role === 'admin' OR role === 'instructor'. (NOT company_owner.) */
export const assertAdminOrInstructor = callerWithRoleIn(ADMIN_OR_INSTRUCTOR)

/**
 * Allow callers with role in {admin, instructor, company_owner}. This is the
 * widest "staff-level" gate — use it when company_owner is intentionally
 * included alongside instructors (e.g. cohort management within their org).
 */
export const assertAdminOrStaff = callerWithRoleIn(ADMIN_OR_INSTRUCTOR_OR_OWNER)
