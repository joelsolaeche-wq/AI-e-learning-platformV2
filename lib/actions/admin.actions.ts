'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

export type AdminActionResult = { error: string | null; success?: boolean }

export type ImportResult = {
  created: number
  skipped: number
  errors: Array<{ row: number; email: string; reason: string }>
}

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? user : null
}

export async function updateUserRoleAction(
  userId: string,
  role: 'learner' | 'instructor' | 'admin' | 'company_owner',
): Promise<AdminActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { error: null, success: true }
}

export async function toggleUserStatusAction(
  userId: string,
  isActive: boolean,
): Promise<AdminActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { error: null, success: true }
}

export async function adminUpdateUserAction(
  _prevState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const userId = formData.get('user_id') as string
  const fullName = (formData.get('full_name') as string | null)?.trim() ?? null
  const role = formData.get('role') as string
  const isActive = formData.get('is_active') === 'true'
  const orgId = (formData.get('org_id') as string | null) || null

  if (!userId) return { error: 'User ID is required.' }
  if (!['learner', 'instructor', 'admin', 'company_owner'].includes(role)) return { error: 'Invalid role.' }
  if (fullName && fullName.length > 100) return { error: 'Name cannot exceed 100 characters.' }
  if (role === 'company_owner' && !orgId) return { error: 'A company is required for the Company Owner role.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: fullName || null,
      role,
      is_active: isActive,
      org_id: role === 'company_owner' ? orgId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { error: null, success: true }
}

export async function createUserAction(
  _prevState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  // company_owner may also create users (scoped to their own org_id via the form hidden input)
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Unauthorized.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (supabase as any)
    .from('profiles').select('role, org_id').eq('id', authUser.id).single()
  if (!['admin', 'company_owner'].includes(callerProfile?.role)) return { error: 'Unauthorized.' }
  // Prevent company_owner from creating users outside their own company
  const requestedOrgId = (formData.get('org_id') as string | null) || null
  if (callerProfile?.role === 'company_owner' && requestedOrgId !== callerProfile?.org_id) {
    return { error: 'Unauthorized: you can only add members to your own company.' }
  }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  const fullName = (formData.get('full_name') as string | null)?.trim() || null
  const role = (formData.get('role') as string) || 'learner'
  const orgId = (formData.get('org_id') as string | null) || null

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !EMAIL_RE.test(email)) return { error: 'Valid email is required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (!['learner', 'instructor', 'admin', 'company_owner'].includes(role)) return { error: 'Invalid role.' }

  const admin = createAdminClient()

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !authData.user) return { error: createError?.message ?? 'Failed to create user.' }

  await admin
    .from('profiles')
    .update({ full_name: fullName, role, org_id: orgId, updated_at: new Date().toISOString() })
    .eq('id', authData.user.id)

  revalidatePath('/admin/users')
  return { error: null, success: true }
}

export async function importUsersFromCSVAction(
  _prevState: ImportResult | null,
  formData: FormData,
): Promise<ImportResult> {
  const caller = await assertAdmin()
  if (!caller) {
    return { created: 0, skipped: 0, errors: [{ row: 0, email: '', reason: 'Unauthorized.' }] }
  }

  type RowInput = { full_name: string; email: string; role: string }
  let rows: RowInput[]
  try {
    rows = JSON.parse(formData.get('rows') as string)
  } catch {
    return { created: 0, skipped: 0, errors: [{ row: 0, email: '', reason: 'Invalid payload.' }] }
  }

  const admin = createAdminClient()
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const VALID_ROLES = ['learner', 'instructor', 'admin']
  let created = 0
  let skipped = 0
  const errors: ImportResult['errors'] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const email = String(raw.email ?? '').trim().toLowerCase()
    const fullName = String(raw.full_name ?? '').trim() || null
    const role = String(raw.role ?? 'learner').trim().toLowerCase()

    if (!email || !EMAIL_RE.test(email)) {
      errors.push({ row: i + 1, email, reason: 'Invalid email.' })
      continue
    }
    if (!VALID_ROLES.includes(role)) {
      errors.push({ row: i + 1, email, reason: `Invalid role: "${role}". Use learner, instructor, or admin.` })
      continue
    }

    // Skip if profile already exists
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) { skipped++; continue }

    // Create auth user with a random temp password (user can reset via forgot-password)
    const tempPassword = randomBytes(12).toString('base64url')
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createError || !authData.user) {
      errors.push({ row: i + 1, email, reason: createError?.message ?? 'Failed to create user.' })
      continue
    }

    // Trigger creates the profile row; update it with name + role
    await admin
      .from('profiles')
      .update({ full_name: fullName, role, updated_at: new Date().toISOString() })
      .eq('id', authData.user.id)

    created++
  }

  revalidatePath('/admin/users')
  return { created, skipped, errors }
}
