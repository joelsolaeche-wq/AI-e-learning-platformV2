import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BarChart3 } from 'lucide-react'
import { CohortStatsClient } from '@/components/admin/CohortStatsClient'
import type { CohortStatsData, Course } from '@/components/admin/CohortStatsClient'

type Enrollment = { user_id: string }
type Profile = { id: string; full_name: string | null; email: string }
type Module = { id: string; title: string; position: number; course_id: string }
type Lesson = { id: string; title: string; position: number; module_id: string }
type LessonProgress = { user_id: string; lesson_id: string; completed: boolean }
type Lab = { id: string; lesson_id: string; title: string }
type LabSubmission = {
  user_id: string
  lab_id: string
  status: string
  overall_stars: number | null
  submitted_at: string
}

export default async function CohortStatsPage({
  params,
}: {
  params: Promise<{ companyId: string; cohortId: string }>
}) {
  const { companyId, cohortId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Verify cohort belongs to this company
  const { data: cohort } = await admin
    .from('cohorts')
    .select('id, title, starts_at, status')
    .eq('id', cohortId)
    .eq('company_id', companyId)
    .single()

  if (!cohort) notFound()

  // Enrollments + cohort courses in parallel
  const [enrollmentsRes, cohortCoursesRes] = await Promise.all([
    admin.from('enrollments').select('user_id').eq('cohort_id', cohortId).eq('status', 'active'),
    admin.from('cohort_courses').select('course_id').eq('cohort_id', cohortId),
  ])

  const userIds = ((enrollmentsRes.data ?? []) as Enrollment[]).map((e) => e.user_id)
  const courseIds = ((cohortCoursesRes.data ?? []) as { course_id: string }[]).map((c) => c.course_id)

  // Profiles + courses + modules in parallel
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

  const modules = (modulesRes.data ?? []) as Module[]
  const moduleIds = modules.map((m) => m.id)

  // Lessons, then lesson_progress + labs in parallel
  const lessonsRes = moduleIds.length > 0
    ? await admin.from('lessons').select('id, title, position, module_id').in('module_id', moduleIds).order('position')
    : { data: [] }

  const lessons = (lessonsRes.data ?? []) as Lesson[]
  const lessonIds = lessons.map((l) => l.id)

  const [lessonProgressRes, labsRes] = await Promise.all([
    userIds.length > 0 && lessonIds.length > 0
      ? admin.from('lesson_progress').select('user_id, lesson_id, completed').in('user_id', userIds).in('lesson_id', lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? admin.from('labs').select('id, lesson_id, title').in('lesson_id', lessonIds)
      : Promise.resolve({ data: [] }),
  ])

  const lessonProgressRows = (lessonProgressRes.data ?? []) as LessonProgress[]
  const labs = (labsRes.data ?? []) as Lab[]
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

  const labSubmissions = (labSubmissionsRes.data ?? []) as LabSubmission[]

  // Lookup maps
  const profileMap = new Map<string, Profile>(
    ((profilesRes.data ?? []) as Profile[]).map((p) => [p.id, p]),
  )
  const courseMap = new Map<string, Course>(
    ((coursesRes.data ?? []) as Course[]).map((c) => [c.id, c]),
  )
  const lessonsByModule = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    if (!lessonsByModule.has(lesson.module_id)) lessonsByModule.set(lesson.module_id, [])
    lessonsByModule.get(lesson.module_id)!.push(lesson)
  }
  const modulesByCourse = new Map<string, Module[]>()
  for (const mod of modules) {
    if (!modulesByCourse.has(mod.course_id)) modulesByCourse.set(mod.course_id, [])
    modulesByCourse.get(mod.course_id)!.push(mod)
  }
  const labByLesson = new Map<string, Lab>(labs.map((lab) => [lab.lesson_id, lab]))

  // Latest lab submission per (userId, labId) — rows already ordered by submitted_at desc
  const latestSubMap = new Map<string, LabSubmission>()
  for (const sub of labSubmissions) {
    const key = `${sub.user_id}:${sub.lab_id}`
    if (!latestSubMap.has(key)) latestSubMap.set(key, sub)
  }

  // lesson_progress lookup
  const lessonProgressMap = new Map<string, boolean>()
  for (const lp of lessonProgressRows) {
    lessonProgressMap.set(`${lp.user_id}:${lp.lesson_id}`, lp.completed)
  }

  // Build learner stats
  const learners: CohortStatsData['learners'] = userIds.map((userId) => {
    const profile = profileMap.get(userId)
    let totalItems = 0
    let completedItems = 0

    const courses = courseIds.map((courseId) => {
      const courseMods = (modulesByCourse.get(courseId) ?? []).sort((a, b) => a.position - b.position)
      let courseTotalLessons = 0
      let courseCompletedLessons = 0
      let courseTotalLabs = 0
      let courseCompletedLabs = 0

      const courseModules = courseMods.map((mod) => {
        const modLessons = (lessonsByModule.get(mod.id) ?? []).sort((a, b) => a.position - b.position)
        const lessonStats = modLessons.map((lesson) => {
          const lessonDone = lessonProgressMap.get(`${userId}:${lesson.id}`) ?? false
          courseTotalLessons++
          if (lessonDone) courseCompletedLessons++

          const lab = labByLesson.get(lesson.id)
          if (!lab) {
            return { lessonId: lesson.id, title: lesson.title, position: lesson.position, moduleId: mod.id, completed: lessonDone }
          }

          const sub = latestSubMap.get(`${userId}:${lab.id}`)
          const labDone = sub?.status === 'scored'
          courseTotalLabs++
          if (labDone) courseCompletedLabs++

          return {
            lessonId: lesson.id,
            title: lesson.title,
            position: lesson.position,
            moduleId: mod.id,
            completed: lessonDone,
            lab: {
              labId: lab.id,
              labTitle: lab.title,
              status: sub?.status ?? null,
              overallStars: sub?.overall_stars ?? null,
            },
          }
        })
        return { moduleId: mod.id, title: mod.title, position: mod.position, lessons: lessonStats }
      })

      const courseTotalItems = courseTotalLessons + courseTotalLabs
      const courseCompletedItems = courseCompletedLessons + courseCompletedLabs
      const pct = courseTotalItems > 0 ? Math.round((courseCompletedItems / courseTotalItems) * 100) : 0

      totalItems += courseTotalItems
      completedItems += courseCompletedItems

      return {
        courseId,
        courseTitle: courseMap.get(courseId)?.title ?? courseId,
        totalLessons: courseTotalLessons,
        completedLessons: courseCompletedLessons,
        totalLabs: courseTotalLabs,
        completedLabs: courseCompletedLabs,
        totalItems: courseTotalItems,
        completedItems: courseCompletedItems,
        pct,
        modules: courseModules,
      }
    })

    const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    return {
      userId,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? userId,
      courses,
      totalItems,
      completedItems,
      overallPct,
    }
  })

  const statsData: CohortStatsData = {
    cohortTitle: cohort.title,
    cohortStartsAt: cohort.starts_at,
    cohortStatus: cohort.status,
    courses: (coursesRes.data ?? []) as Course[],
    learners,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/companies/${companyId}/cohorts`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          Cohorts
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 size={16} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{cohort.title} — Stats</h1>
          <p className="text-xs text-muted-foreground">
            {learners.length} learner{learners.length !== 1 ? 's' : ''} · {statsData.courses.length} course{statsData.courses.length !== 1 ? 's' : ''} · starts {new Date(cohort.starts_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <CohortStatsClient data={statsData} />
    </div>
  )
}
