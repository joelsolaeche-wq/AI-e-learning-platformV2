'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ProfileActionResult = {
  error: string | null
  success?: boolean
}

export async function updateProfileAction(
  _prevState: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado.' }

  const fullName = (formData.get('full_name') as string | null)?.trim() ?? ''
  const avatarUrl = (formData.get('avatar_url') as string | null)?.trim() ?? null

  if (fullName.length > 100) {
    return { error: 'El nombre no puede superar los 100 caracteres.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ full_name: fullName || null, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard', 'layout')
  return { error: null, success: true }
}

export async function requestPasswordResetAction(
  _prevState: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''

  if (!email) return { error: 'El email es requerido.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/update-password`,
  })

  if (error) return { error: error.message }

  return { error: null, success: true }
}

export async function updatePasswordAction(
  _prevState: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (password !== confirm) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null, success: true }
}
