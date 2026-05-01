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
  role: 'learner' | 'instructor' | 'admin',
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

  if (!userId) return { error: 'User ID is required.' }
  if (!['learner', 'instructor', 'admin'].includes(role)) return { error: 'Invalid role.' }
  if (fullName && fullName.length > 100) return { error: 'Name cannot exceed 100 characters.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: fullName || null,
      role,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
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
