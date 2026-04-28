'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { TablesInsert } from '@/lib/database.types'

export type EnrollmentActionResult = {
  error: string | null
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

  const enrollmentRow: TablesInsert<'enrollments'> = {
    user_id: user.id,
    cohort_id: cohortId,
  }

  const { error } = await supabase
    .from('enrollments')
    .insert(enrollmentRow as never)

  if (error) {
    // Postgres 23505 = unique_violation. Per D-03, an existing enrollment is not
    // an error from the user's perspective — silently send them to the dashboard.
    if (error.code === '23505') {
      revalidatePath('/dashboard')
      redirect('/dashboard')
    }
    // Any other failure: bubble a friendly toast string per UI-SPEC copywriting.
    return { error: "Couldn't enroll — try again" }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
