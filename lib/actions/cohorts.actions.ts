'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

export type CohortActionResult = { error: string | null; success?: boolean; id?: string; cohortTitle?: string }

async function assertAdminOrInstructor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()
  if (!['admin', 'instructor', 'company_owner'].includes(profile?.role)) return null
  return { user, role: profile.role as string, orgId: profile.org_id as string | null }
}

export async function createCohortAction(
  _prevState: CohortActionResult,
  formData: FormData,
): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const courseIds = formData.getAll('course_ids') as string[]
  const company_id = (formData.get('company_id') as string | null) || null
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const starts_at = formData.get('starts_at') as string
  const ends_at = (formData.get('ends_at') as string | null) || null
  const max_seats_raw = formData.get('max_seats') as string | null
  const max_seats = max_seats_raw ? parseInt(max_seats_raw, 10) : 0
  const modality = (formData.get('modality') as string) || 'virtual'
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const status = (formData.get('status') as string) || 'draft'
  const image_url = (formData.get('image_url') as string | null)?.trim() || null

  if (!title) return { error: 'Title is required.' }
  if (!starts_at) return { error: 'Start date is required.' }

  // company_owner may only create cohorts for their own company
  if (caller.role === 'company_owner' && company_id !== caller.orgId) {
    return { error: 'Unauthorized: you can only create cohorts for your own company.' }
  }

  const admin = createAdminClient()
  // course_id keeps the first selected course as a backward-compat hint
  const primaryCourseId = courseIds[0] ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('cohorts')
    .insert({ course_id: primaryCourseId, company_id, title, starts_at, ends_at, max_seats, modality, notes, status, image_url })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (courseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('cohort_courses')
      .insert(courseIds.map((cId) => ({ cohort_id: data.id, course_id: cId })))
  }

  revalidatePath('/admin/cohorts')
  return { error: null, success: true, id: data.id }
}

export async function updateCohortAction(
  _prevState: CohortActionResult,
  formData: FormData,
): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const cohortId = formData.get('cohort_id') as string
  const courseIds = formData.getAll('course_ids') as string[]
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const starts_at = formData.get('starts_at') as string
  const ends_at = (formData.get('ends_at') as string | null) || null
  const max_seats_raw = formData.get('max_seats') as string | null
  const max_seats = max_seats_raw ? parseInt(max_seats_raw, 10) : 0
  const modality = (formData.get('modality') as string) || 'virtual'
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const status = (formData.get('status') as string) || 'draft'
  const company_id = (formData.get('company_id') as string | null) || null
  const image_url = (formData.get('image_url') as string | null)?.trim() || null

  if (!cohortId) return { error: 'Cohort ID is required.' }
  if (!title) return { error: 'Title is required.' }

  const admin = createAdminClient()

  // company_owner may only update cohorts that belong to their company
  if (caller.role === 'company_owner') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('cohorts').select('company_id').eq('id', cohortId).single()
    if (existing?.company_id !== caller.orgId) {
      return { error: 'Unauthorized: cohort does not belong to your company.' }
    }
  }

  const primaryCourseId = courseIds[0] ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('cohorts')
    .update({ course_id: primaryCourseId, title, starts_at, ends_at, max_seats, modality, notes, status, company_id, image_url })
    .eq('id', cohortId)

  if (error) return { error: error.message }

  // Replace cohort_courses: delete all then re-insert selection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('cohort_courses').delete().eq('cohort_id', cohortId)
  if (courseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('cohort_courses')
      .insert(courseIds.map((cId) => ({ cohort_id: cohortId, course_id: cId })))
  }

  revalidatePath('/admin/cohorts')
  revalidatePath(`/admin/cohorts/${cohortId}`)
  return { error: null, success: true }
}

export async function deleteCohortAction(cohortId: string): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()

  if (caller.role === 'company_owner') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('cohorts').select('company_id').eq('id', cohortId).single()
    if (existing?.company_id !== caller.orgId) {
      return { error: 'Unauthorized: cohort does not belong to your company.' }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('cohorts').delete().eq('id', cohortId)
  if (error) return { error: error.message }

  revalidatePath('/admin/cohorts')
  return { error: null, success: true }
}

export async function archiveCohortAction(cohortId: string): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('cohorts')
    .update({ status: 'completed' })
    .eq('id', cohortId)

  if (error) return { error: error.message }
  revalidatePath('/admin/cohorts')
  revalidatePath(`/admin/cohorts/${cohortId}`)
  return { error: null, success: true }
}

export async function cloneCohortAction(cohortId: string): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: original, error: fetchErr } = await (admin as any)
    .from('cohorts')
    .select('course_id, company_id, title, max_seats, modality, notes')
    .eq('id', cohortId)
    .single()

  if (fetchErr || !original) return { error: 'Cohort not found.' }

  const newStarts = new Date()
  newStarts.setDate(newStarts.getDate() + 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('cohorts')
    .insert({
      course_id: original.course_id,
      company_id: original.company_id,
      title: `${original.title} (Copy)`,
      starts_at: newStarts.toISOString(),
      max_seats: original.max_seats,
      modality: original.modality,
      notes: original.notes,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/cohorts')
  return { error: null, success: true, id: data.id }
}

export async function unenrollUserAction(enrollmentId: string, cohortId: string): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('enrollments').delete().eq('id', enrollmentId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/cohorts/${cohortId}`)
  return { error: null, success: true }
}

export async function enrollUserAction(
  cohortId: string,
  userId: string,
): Promise<CohortActionResult> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('enrollments')
    .upsert(
      { cohort_id: cohortId, user_id: userId, status: 'active' },
      { onConflict: 'user_id,cohort_id' },
    )

  if (error) return { error: error.message }
  revalidatePath(`/admin/cohorts/${cohortId}`)
  return { error: null, success: true }
}

export async function bulkEnrollAction(
  cohortId: string,
  emails: string[],
): Promise<{ enrolled: number; skipped: number; errors: string[] }> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { enrolled: 0, skipped: 0, errors: ['Unauthorized.'] }

  const admin = createAdminClient()
  let enrolled = 0
  let skipped = 0
  const errors: string[] = []

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (admin as any)
      .from('profiles')
      .select('id')
      .eq('email', trimmed)
      .maybeSingle()

    if (!profile) {
      errors.push(`User not found: ${trimmed}`)
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('enrollments')
      .upsert(
        { cohort_id: cohortId, user_id: profile.id, status: 'active' },
        { onConflict: 'user_id,cohort_id' },
      )

    if (error) {
      if (error.code === '23505') { skipped++; continue }
      errors.push(`${trimmed}: ${error.message}`)
    } else {
      enrolled++
    }
  }

  revalidatePath(`/admin/cohorts/${cohortId}`)
  return { enrolled, skipped, errors }
}

export async function generateInvitationCodeAction(
  cohortId: string,
  maxUses?: number,
  expiresInDays?: number,
): Promise<{ error: string | null; code?: string }> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return { error: 'Unauthorized.' }

  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null

  const admin = createAdminClient()

  // Retry up to 5 times on unique code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('cohort_invitations')
      .insert({
        cohort_id: cohortId,
        code,
        max_uses: maxUses ?? null,
        expires_at,
        created_by: caller.user.id,
      })

    if (!error) {
      revalidatePath(`/admin/cohorts/${cohortId}`)
      return { error: null, code }
    }
    if (error.code !== '23505') return { error: error.message }
    // 23505 = unique violation → retry with a different code
  }
  return { error: 'Could not generate a unique code. Try again.' }
}

export async function joinCohortByCodeAction(code: string): Promise<CohortActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  const admin = createAdminClient()

  // Validate invitation code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitation } = await (admin as any)
    .from('cohort_invitations')
    .select('id, cohort_id, max_uses, uses_count, expires_at')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()

  if (!invitation) return { error: 'Invalid invitation code.' }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return { error: 'This invitation has expired.' }
  }
  if (invitation.max_uses !== null && invitation.uses_count >= invitation.max_uses) {
    return { error: 'This invitation has reached its maximum uses.' }
  }

  // Enroll user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: enrollError } = await (admin as any)
    .from('enrollments')
    .upsert({ cohort_id: invitation.cohort_id, user_id: user.id, status: 'active' })

  if (enrollError && enrollError.code !== '23505') return { error: enrollError.message }

  // Increment uses_count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('cohort_invitations')
    .update({ uses_count: invitation.uses_count + 1 })
    .eq('id', invitation.id)

  // Fetch cohort title for toast feedback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cohort } = await (admin as any)
    .from('cohorts')
    .select('title')
    .eq('id', invitation.cohort_id)
    .single()

  revalidatePath('/catalog')
  revalidatePath('/dashboard')
  return { error: null, success: true, id: invitation.cohort_id, cohortTitle: cohort?.title as string | undefined }
}

// Form-compatible version for useActionState (used by JoinByCodeForm)
export async function joinByCodeFormAction(
  _prevState: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const code = (formData.get('code') as string | null)?.trim() ?? ''
  if (!code) return { error: 'Code is required.' }
  return joinCohortByCodeAction(code)
}
