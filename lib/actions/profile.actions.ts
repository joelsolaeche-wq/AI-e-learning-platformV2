'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { env } from '@/lib/env'
import { NAME_MAX_CHARS, PASSWORD_MIN_CHARS } from '@/lib/constants/limits'

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

  if (!user) return { error: 'Not authenticated.' }

  const fullName = (formData.get('full_name') as string | null)?.trim() ?? ''
  const avatarUrl = (formData.get('avatar_url') as string | null)?.trim() ?? null

  if (fullName.length > NAME_MAX_CHARS) {
    return { error: `Name cannot exceed ${NAME_MAX_CHARS} characters.` }
  }

  // Supabase client's typed Update chain narrows to `never` here in this
  // SDK version when the Update shape spreads inferred values. Cast the
  // payload through `never` to satisfy the overload; runtime behavior
  // unchanged.
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName || null, avatar_url: avatarUrl, updated_at: new Date().toISOString() } as never)
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

  if (!email) return { error: 'Email is required.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/auth/update-password`,
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

  if (!password || password.length < PASSWORD_MIN_CHARS) {
    return { error: `Password must be at least ${PASSWORD_MIN_CHARS} characters.` }
  }
  if (password !== confirm) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null, success: true }
}
