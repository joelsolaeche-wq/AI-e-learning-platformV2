'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { assertAdmin } from '@/lib/auth/guards'

export type LabActionResult = { error: string | null; success?: boolean }

export type RubricItemInput = {
  criterion: string
  description: string
  weight: number
}

// Save the whole lab form in one shot:
// 1. Upsert the labs row for this lesson.
// 2. Replace all rubric items (delete + insert) in a single transactional
//    intent. We don't have true Postgres transactions over PostgREST, but
//    delete+insert under service_role gets us close enough for an admin form
//    with ≤10 rows.
//
// items is an ordered array — its index is the 1-based position.
export async function saveLabAction(
  lessonId: string,
  title: string,
  briefMd: string,
  items: RubricItemInput[],
): Promise<LabActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const cleanTitle = title.trim()
  if (!cleanTitle) return { error: 'Title is required.' }
  if (cleanTitle.length > 200) return { error: 'Title cannot exceed 200 characters.' }

  if (items.length === 0) return { error: 'At least one rubric item is required.' }
  if (items.length > 12) return { error: 'A lab can have at most 12 rubric items.' }

  // Validate items before any DB write so a partial save can't happen.
  const cleanItems: RubricItemInput[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const criterion = (it.criterion ?? '').trim()
    const description = (it.description ?? '').trim()
    const weight = Number.isFinite(it.weight) ? Math.max(1, Math.min(5, Math.round(it.weight))) : 1
    if (!criterion) return { error: `Rubric item ${i + 1}: criterion is required.` }
    if (criterion.length > 200) return { error: `Rubric item ${i + 1}: criterion too long (max 200).` }
    if (description.length > 1000) return { error: `Rubric item ${i + 1}: description too long (max 1000).` }
    cleanItems.push({ criterion, description, weight })
  }

  const admin = createAdminClient()

  // 1. Upsert the lab. lessons.id is the natural key here because labs has
  //    UNIQUE(lesson_id) and we want one lab per lesson.
  const { data: existingLab, error: fetchErr } = await admin
    .from('labs')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }

  let labId: string
  if (existingLab) {
    labId = existingLab.id
    const { error: updateErr } = await admin
      .from('labs')
      .update({ title: cleanTitle, brief_md: briefMd, updated_at: new Date().toISOString() })
      .eq('id', labId)
    if (updateErr) return { error: updateErr.message }
  } else {
    const { data: created, error: insertErr } = await admin
      .from('labs')
      .insert({ lesson_id: lessonId, title: cleanTitle, brief_md: briefMd })
      .select('id')
      .single()
    if (insertErr || !created) return { error: insertErr?.message ?? 'Failed to create lab.' }
    labId = created.id
  }

  // 2. Replace rubric items. ON DELETE CASCADE on lab_submission_scores
  //    means historic per-criterion scores tied to deleted items vanish —
  //    that's acceptable: edits invalidate prior grading anyway, and the
  //    overall stars on lab_submissions row are preserved as a snapshot.
  const { error: deleteErr } = await admin
    .from('lab_rubric_items')
    .delete()
    .eq('lab_id', labId)
  if (deleteErr) return { error: deleteErr.message }

  if (cleanItems.length > 0) {
    const rows = cleanItems.map((it, idx) => ({
      lab_id: labId,
      position: idx + 1,
      criterion: it.criterion,
      description: it.description,
      weight: it.weight,
    }))
    const { error: insertItemsErr } = await admin
      .from('lab_rubric_items')
      .insert(rows)
    if (insertItemsErr) return { error: insertItemsErr.message }
  }

  revalidatePath('/admin/labs')
  revalidatePath(`/admin/labs/${lessonId}`)
  revalidatePath(`/dashboard/lesson/${lessonId}`)
  return { error: null, success: true }
}

export async function deleteLabAction(lessonId: string): Promise<LabActionResult> {
  const caller = await assertAdmin()
  if (!caller) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('labs')
    .delete()
    .eq('lesson_id', lessonId)

  if (error) return { error: error.message }
  revalidatePath('/admin/labs')
  revalidatePath(`/admin/labs/${lessonId}`)
  revalidatePath(`/dashboard/lesson/${lessonId}`)
  return { error: null, success: true }
}
