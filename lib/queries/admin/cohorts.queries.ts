// Admin queries for the `cohorts` table and its joins (cohort_courses,
// enrollments → profiles, cohort_invitations). Same pattern as
// `users.queries.ts`: each function gates first, then runs the service-role
// query. Pages/route handlers should call these instead of importing
// `createAdminClient` directly.

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin, assertAdminOrStaff } from '@/lib/auth/guards'

// ──────────────────────────────────────────────────────────────────────
// Cohort listing (admin global view)
// ──────────────────────────────────────────────────────────────────────

export type AdminCohortListRow = {
  id: string
  title: string
  status: string
  starts_at: string
  ends_at: string | null
  max_seats: number
  modality: string | null
  courses: { title: string } | null
  organizations: { name: string } | null
}

export async function listAllCohortsForAdmin(): Promise<AdminCohortListRow[] | null> {
  const caller = await assertAdmin()
  if (!caller) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('cohorts')
    .select(`
      id, title, status, starts_at, ends_at, max_seats, modality,
      courses(title),
      organizations(name)
    `)
    .order('starts_at', { ascending: false })
  return (data ?? []) as AdminCohortListRow[]
}

// ──────────────────────────────────────────────────────────────────────
// Cohort form options (courses + companies) — used by new + edit pages
// ──────────────────────────────────────────────────────────────────────

export type CohortFormOptions = {
  courses: Array<{ id: string; title: string }>
  companies: Array<{ id: string; name: string }>
}

export async function listCohortFormOptions(): Promise<CohortFormOptions | null> {
  const caller = await assertAdminOrStaff()
  if (!caller) return null

  const admin = createAdminClient()
  const [coursesRes, companiesRes] = await Promise.all([
    admin.from('courses').select('id, title').eq('is_published', true).order('title'),
    admin.from('organizations').select('id, name').order('name'),
  ])
  return {
    courses: (coursesRes.data ?? []) as Array<{ id: string; title: string }>,
    companies: (companiesRes.data ?? []) as Array<{ id: string; name: string }>,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Cohort detail (used by /admin/cohorts/[cohortId] and
// /admin/companies/[companyId]/cohorts/[cohortId])
// ──────────────────────────────────────────────────────────────────────

export type AdminCohortDetail = {
  cohort: any
  formOptions: CohortFormOptions
  selectedCourseIds: string[]
  enrollments: Array<{
    id: string
    status: string
    enrolled_at: string
    profiles: { id: string; email: string; full_name: string | null; role: string } | null
  }>
  invitations: Array<{
    id: string
    code: string
    max_uses: number | null
    uses_count: number
    expires_at: string | null
    created_at: string
  }>
}

export async function getCohortDetailForAdmin(
  cohortId: string,
): Promise<AdminCohortDetail | null> {
  const caller = await assertAdminOrStaff()
  if (!caller) return null

  const admin = createAdminClient()
  const [
    cohortRes,
    coursesRes,
    companiesRes,
    cohortCoursesRes,
    enrollmentsRes,
    invitationsRes,
  ] = await Promise.all([
    admin.from('cohorts').select('*').eq('id', cohortId).single(),
    admin.from('courses').select('id, title').eq('is_published', true).order('title'),
    admin.from('organizations').select('id, name').order('name'),
    admin.from('cohort_courses').select('course_id').eq('cohort_id', cohortId),
    admin
      .from('enrollments')
      .select('id, status, enrolled_at, profiles(id, email, full_name, role)')
      .eq('cohort_id', cohortId)
      .order('enrolled_at', { ascending: false }),
    admin
      .from('cohort_invitations')
      .select('id, code, max_uses, uses_count, expires_at, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
  ])

  if (!cohortRes.data) return null
  return {
    cohort: cohortRes.data,
    formOptions: {
      courses: (coursesRes.data ?? []) as Array<{ id: string; title: string }>,
      companies: (companiesRes.data ?? []) as Array<{ id: string; name: string }>,
    },
    selectedCourseIds: ((cohortCoursesRes.data ?? []) as Array<{ course_id: string }>).map(
      (r) => r.course_id,
    ),
    enrollments: (enrollmentsRes.data ?? []) as AdminCohortDetail['enrollments'],
    invitations: (invitationsRes.data ?? []) as AdminCohortDetail['invitations'],
  }
}
