'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { TablesInsert } from '@/lib/database.types'

export type EnrollmentActionResult = {
  error: string | null
  enrolled?: boolean
}

/**
 * Enrolls the current user in a cohort.
 *
 * Per CONTEXT.md D-01: writes an enrollments row, then redirects to /dashboard.
 * Per CONTEXT.md D-03: a duplicate-enrollment error (Postgres 23505) is treated
 * as success (the user is already enrolled) and we redirect silently.
 *
 * Form contract:
 *   <form action={enrollInCohortAction}>
 *     <input type="hidden" name="cohort_id" value={cohort.id} />
 *     <button type="submit">Join Cohort</button>
 *   </form>
 *
 * The action is callable as a plain form action OR via useFormState — both
 * shapes are accommodated by the (_prevState, formData) signature.
 */
export async function enrollInCohortAction(
  _prevState: EnrollmentActionResult,
  formData: FormData
): Promise<EnrollmentActionResult> {
  const cohortId = formData.get('cohort_id') as string | null

  if (!cohortId) {
    return { error: 'Cohort ID is required.' }
  }

  const supabase = await createClient()

  // Auth guard — never trust the caller
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Validate cohort exists, is active, and has available capacity
  type CohortValidation = { id: string; status: string; max_seats: number }
  const { data: rawCohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, status, max_seats')
    .eq('id', cohortId)
    .single()
  const cohort = rawCohort as unknown as CohortValidation | null

  if (cohortError || !cohort) {
    return { error: 'Cohort not found.' }
  }
  if (cohort.status !== 'active') {
    return { error: 'This cohort is not open for enrollment.' }
  }
  if (cohort.max_seats > 0) {
    // KNOWN LIMITATION (CR-02): This read-then-write is non-atomic.
    // Two concurrent requests that both read count = max_seats - 1 can both
    // pass the guard and insert, resulting in max_seats + 1 enrollments.
    // For a production system this should be replaced with a SECURITY DEFINER
    // RPC function that performs count-and-insert inside a single transaction
    // with a FOR UPDATE lock on the cohorts row.
    // Deferred: low-concurrency demo environment makes this an acceptable risk.
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('cohort_id', cohortId)
      .eq('status', 'active')

    if ((count ?? 0) >= cohort.max_seats) {
      return { error: 'This cohort is full.' }
    }
  }

  const enrollmentRow: TablesInsert<'enrollments'> = {
    user_id: user.id,
    cohort_id: cohortId,
  }

  const { error } = await supabase
    .from('enrollments')
    .insert(enrollmentRow as never)

  if (error) {
    console.error('[enrollInCohortAction] insert error:', error.code, error.message, error.details)
    // Postgres 23505 = unique_violation. Per D-03, an existing enrollment is not
    // an error from the user's perspective — silently send them to the dashboard.
    if (error.code === '23505') {
      revalidatePath('/dashboard')
      redirect('/dashboard')
    }
    // Any other failure: bubble a friendly toast string per UI-SPEC copywriting.
    return { error: "Couldn't enroll — try again" }
  }

  revalidatePath('/catalog')
  revalidatePath('/dashboard')
  return { error: null, enrolled: true }
}
