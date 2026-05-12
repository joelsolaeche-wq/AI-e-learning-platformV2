// app/(app)/dashboard/company/[companyId]/page.tsx
//
// Tier 2 of the Mati drilldown: company → cohorts → courses.
// Shows the cohorts within a single company that the learner is enrolled in,
// with real progress + a Resume CTA in the header.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, Users, Play, Sparkles, Calendar } from 'lucide-react'
import { CohortCard } from '@/components/cohorts/CohortCard'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Ring } from '@/components/ui/Ring'

type CohortRow = {
  id: string
  title: string
  status: string
  starts_at: string
  ends_at: string | null
  course_id: string
  company_id: string | null
  image_url: string | null
}

type LessonRow = { id: string; module_id: string; title: string; position: number }

export default async function DashboardCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 1. Pull the user's active enrollments. Filter to cohorts in THIS company.
  const { data: enrollmentsRaw } = await supabase
    .from('enrollments')
    .select('id, cohort_id, enrolled_at')
    .eq('user_id', user.id)
    .eq('status', 'active')

  type EnrollmentRow = { id: string; cohort_id: string; enrolled_at: string }
  const enrollments = (enrollmentsRaw ?? []) as EnrollmentRow[]
  const cohortIds = enrollments.map((e) => e.cohort_id)

  // 2. Hydrate cohorts. Filter to those in this company. Drop draft cohorts —
  //    learners shouldn't see in-flight admin work-in-progress entries.
  const cohortsInCompany: CohortRow[] = []
  if (cohortIds.length > 0) {
    const { data: cohortRows, error: cohortErr } = await supabase
      .from('cohorts')
      .select('id, title, status, starts_at, ends_at, course_id, company_id, image_url')
      .in('id', cohortIds)
      .eq('company_id', companyId)
    if (cohortErr) {
      console.error('[dashboard/company] cohorts query failed:', {
        message: cohortErr.message, code: cohortErr.code, details: cohortErr.details, hint: cohortErr.hint,
      })
    }
    for (const c of (cohortRows ?? []) as CohortRow[]) {
      if (c.status !== 'draft') cohortsInCompany.push(c)
    }
  }

  if (cohortsInCompany.length === 0) notFound()

  // 3. Fetch the organization for the header.
  const { data: orgData } = await supabase
    .from('organizations')
    .select('id, name, logo_url, description')
    .eq('id', companyId)
    .maybeSingle()
  const company = orgData as
    | { id: string; name: string; logo_url: string | null; description: string | null }
    | null

  // 4. Per-cohort progress: fetch lessons + the user's completion set.
  const courseIds = Array.from(new Set(cohortsInCompany.map((c) => c.course_id).filter(Boolean)))
  const lessonsByCourse = new Map<string, LessonRow[]>()
  if (courseIds.length > 0) {
    type ModuleRow = { id: string; course_id: string; position: number }
    const { data: rawModules } = await supabase
      .from('modules')
      .select('id, course_id, position')
      .in('course_id', courseIds)
      .order('position')
    const modulesArr = (rawModules ?? []) as ModuleRow[]
    const moduleToCourse = new Map(modulesArr.map((m) => [m.id, m.course_id]))
    if (modulesArr.length > 0) {
      const { data: rawLessons } = await supabase
        .from('lessons')
        .select('id, module_id, title, position')
        .in('module_id', modulesArr.map((m) => m.id))
        .order('position')
      for (const l of (rawLessons ?? []) as LessonRow[]) {
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

  // 5. Active member count per cohort.
  const memberCount = new Map<string, number>()
  if (cohortsInCompany.length > 0) {
    const { data: memberRows } = await supabase
      .from('enrollments')
      .select('cohort_id')
      .in('cohort_id', cohortsInCompany.map((c) => c.id))
      .eq('status', 'active')
    for (const r of (memberRows ?? []) as { cohort_id: string }[]) {
      memberCount.set(r.cohort_id, (memberCount.get(r.cohort_id) ?? 0) + 1)
    }
  }

  const enrollmentByCohort = new Map(enrollments.map((e) => [e.cohort_id, e]))

  // Aggregate company-wide progress + find the next-up lesson for the
  // big "Continue learning" CTA in the header.
  let aggCompleted = 0
  let aggTotal = 0
  let nextLesson: { id: string; title: string; cohortTitle: string } | null = null
  for (const c of cohortsInCompany) {
    const lessons = lessonsByCourse.get(c.course_id) ?? []
    aggTotal += lessons.length
    aggCompleted += lessons.filter((l) => completedLessonIds.has(l.id)).length
    if (!nextLesson) {
      const next = lessons.find((l) => !completedLessonIds.has(l.id))
      if (next) nextLesson = { id: next.id, title: next.title, cohortTitle: c.title }
    }
  }
  const aggPct = aggTotal > 0 ? Math.floor((aggCompleted / aggTotal) * 100) : 0

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'Your companies', href: '/dashboard' },
          { label: company?.name ?? 'Company' },
        ]}
      />

      {/* Company header — logo, name, aggregate progress, next-lesson CTA */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(700px_320px_at_15%_0%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(500px_280px_at_92%_100%,rgba(139,92,246,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-10 py-8">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {company?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_rgba(139,92,246,0.45)]">
                <Building2 size={26} className="text-white" />
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
                <Building2 size={12} /> Company
              </div>
              <h1 className="my-2 text-[30px] font-bold leading-[1.08] tracking-[-0.02em]">
                {company?.name ?? 'Your company'}
              </h1>
              {company?.description ? (
                <p className="max-w-[560px] text-[13.5px] text-muted-foreground">{company.description}</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  {cohortsInCompany.length} cohort{cohortsInCompany.length === 1 ? '' : 's'} you&apos;re enrolled in
                </p>
              )}
            </div>
          </div>

          {/* Right: progress + resume CTA */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
              <Ring pct={aggPct} size={52} stroke={5}>
                <span className="text-[11px] font-bold">{aggPct}%</span>
              </Ring>
              <div className="text-[12px]">
                <div className="text-[10.5px] uppercase tracking-[0.07em] text-cyan-400">
                  Your progress
                </div>
                <div className="font-semibold">
                  {aggCompleted} / {aggTotal} lessons
                </div>
              </div>
            </div>
            {nextLesson && (
              <Link
                href={`/dashboard/lesson/${nextLesson.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
              >
                <Play size={13} fill="currentColor" />
                <span className="max-w-[180px] truncate">
                  Continue: {nextLesson.title}
                </span>
              </Link>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-10 -right-10 -top-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-accent/30 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[200px] w-[200px] rounded-full bg-primary/40 blur-[40px]" />
        </div>
      </section>

      {/* Cohort grid */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">Cohorts you&apos;re in</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Click a cohort to see the courses inside.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11.5px] text-muted-foreground">
            <Calendar size={12} />
            {cohortsInCompany.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohortsInCompany.map((cohort) => {
            const enrollment = enrollmentByCohort.get(cohort.id)
            const isNew = enrollment
              ? Date.now() - new Date(enrollment.enrolled_at).getTime() < 48 * 60 * 60 * 1000
              : false
            const lessons = lessonsByCourse.get(cohort.course_id) ?? []
            const completed = lessons.filter((l) => completedLessonIds.has(l.id)).length
            const total = lessons.length
            return (
              <CohortCard
                key={cohort.id}
                variant="learner"
                cohort={{
                  id: cohort.id,
                  title: cohort.title,
                  status: cohort.status,
                  starts_at: cohort.starts_at,
                  ends_at: cohort.ends_at,
                  image_url: cohort.image_url,
                }}
                subtitle={`${memberCount.get(cohort.id) ?? 0} member${memberCount.get(cohort.id) === 1 ? '' : 's'}`}
                progress={{ completed, total }}
                isNew={isNew}
                primaryHref={`/dashboard/cohort/${cohort.id}`}
              />
            )
          })}
        </div>

        {/* Empty state — keep around in case all cohorts get filtered out */}
        {cohortsInCompany.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-12 text-center">
            <Users size={32} className="text-muted-foreground/40" />
            <div className="text-[14px] font-semibold">No active cohorts</div>
            <div className="text-[12.5px] text-muted-foreground">
              All your cohorts in this company are still in draft.
            </div>
          </div>
        )}

        <div className="mt-2 inline-flex items-center gap-1.5 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-[12px] text-muted-foreground">
          <Sparkles size={13} className="text-primary" />
          Your progress in each cohort below — click any card to open it.
        </div>
      </section>
    </main>
  )
}
