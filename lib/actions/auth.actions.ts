'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { env } from '@/lib/env'
import { PASSWORD_MIN_CHARS } from '@/lib/constants/limits'

export type AuthActionResult = {
  error: string | null
}

export async function signUpAction(_prevState: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (password.length < PASSWORD_MIN_CHARS) {
    return { error: `Password must be at least ${PASSWORD_MIN_CHARS} characters.` }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName ?? '' },
      emailRedirectTo: `${env.siteUrl}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/auth/confirm-email')
}

export async function signInAction(_prevState: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // company_owner goes directly to their company workspace
  if (signInData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', signInData.user.id)
      .maybeSingle<{ role: string; org_id: string | null }>()

    if (profile?.role === 'company_owner' && profile.org_id) {
      revalidatePath('/', 'layout')
      redirect(`/admin/companies/${profile.org_id}`)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}
