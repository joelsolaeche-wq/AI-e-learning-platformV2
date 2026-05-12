// Admin queries for the `courses`, `modules`, `lessons`, `labs`, and
// `lab_rubric_items` tables. Same gate-then-query pattern as the other
// `lib/queries/admin/*` modules.

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin, assertAdminOrInstructor } from '@/lib/auth/guards'
import type { Database } from '@/lib/database.types'

type CourseRow = Database['public']['Tables']['courses']['Row']
type LessonRow = Database['public']['Tables']['lessons']['Row']
type LabRow = Database['public']['Tables']['labs']['Row']

// Lesson detail page selects a subset of columns — narrow the row type
// to those fields so callers see exactly what's available.
type LessonDetailRow = Pick<
  LessonRow,
  | 'id'
  | 'title'
  | 'mux_playback_id'
  | 'duration_seconds'
  | 'transcript'
  | 'position'
  | 'content_type'
  | 'document_url'
  | 'slides_url'
  | 'notebook_url'
>

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
  const { data } = await admin
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
  course: CourseRow | null
  modules: AdminCourseModule[]
}

export async function getCourseDetailForAdmin(
  courseId: string,
): Promise<AdminCourseDetail | null> {
  const caller = await assertAdminOrInstructor()
  if (!caller) return null

  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course) return { course: null, modules: [] }

  const { data: modules } = await admin
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
  lesson: LessonDetailRow | null
  existingLab: Pick<LabRow, 'id' | 'title' | 'brief_md'> | null
  rubricItems: AdminLessonRubricItem[]
}

export async function getLessonDetailForAdmin(
  lessonId: string,
): Promise<AdminLessonDetail | null> {
  const caller = await assertAdmin()
  if (!caller) return null

  const admin = createAdminClient()
  const [lessonResult, labResult] = await Promise.all([
    admin
      .from('lessons')
      .select(
        'id, title, mux_playback_id, duration_seconds, transcript, position, content_type, document_url, slides_url, notebook_url',
      )
      .eq('id', lessonId)
      .single(),
    admin.from('labs').select('id, title, brief_md').eq('lesson_id', lessonId).maybeSingle(),
  ])

  if (!lessonResult.data) return { lesson: null, existingLab: null, rubricItems: [] }

  const existingLab = labResult.data ?? null
  let rubricItems: AdminLessonRubricItem[] = []
  if (existingLab) {
    const { data: rubric } = await admin
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
