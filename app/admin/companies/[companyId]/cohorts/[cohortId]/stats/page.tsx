import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BarChart3 } from 'lucide-react'
import { CohortStatsClient } from '@/components/admin/CohortStatsClient'
import type { CohortStatsData, Course } from '@/components/admin/CohortStatsClient'
import { getCohortStatsRawData } from '@/lib/queries/admin/companies.queries'

export default async function CohortStatsPage({
  params,
}: {
  params: Promise<{ companyId: string; cohortId: string }>
}) {
  const { companyId, cohortId } = await params

  const raw = await getCohortStatsRawData(companyId, cohortId)
  if (raw === null) {
    // Could be: caller not authorized, or cohort doesn't belong to this company.
    // The query function collapses both into null; notFound() is the closest
    // visible outcome that matches the previous behavior for the cohort case
    // and is also acceptable for unauthorized callers (they shouldn't see
    // whether the cohort exists).
    notFound()
  }

  const {
    cohort,
    userIds,
    courseIds,
    profiles,
    courses,
    modules,
    lessons,
    lessonProgress: lessonProgressRows,
    labs,
    labSubmissions,
  } = raw

  // Lookup maps (pure derivation from the raw data, no IO)
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const courseMap = new Map<string, Course>(courses.map((c) => [c.id, c]))
  const lessonsByModule = new Map<string, typeof lessons>()
  for (const lesson of lessons) {
    if (!lessonsByModule.has(lesson.module_id)) lessonsByModule.set(lesson.module_id, [])
    lessonsByModule.get(lesson.module_id)!.push(lesson)
  }
  const modulesByCourse = new Map<string, typeof modules>()
  for (const mod of modules) {
    if (!modulesByCourse.has(mod.course_id)) modulesByCourse.set(mod.course_id, [])
    modulesByCourse.get(mod.course_id)!.push(mod)
  }
  const labByLesson = new Map(labs.map((lab) => [lab.lesson_id, lab]))

  // Latest lab submission per (userId, labId) — rows already ordered by submitted_at desc
  const latestSubMap = new Map<string, typeof labSubmissions[number]>()
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
    courses: courses as Course[],
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
