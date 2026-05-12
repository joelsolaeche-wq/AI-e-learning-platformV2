// Admin queries for the `profiles` (user) and `organizations` (company)
// tables. Every function here:
//
//   1. Calls `assertAdmin()` first — service-role queries must never run
//      without an admin gate. If the page already gates, the second call is
//      cheap (Supabase caches the auth check inside the request) and acts
//      as defense-in-depth so a future page that forgets the gate is still
//      protected at the data layer.
//
//   2. Uses `createAdminClient()` internally. Pages and route handlers
//      should NOT import `createAdminClient` directly — they should call a
//      function from `lib/queries/admin/*` so the gate-then-query
//      invariant is preserved.
//
// See CLAUDE.md → "Layer rules" → rule 1 for the import policy this module
// is the implementation of.

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth/guards'
import { ADMIN_USER_SEARCH_LIMIT } from '@/lib/constants/limits'

const PAGE_SIZE = 20

export type UserListRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  avatar_url: string | null
  created_at: string
}

export type UserListResult = {
  users: UserListRow[]
  count: number
  totalPages: number
}

export type UserListParams = {
  page: number
  /** Already-sanitized search term — pass an empty string for no filter. */
  q: string
  /** One of: 'learner' | 'instructor' | 'admin' — anything else is ignored. */
  roleFilter: string
  /** 'true' | 'false' | '' (no filter). */
  activeFilter: string
}

export async function listUsers(params: UserListParams): Promise<UserListResult | null> {
  const caller = await assertAdmin()
  if (!caller) return null

  const offset = (Math.max(1, params.page) - 1) * PAGE_SIZE
  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select('id, email, full_name, role, is_active, avatar_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.q) query = query.or(`email.ilike.%${params.q}%,full_name.ilike.%${params.q}%`)
  if (params.roleFilter && ['learner', 'instructor', 'admin'].includes(params.roleFilter)) {
    query = query.eq('role', params.roleFilter)
  }
  if (params.activeFilter === 'true') query = query.eq('is_active', true)
  else if (params.activeFilter === 'false') query = query.eq('is_active', false)

  const { data, count } = await query
  return {
    users: (data ?? []) as UserListRow[],
    count: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  }
}

export type UserDetailRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  org_id: string | null
}

export type CompanyOption = {
  id: string
  name: string
}

export async function getUserById(
  userId: string,
): Promise<{ user: UserDetailRow; companies: CompanyOption[] } | null> {
  const caller = await assertAdmin()
  if (!caller) return null

  const admin = createAdminClient()

  const [userRes, companiesRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, role, is_active, org_id')
      .eq('id', userId)
      .single(),
    admin
      .from('organizations')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  if (!userRes.data) return null
  return {
    user: userRes.data as UserDetailRow,
    companies: (companiesRes.data ?? []) as CompanyOption[],
  }
}

export async function listCompaniesForForm(): Promise<CompanyOption[] | null> {
  const caller = await assertAdmin()
  if (!caller) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  return (data ?? []) as CompanyOption[]
}

/**
 * Search for users by email or full_name partial match. Used by the cohort
 * invitation autocomplete in /admin/cohorts. Returns up to
 * ADMIN_USER_SEARCH_LIMIT rows. Caller must have admin or instructor role.
 *
 * Note: this function is exposed for `/api/admin/user-by-email` and is the
 * only `listUsers`-style helper that allows instructors. It re-validates
 * the role explicitly because `assertAdmin` is too narrow.
 */
export type UserSearchRow = { id: string; email: string; full_name: string | null }

export async function searchUsersForAdmin(query: string): Promise<UserSearchRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .or(`email.ilike.%${query.toLowerCase().trim()}%,full_name.ilike.%${query.trim()}%`)
    .limit(ADMIN_USER_SEARCH_LIMIT)
  return (data ?? []) as UserSearchRow[]
}
