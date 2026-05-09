// app/(app)/dashboard/cohort/[cohortId]/page.tsx
//
// Tier 3 of the Mati drilldown: company → cohorts → courses.
// Shows the courses linked to this cohort (via cohort_courses M2M, plus the
// backward-compat cohort.course_id as a fallback). Each course card opens
// the learner's next incomplete lesson.

import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronLeft, ChevronRight, BookOpen, Calendar, Users, Play, GraduationCap,
} from 'lucide-react'
import { Ring } from '@/components/ui/Ring'

function formatDateRange(starts_at: string, ends_at: string | null): string {
  const s = new Date(starts_at)
  const sFmt = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (!ends_at) return `Starts ${sFmt}`
  const e = new Date(ends_at)
  const eFmt = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sFmt} → ${eFmt}`
}

export default async function DashboardCohortPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 1. Verify the user is enrolled in this cohort. Without this, RLS would
  //    let the cohort row through but it wouldn't be the user's cohort.
  const { data: enrollmentRow } = await supabase
    .from('enrollments')
    .select('id, enrolled_at, status')
    .eq('user_id', user.id)
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
    .maybeSingle()

  if (!enrollmentRow) notFound()

  // 2. Pull the cohort itself.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cohortRes = await (supabase as any)
    .from('cohorts')
    .select('id, title, status, starts_at, ends_at, course_id, company_id, image_url')
    .eq('id', cohortId)
    .maybeSingle()
  if (cohortRes.error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cohortRes = await (supabase as any)
      .from('cohorts')
      .select('id, title, status, starts_at, ends_at, course_id, company_id')
      .eq('id', cohortId)
      .maybeSingle()
  }
  type CohortRow = {
    id: string
    title: string
    status: string
    starts_at: string
    ends_at: string | null
    course_id: string
    company_id: string | null
    image_url?: string | null
  }
  const cohort = cohortRes.data as CohortRow | null
  if (!cohort) notFound()

  // 3. Course set: cohort_courses M2M ∪ cohort.course_id (legacy primary).
  const { data: ccRows } = await supabase
    .from('cohort_courses')
    .select('course_id')
    .eq('cohort_id', cohortId)
  const courseIds = new Set<string>(
    ((ccRows ?? []) as { course_id: string }[]).map((r) => r.course_id),
  )
  if (cohort.course_id) courseIds.add(cohort.course_id)
  const courseIdList = Array.from(courseIds)

  type CourseRow = {
    id: string
    title: string
    slug: string
    description: string | null
    thumbnail_url: string | null
  }
  const courseMap = new Map<string, CourseRow>()
  if (courseIdList.length > 0) {
    const { data: courseRows } = await supabase
      .from('courses')
      .select('id, title, slug, description, thumbnail_url')
      .in('id', courseIdList)
    for (const c of (courseRows ?? []) as CourseRow[]) courseMap.set(c.id, c)
  }

  // 4. For each course, fetch lessons + the user's progress so we can render
  //    "X / Y lessons" on the card and link to the next incomplete lesson.
  type ModuleRow = { id: string; course_id: string; position: number }
  type LessonRow = { id: string; module_id: string; title: string; position: number }
  const modulesByCourse = new Map<string, ModuleRow[]>()
  const lessonsByCourse = new Map<string, LessonRow[]>()

  if (courseIdList.length > 0) {
    const { data: moduleRows } = await supabase
      .from('modules')
      .select('id, course_id, position')
      .in('course_id', courseIdList)
      .order('position')
    for (const m of (moduleRows ?? []) as ModuleRow[]) {
      const arr = modulesByCourse.get(m.course_id) ?? []
      arr.push(m)
      modulesByCourse.set(m.course_id, arr)
    }

    const moduleIds = (moduleRows ?? []).map((m) => (m as ModuleRow).id)
    if (moduleIds.length > 0) {
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('id, module_id, title, position')
        .in('module_id', moduleIds)
        .order('position')
      const moduleToCourse = new Map<string, string>()
      for (const m of (moduleRows ?? []) as ModuleRow[]) moduleToCourse.set(m.id, m.course_id)
      for (const l of (lessonRows ?? []) as LessonRow[]) {
        const courseId = moduleToCourse.get(l.module_id)
        if (!courseId) continue
        const arr = lessonsByCourse.get(courseId) ?? []
        arr.push(l)
        lessonsByCourse.set(courseId, arr)
      }
    }
  }

  const { data: completedRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('completed', true)
  const completedLessonIds = new Set<string>(
    ((completedRows ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id),
  )

  // 5. Active member count for this cohort.
  const { data: memberRows } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
  const memberCount = (memberRows ?? []).length

  // 6. Resolve company for the back-link target.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgRow } = cohort.company_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from('organizations')
        .select('id, name')
        .eq('id', cohort.company_id)
        .maybeSingle()
    : { data: null }
  const company = orgRow as { id: string; name: string } | null
  const backHref = company ? `/dashboard/company/${company.id}` : '/dashboard'
  const backLabel = company?.name ?? 'Your companies'

  // Build the per-course render data.
  const courses = courseIdList
    .map((id) => courseMap.get(id))
    .filter((c): c is CourseRow => Boolean(c))
    .map((course) => {
      const lessons = lessonsByCourse.get(course.id) ?? []
      const total = lessons.length
      const completed = lessons.filter((l) => completedLessonIds.has(l.id)).length
      const pct = total > 0 ? Math.floor((completed / total) * 100) : 0
      const nextLesson = lessons.find((l) => !completedLessonIds.has(l.id)) ?? lessons[0]
      const href = nextLesson ? `/dashboard/lesson/${nextLesson.id}` : null
      return { course, total, completed, pct, href }
    })

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      {/* Back link + cohort header */}
      <div className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ChevronLeft size={14} /> {backLabel}
        </Link>

        <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(700px_320px_at_15%_0%,rgba(139,92,246,0.22),transparent_60%),radial-gradient(500px_280px_at_92%_100%,rgba(34,211,238,0.18),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-10 py-8">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {cohort.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cohort.image_url}
                  alt={cohort.title}
                  className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_rgba(139,92,246,0.45)]">
                  <GraduationCap size={26} className="text-white" />
                </div>
              )}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                  <GraduationCap size={12} /> Cohort
                </div>
                <h1 className="my-2 text-[30px] font-bold leading-[1.08] tracking-[-0.02em]">
                  {cohort.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} />
                    {formatDateRange(cohort.starts_at, cohort.ends_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} />
                    {memberCount} member{memberCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
              <div className="text-[10.5px] uppercase tracking-[0.07em] text-primary">Courses</div>
              <div className="mt-1 font-mono text-[20px] font-bold tabular-nums">
                {courses.length}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Courses grid */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[18px] font-bold tracking-tight">Courses in this cohort</h2>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-12 text-center">
            <BookOpen size={32} className="text-muted-foreground/40" />
            <div className="text-[14px] font-semibold">No courses linked yet</div>
            <div className="text-[12.5px] text-muted-foreground">
              An admin will link courses to this cohort soon.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map(({ course, total, completed, pct, href }) => (
              <div
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
              >
                {/* Banner */}
                <div className="relative grid aspect-[16/7] place-items-center overflow-hidden bg-gradient-to-br from-primary/30 via-accent/15 to-transparent">
                  {course.thumbnail_url ? (
                    <Image
                      src={course.thumbnail_url}
                      alt={course.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <BookOpen size={42} className="text-white/70 drop-shadow" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div className="text-[14.5px] font-bold tracking-tight leading-snug">
                      {course.title}
                    </div>
                    {course.description && (
                      <div className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                        {course.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Ring pct={pct} size={48} stroke={4}>
                      <span className="text-[10.5px] font-bold">{pct}%</span>
                    </Ring>
                    <div className="flex-1">
                      <div className="text-[12.5px] font-semibold">
                        {completed} / {total}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {total === 0 ? 'No lessons yet' : 'lessons complete'}
                      </div>
                    </div>
                    {href ? (
                      <Link
                        href={href}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-3 text-[12.5px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                      >
                        <Play size={11} fill="currentColor" />
                        {completed > 0 && completed < total ? 'Resume' : 'Start'}
                      </Link>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-[10px] border border-border bg-secondary/40 px-3 text-[12px] text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick links to cohort detail */}
        <div className="mt-2 flex flex-wrap gap-2 text-[12.5px]">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Users size={12} /> Cohort members
          </Link>
        </div>
      </section>
    </main>
  )
}
