'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type AdminActionResult = { error: string | null; success?: boolean }

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
  if (!caller) return { error: 'No autorizado.' }

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
  if (!caller) return { error: 'No autorizado.' }

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
  if (!caller) return { error: 'No autorizado.' }

  const userId = formData.get('user_id') as string
  const fullName = (formData.get('full_name') as string | null)?.trim() ?? null
  const role = formData.get('role') as string
  const isActive = formData.get('is_active') === 'true'

  if (!userId) return { error: 'ID de usuario requerido.' }
  if (!['learner', 'instructor', 'admin'].includes(role)) return { error: 'Rol inválido.' }
  if (fullName && fullName.length > 100) return { error: 'El nombre no puede superar los 100 caracteres.' }

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
