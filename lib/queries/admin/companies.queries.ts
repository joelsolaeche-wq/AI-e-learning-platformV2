// Admin queries for the `organizations` (company) table and its various
// admin-surface joins: members (profiles by org_id), cohorts, course
// assignment (course_companies), labs grouped by company assignment,
// per-learner progress (v_cohort_progress view), and cohort stats.
//
// Same gate-then-query pattern as the other lib/queries/admin/* modules.
// `assertAdmin` is used for the global list; `assertAdminOrOwner` is used
// for per-company views because a company_owner may legitimately access
// their own org's workspace.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin, assertAdminOrOwner } from '@/lib/auth/guards'

// ──────────────────────────────────────────────────────────────────────
// Companies list (admin global view)
// ──────────────────────────────────────────────────────────────────────

export type CompanyListRow = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website: string | null
  deleted_at: string | null
}

export type CompaniesListResult = {
  active: CompanyListRow[]
  archived: CompanyListRow[]
  cohortCount: Map<string, number>
  learnerCount: Map<string, number>
}

/**
 * Returns the full companies list for the admin. Also returns
 * `redirectToOwnWorkspace` when the caller is a `company_owner` — the
 * page should redirect them to their own org's workspace instead of
 * showing the global list.
 */
export type CompaniesListOrRedirect =
  | { kind: 'redirect'; orgId: string }
  | { kind: 'list'; data: CompaniesListResult }

export async function listAllCompaniesForAdmin(): Promise<CompaniesListOrRedirect | null> {
  // We need the caller's role for the redirect logic, so we use the
  // permissive guard and branch internally instead of assertAdmin.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  type ProfileRow = { role: string; org_id: string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single<ProfileRow>()

  if (!profile) return null
  if (!['admin', 'company_owner'].includes(profile.role)) return null

  // company_owner doesn't see the list — they go to their own workspace.
  if (profile.role === 'company_owner' && profile.org_id) {
    return { kind: 'redirect', orgId: profile.org_id }
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any
  const [companiesResult, cohortCountsResult, learnerCountsResult] = await Promise.all([
    adminAny
      .from('organizations')
      .select('id, name, slug, description, logo_url, website, deleted_at')
      .order('name', { ascending: true }),
    adminAny.from('cohorts').select('company_id'),
    adminAny.from('profiles').select('org_id').not('org_id', 'is', null),
  ])

  const allRows = (companiesResult.data ?? []) as CompanyListRow[]
  const cohortCount = new Map<string, number>()
  for (const r of (cohortCountsResult.data ?? []) as { company_id: string | null }[]) {
    if (!r.company_id) continue
    cohortCount.set(r.company_id, (cohortCount.get(r.company_id) ?? 0) + 1)
  }
  const learnerCount = new Map<string, number>()
  for (const r of (learnerCountsResult.data ?? []) as { org_id: string | null }[]) {
    if (!r.org_id) continue
    learnerCount.set(r.org_id, (learnerCount.get(r.org_id) ?? 0) + 1)
  }

  return {
    kind: 'list',
    data: {
      active: allRows.filter((c) => !c.deleted_at),
      archived: allRows.filter((c) => c.deleted_at),
      cohortCount,
      learnerCount,
    },
  }
}

// ──────────────────────────────────────────────────────────────────────
// Company workspace layout — minimal company shape for header
// ──────────────────────────────────────────────────────────────────────

/**
 * Returns the company's id+name for the workspace header, OR the special
 * sentinels `null` (caller unauthorized) and `'notfound'` (company doesn't
 * exist or company_owner trying to access another org).
 */
export type CompanyWorkspaceGate = { id: string; name: string } | null | 'notfound'

export async function getCompanyForWorkspace(companyId: string): Promise<CompanyWorkspaceGate> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  type ProfileRow = { role: string; org_id: string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single<ProfileRow>()

  if (!profile) return null
  if (!['admin', 'company_owner'].includes(profile.role)) return null

  // company_owner can only access their own org's workspace
  if (profile.role === 'company_owner' && profile.org_id !== companyId) return 'notfound'

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('organizations')
    .select('id, name')
    .eq('id', companyId)
    .single()

  if (!company) return 'notfound'
  return company as { id: string; name: string }
}

// ──────────────────────────────────────────────────────────────────────
// Company overview — details + 3 quick-stat counts
// ──────────────────────────────────────────────────────────────────────

export type CompanyOverview = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  company: any
  cohortCount: number
  courseCount: number
  memberCount: number
}

export async function getCompanyOverview(companyId: string): Promise<CompanyOverview | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  const [companyRes, cohortsRes, coursesRes, membersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('*').eq('id', companyId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('cohorts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).neq('status', 'cancelled'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('course_companies').select('course_id', { count: 'exact', head: true }).eq('company_id', companyId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', companyId),
  ])

  if (!companyRes.data) return null
  return {
    company: companyRes.data,
    cohortCount: cohortsRes.count ?? 0,
    courseCount: coursesRes.count ?? 0,
    memberCount: membersRes.count ?? 0,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Company members
// ──────────────────────────────────────────────────────────────────────

export type CompanyMember = {
  id: string
  email: string
  full_name: string | null
  role: string
  avatar_url: string | null
}

export async function listCompanyMembers(companyId: string): Promise<CompanyMember[] | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('profiles')
    .select('id, email, full_name, role, avatar_url')
    .eq('org_id', companyId)
    .order('full_name')
  return (data ?? []) as CompanyMember[]
}

// ──────────────────────────────────────────────────────────────────────
// Course assignment (admin) — all courses + which ones are assigned
// ──────────────────────────────────────────────────────────────────────

export type CompanyCoursesAssignment = {
  allCourses: Array<{ id: string; title: string; slug: string }>
  assignedCourseIds: string[]
}

export async function getCompanyCoursesAssignment(
  companyId: string,
): Promise<CompanyCoursesAssignment | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  const [allCoursesRes, assignedRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title, slug').order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('course_companies').select('course_id').eq('company_id', companyId),
  ])
  return {
    allCourses: (allCoursesRes.data ?? []) as Array<{ id: string; title: string; slug: string }>,
    assignedCourseIds: ((assignedRes.data ?? []) as Array<{ course_id: string }>).map((r) => r.course_id),
  }
}

// ──────────────────────────────────────────────────────────────────────
// Labs grouped by course — for the company labs page
// ──────────────────────────────────────────────────────────────────────

export type CompanyLessonForLabs = {
  id: string
  title: string
  modules: { title: string; course_id: string; courses: { id: string; title: string } } | null
}

export type CompanyLabsView = {
  assignedCourseIds: string[]
  lessons: CompanyLessonForLabs[]
  labByLesson: Map<string, string>
}

export async function getCompanyLabsView(companyId: string): Promise<CompanyLabsView | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assigned } = await (admin as any)
    .from('course_companies')
    .select('course_id')
    .eq('company_id', companyId)
  const courseIds: string[] = ((assigned ?? []) as Array<{ course_id: string }>).map((r) => r.course_id)

  if (courseIds.length === 0) {
    return { assignedCourseIds: [], lessons: [], labByLesson: new Map() }
  }

  const [lessonsRes, labsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('lessons')
      .select('id, title, modules!inner(title, course_id, courses!inner(id, title))')
      .in('modules.course_id', courseIds)
      .order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('labs').select('lesson_id, title'),
  ])

  const labByLesson = new Map<string, string>(
    ((labsRes.data ?? []) as Array<{ lesson_id: string; title: string }>).map((l) => [
      l.lesson_id,
      l.title,
    ]),
  )

  return {
    assignedCourseIds: courseIds,
    lessons: (lessonsRes.data ?? []) as CompanyLessonForLabs[],
    labByLesson,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Cohorts for this company
// ──────────────────────────────────────────────────────────────────────

export type CompanyCohortListRow = {
  id: string
  title: string
  status: string
  starts_at: string
  ends_at: string | null
  max_seats: number
  modality: string | null
  image_url: string | null
}

export type CompanyCohortsList = {
  cohorts: CompanyCohortListRow[]
  memberCount: Map<string, number>
}

export async function listCompanyCohorts(companyId: string): Promise<CompanyCohortsList | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cohorts } = await (admin as any)
    .from('cohorts')
    .select('id, title, status, starts_at, ends_at, max_seats, modality, image_url')
    .eq('company_id', companyId)
    .order('starts_at', { ascending: false })

  const rows = (cohorts ?? []) as CompanyCohortListRow[]
  const memberCount = new Map<string, number>()
  if (rows.length > 0) {
    const cohortIds = rows.map((r) => r.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enrollmentRows } = await (admin as any)
      .from('enrollments')
      .select('cohort_id')
      .in('cohort_id', cohortIds)
      .eq('status', 'active')
    for (const e of (enrollmentRows ?? []) as { cohort_id: string }[]) {
      memberCount.set(e.cohort_id, (memberCount.get(e.cohort_id) ?? 0) + 1)
    }
  }
  return { cohorts: rows, memberCount }
}

// ──────────────────────────────────────────────────────────────────────
// New-cohort form options for a specific company
// ──────────────────────────────────────────────────────────────────────

export type CompanyCohortFormOptions = {
  courses: Array<{ id: string; title: string }>
  company: { id: string; name: string } | null
}

export async function getCompanyCohortFormOptions(
  companyId: string,
): Promise<CompanyCohortFormOptions | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  const [coursesRes, companyRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title').eq('is_published', true).order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('id, name').eq('id', companyId).single(),
  ])
  return {
    courses: (coursesRes.data ?? []) as Array<{ id: string; title: string }>,
    company: (companyRes.data as { id: string; name: string } | null) ?? null,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Cohort detail scoped to this company (must verify company_id match)
// ──────────────────────────────────────────────────────────────────────

import type { AdminCohortDetail } from './cohorts.queries'

export async function getCompanyCohortDetailForAdmin(
  companyId: string,
  cohortId: string,
): Promise<AdminCohortDetail | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  const [
    cohortRes,
    coursesRes,
    companiesRes,
    cohortCoursesRes,
    enrollmentsRes,
    invitationsRes,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('cohorts').select('*').eq('id', cohortId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title').eq('is_published', true).order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('id, name').order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('cohort_courses').select('course_id').eq('cohort_id', cohortId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('enrollments')
      .select('id, status, enrolled_at, profiles(id, email, full_name, role)')
      .eq('cohort_id', cohortId)
      .order('enrolled_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('cohort_invitations')
      .select('id, code, max_uses, uses_count, expires_at, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
  ])

  if (!cohortRes.data) return null
  // Guard: this cohort must belong to this company's workspace
  if (cohortRes.data.company_id !== companyId) return null

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

// ──────────────────────────────────────────────────────────────────────
// Progress view (v_cohort_progress)
// ──────────────────────────────────────────────────────────────────────

export type CompanyProgressView = {
  cohorts: Array<{ id: string; title: string }>
  progressRows: Array<{
    cohort_id: string
    user_id: string
    course_id: string
    total_lessons: number
    completed_lessons: number
    pct: number
  }>
  userMap: Map<string, { id: string; full_name: string | null; email: string }>
  courseMap: Map<string, { id: string; title: string }>
}

export async function getCompanyProgressView(companyId: string): Promise<CompanyProgressView | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cohorts } = await (admin as any)
    .from('cohorts')
    .select('id, title')
    .eq('company_id', companyId)
    .order('starts_at', { ascending: false })

  const cohortList = (cohorts ?? []) as Array<{ id: string; title: string }>
  const cohortIds = cohortList.map((c) => c.id)

  if (cohortIds.length === 0) {
    return { cohorts: [], progressRows: [], userMap: new Map(), courseMap: new Map() }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: progress } = await (admin as any)
    .from('v_cohort_progress')
    .select('cohort_id, user_id, course_id, total_lessons, completed_lessons, pct')
    .in('cohort_id', cohortIds)

  const progressRows = (progress ?? []) as CompanyProgressView['progressRows']
  const userIds = [...new Set(progressRows.map((r) => r.user_id))]
  const courseIds = [...new Set(progressRows.map((r) => r.course_id))]

  const [usersRes, coursesRes] = await Promise.all([
    userIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin as any).from('profiles').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin as any).from('courses').select('id, title').in('id', courseIds)
      : Promise.resolve({ data: [] }),
  ])

  const userMap = new Map<string, { id: string; full_name: string | null; email: string }>(
    ((usersRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string }>).map(
      (u) => [u.id, u],
    ),
  )
  const courseMap = new Map<string, { id: string; title: string }>(
    ((coursesRes.data ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c]),
  )

  return { cohorts: cohortList, progressRows, userMap, courseMap }
}

// ──────────────────────────────────────────────────────────────────────
// Cohort stats — raw data dump for the stats page (the page does the
// per-learner aggregation on top of these rows)
// ──────────────────────────────────────────────────────────────────────

export type CohortStatsRawData = {
  cohort: { id: string; title: string; starts_at: string; status: string }
  userIds: string[]
  courseIds: string[]
  profiles: Array<{ id: string; full_name: string | null; email: string }>
  courses: Array<{ id: string; title: string }>
  modules: Array<{ id: string; title: string; position: number; course_id: string }>
  lessons: Array<{ id: string; title: string; position: number; module_id: string }>
  lessonProgress: Array<{ user_id: string; lesson_id: string; completed: boolean }>
  labs: Array<{ id: string; lesson_id: string; title: string }>
  labSubmissions: Array<{
    user_id: string
    lab_id: string
    status: string
    overall_stars: number | null
    submitted_at: string
  }>
}

export async function getCohortStatsRawData(
  companyId: string,
  cohortId: string,
): Promise<CohortStatsRawData | null> {
  const caller = await assertAdminOrOwner()
  if (!caller) return null
  if (caller.role === 'company_owner' && caller.orgId !== companyId) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: cohort } = await admin
    .from('cohorts')
    .select('id, title, starts_at, status')
    .eq('id', cohortId)
    .eq('company_id', companyId)
    .single()

  if (!cohort) return null

  const [enrollmentsRes, cohortCoursesRes] = await Promise.all([
    admin.from('enrollments').select('user_id').eq('cohort_id', cohortId).eq('status', 'active'),
    admin.from('cohort_courses').select('course_id').eq('cohort_id', cohortId),
  ])

  const userIds = ((enrollmentsRes.data ?? []) as Array<{ user_id: string }>).map((e) => e.user_id)
  const courseIds = ((cohortCoursesRes.data ?? []) as Array<{ course_id: string }>).map((c) => c.course_id)

  const [profilesRes, coursesRes, modulesRes] = await Promise.all([
    userIds.length > 0
      ? admin.from('profiles').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      ? admin.from('courses').select('id, title').in('id', courseIds)
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      ? admin.from('modules').select('id, title, position, course_id').in('course_id', courseIds).order('position')
      : Promise.resolve({ data: [] }),
  ])

  const modules = (modulesRes.data ?? []) as CohortStatsRawData['modules']
  const moduleIds = modules.map((m) => m.id)

  const lessonsRes = moduleIds.length > 0
    ? await admin.from('lessons').select('id, title, position, module_id').in('module_id', moduleIds).order('position')
    : { data: [] }
  const lessons = (lessonsRes.data ?? []) as CohortStatsRawData['lessons']
  const lessonIds = lessons.map((l) => l.id)

  const [lessonProgressRes, labsRes] = await Promise.all([
    userIds.length > 0 && lessonIds.length > 0
      ? admin.from('lesson_progress').select('user_id, lesson_id, completed').in('user_id', userIds).in('lesson_id', lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? admin.from('labs').select('id, lesson_id, title').in('lesson_id', lessonIds)
      : Promise.resolve({ data: [] }),
  ])

  const labs = (labsRes.data ?? []) as CohortStatsRawData['labs']
  const labIds = labs.map((lab) => lab.id)

  const labSubmissionsRes =
    labIds.length > 0 && userIds.length > 0
      ? await admin
          .from('lab_submissions')
          .select('user_id, lab_id, status, overall_stars, submitted_at')
          .in('user_id', userIds)
          .in('lab_id', labIds)
          .eq('cohort_id', cohortId)
          .order('submitted_at', { ascending: false })
      : { data: [] }

  return {
    cohort: cohort as CohortStatsRawData['cohort'],
    userIds,
    courseIds,
    profiles: (profilesRes.data ?? []) as CohortStatsRawData['profiles'],
    courses: (coursesRes.data ?? []) as CohortStatsRawData['courses'],
    modules,
    lessons,
    lessonProgress: (lessonProgressRes.data ?? []) as CohortStatsRawData['lessonProgress'],
    labs,
    labSubmissions: (labSubmissionsRes.data ?? []) as CohortStatsRawData['labSubmissions'],
  }
}
