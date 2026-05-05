'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type LabActionResult = { error: string | null; success?: boolean; labId?: string }

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export type CriterionInput = {
  id?: string
  name: string
  description?: string
  weight: number
  position: number
}

export async function upsertLabAction(
  _prev: LabActionResult,
  formData: FormData,
): Promise<LabActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const labId = (formData.get('lab_id') as string | null) || null
  const lessonId = formData.get('lesson_id') as string
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const contextInstructions = (formData.get('context_instructions') as string | null)?.trim() || null
  const passingScore = parseFloat((formData.get('passing_score') as string) || '60')
  const criteriaJson = formData.get('criteria') as string

  if (!title) return { error: 'Lab title is required.' }
  if (!lessonId) return { error: 'Lesson ID is required.' }
  if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) return { error: 'Passing score must be 0–100.' }

  let criteria: CriterionInput[] = []
  try {
    criteria = JSON.parse(criteriaJson || '[]')
  } catch {
    return { error: 'Invalid criteria format.' }
  }

  const admin = createAdminClient()

  let resolvedLabId = labId
  if (labId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('labs').update({
      title,
      description,
      context_instructions: contextInstructions,
      passing_score: passingScore,
    }).eq('id', labId)
    if (error) return { error: error.message }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).from('labs').insert({
      lesson_id: lessonId,
      title,
      description,
      context_instructions: contextInstructions,
      passing_score: passingScore,
    }).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Failed to create lab.' }
    resolvedLabId = data.id
  }

  // Upsert criteria — delete removed ones, upsert existing/new
  const criteriaWithLabId = criteria.map((c) => ({
    ...(c.id ? { id: c.id } : {}),
    lab_id: resolvedLabId,
    name: c.name,
    description: c.description || null,
    weight: c.weight,
    position: c.position,
  }))

  if (criteriaWithLabId.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (admin as any)
      .from('lab_criteria')
      .upsert(criteriaWithLabId, { onConflict: 'id' })
    if (upsertErr) return { error: upsertErr.message }
  }

  // Delete criteria not in the current list (by id)
  const keepIds = criteria.filter((c) => c.id).map((c) => c.id!)
  if (resolvedLabId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let delQuery = (admin as any).from('lab_criteria').delete().eq('lab_id', resolvedLabId)
    if (keepIds.length > 0) delQuery = delQuery.not('id', 'in', `(${keepIds.join(',')})`)
    await delQuery
  }

  revalidatePath(`/admin/courses`)
  return { error: null, success: true, labId: resolvedLabId ?? undefined }
}

export async function deleteLabAction(labId: string): Promise<LabActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('labs').delete().eq('id', labId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/courses`)
  return { error: null, success: true }
}

export async function submitLabAction(
  _prev: LabActionResult,
  formData: FormData,
): Promise<LabActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const labId = formData.get('lab_id') as string
  const cohortId = (formData.get('cohort_id') as string | null) || null
  const submissionText = (formData.get('submission_text') as string | null)?.trim() || null
  const submissionUrl = (formData.get('submission_url') as string | null)?.trim() || null

  if (!labId) return { error: 'Lab ID is required.' }
  if (!submissionText && !submissionUrl) return { error: 'Submit text or a URL.' }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from('lab_submissions').insert({
    lab_id: labId,
    user_id: user.id,
    cohort_id: cohortId,
    submission_text: submissionText,
    submission_url: submissionUrl,
    status: 'pending',
  }).select('id').single()

  if (error || !data) return { error: error?.message ?? 'Failed to submit.' }

  return { error: null, success: true, labId: data.id }
}
