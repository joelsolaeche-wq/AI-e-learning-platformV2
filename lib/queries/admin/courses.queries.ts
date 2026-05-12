// Admin queries for the `courses`, `modules`, `lessons`, `labs`, and
// `lab_rubric_items` tables. Same gate-then-query pattern as the other
// `lib/queries/admin/*` modules.

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin, assertAdminOrInstructor } from '@/lib/auth/guards'

// ──────────────────────────────────────────────────────────────────────
// Course listing
// ──────────────────────────────────────────────────────────────────────

export type AdminCourseListRow = {
  id: string
  title: string
  slug: string
  status: string | null
  is_published: boolean
  created_at: string
}

export async function listAllCoursesForAdmin(): Promise<AdminCourseListRow[] | null> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('courses')
    .select('id, title, slug, status, is_published, created_at')
    .order('created_at', { ascending: false })
  return (data ?? []) as AdminCourseListRow[]
}

// ──────────────────────────────────────────────────────────────────────
// Course detail (course + modules + lessons)
// ──────────────────────────────────────────────────────────────────────

export type AdminCourseModule = {
  id: string
  title: string
  position: number
  lessons: Array<{
    id: string
    title: string
    position: number
    mux_playback_id: string | null
    duration_seconds: number | null
  }>
}

export type AdminCourseDetail = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  course: any
  modules: AdminCourseModule[]
}

export async function getCourseDetailForAdmin(
  courseId: string,
): Promise<AdminCourseDetail | null> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course } = await (admin as any)
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course) return { course: null, modules: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: modules } = await (admin as any)
    .from('modules')
    .select(`
      id, title, position,
      lessons(id, title, position, mux_playback_id, duration_seconds)
    `)
    .eq('course_id', courseId)
    .order('position')

  type ModuleRaw = Omit<AdminCourseModule, 'lessons'> & {
    lessons: AdminCourseModule['lessons']
  }
  const modulesWithLessons: AdminCourseModule[] = ((modules ?? []) as ModuleRaw[]).map(
    (m) => ({ ...m, lessons: (m.lessons ?? []).sort((a, b) => a.position - b.position) }),
  )

  return { course, modules: modulesWithLessons }
}

// ──────────────────────────────────────────────────────────────────────
// Lesson detail (lesson + optional lab + rubric items)
// ──────────────────────────────────────────────────────────────────────

export type AdminLessonRubricItem = {
  criterion: string
  description: string
  weight: number
}

export type AdminLessonDetail = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lesson: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingLab: any | null
  rubricItems: AdminLessonRubricItem[]
}

export async function getLessonDetailForAdmin(
  lessonId: string,
): Promise<AdminLessonDetail | null> {
  const caller = await assertAdmin()
  if (!caller) return null

  const admin = createAdminClient()
  const [lessonResult, labResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('lessons')
      .select(
        'id, title, mux_playback_id, duration_seconds, transcript, position, content_type, document_url, slides_url, notebook_url',
      )
      .eq('id', lessonId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('labs').select('id, title, brief_md').eq('lesson_id', lessonId).maybeSingle(),
  ])

  if (!lessonResult.data) return { lesson: null, existingLab: null, rubricItems: [] }

  const existingLab = labResult.data ?? null
  let rubricItems: AdminLessonRubricItem[] = []
  if (existingLab) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rubric } = await (admin as any)
      .from('lab_rubric_items')
      .select('criterion, description, weight, position')
      .eq('lab_id', existingLab.id)
      .order('position', { ascending: true })
    rubricItems = ((rubric ?? []) as Array<AdminLessonRubricItem>).map((r) => ({
      criterion: r.criterion,
      description: r.description,
      weight: r.weight,
    }))
  }

  return { lesson: lessonResult.data, existingLab, rubricItems }
}
