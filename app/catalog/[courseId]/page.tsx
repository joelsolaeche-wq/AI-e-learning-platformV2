// app/catalog/[courseId]/page.tsx
// All data sourced from Supabase: courses, modules, lessons, cohorts,
// user enrollments. No mocked instructor / ratings / office hours.
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import {
  Clock, PlayCircle, ChevronRight, Users, Sparkles,
  BookOpen, Code2, ChevronLeft, CheckCircle2, Calendar,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { EnrollButton } from '@/components/EnrollButton'

type CourseRow = Pick<
  Database['public']['Tables']['courses']['Row'],
  'id' | 'title' | 'slug' | 'description' | 'thumbnail_url'
>

type LessonRow = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'title' | 'position' | 'duration_seconds'
>

type ModuleWithLessons = Pick<
  Database['public']['Tables']['modules']['Row'],
  'id' | 'title' | 'position'
> & { lessons: LessonRow[] | null }

type CohortRow = Pick<
  Database['public']['Tables']['cohorts']['Row'],
  'id' | 'title' | 'starts_at' | 'ends_at' | 'max_seats' | 'status'
>

const HUES: Array<{ from: string; to: string; symbol: string }> = [
  { from: '#7C3AED', to: '#22D3EE', symbol: '✦' },
  { from: '#06B6D4', to: '#10B981', symbol: '◐' },
  { from: '#F472B6', to: '#FB923C', symbol: '◇' },
  { from: '#FB7185', to: '#A78BFA', symbol: '◎' },
  { from: '#34D399', to: '#60A5FA', symbol: '△' },
  { from: '#FBBF24', to: '#F472B6', symbol: '◈' },
]
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [courseResult, modulesResult, cohortsResult, enrollmentsResult] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, slug, description, thumbnail_url')
      .eq('id', courseId)
      .eq('is_published', true)
      .single(),
    supabase
      .from('modules')
      .select('id, title, position, lessons (id, title, position, duration_seconds)')
      .eq('course_id', courseId)
      .order('position', { ascending: true }),
    supabase
      .from('cohorts')
      .select('id, title, starts_at, ends_at, max_seats, status')
      .eq('course_id', courseId)
      .order('starts_at', { ascending: true }),
    supabase
      .from('enrollments')
      .select('cohort_id')
      .eq('user_id', user.id),
  ])

  if (modulesResult.error) console.error('modules fetch error', modulesResult.error)
  if (cohortsResult.error) console.error('cohorts fetch error', cohortsResult.error)

  const modules: ModuleWithLessons[] = (modulesResult.data as ModuleWithLessons[] | null) ?? []
  const cohorts: CohortRow[] = (cohortsResult.data as CohortRow[] | null) ?? []
  type EnrollmentCohortIdRow = { cohort_id: string }
  const enrolledCohortIds = new Set<string>(
    ((enrollmentsResult.data ?? []) as EnrollmentCohortIdRow[]).map((e) => e.cohort_id),
  )

  const rawCourse = courseResult.data
  if (courseResult.error || !rawCourse) notFound()
  const course: CourseRow = rawCourse as CourseRow

  // Real aggregate stats
  const totalLessons = modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0)
  const totalSeconds = modules.reduce(
    (s, m) => s + (m.lessons ?? []).reduce((ss, l) => ss + (l.duration_seconds ?? 0), 0),
    0,
  )
  const totalHours = totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 3600)) : 0
  const hue = hueFor(course.id)
  const activeCohortCount = cohorts.filter((c) => c.status === 'active').length
  const upcomingCohortCount = cohorts.filter((c) => new Date(c.starts_at).getTime() > Date.now()).length

  // Module titles → "What you'll learn" (real data, just visualised)
  const learningOutcomes = modules.slice(0, 6).map((m, i) => ({
    text: m.title,
    Icon: [Sparkles, Code2, BookOpen, CheckCircle2, Users, Calendar][i % 6],
  }))

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-8 pt-6 pb-16">

      {/* Back link */}
      <Link
        href="/catalog"
        className="inline-flex w-fit items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft size={13} /> Back to catalog
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            <span>Course</span>
          </div>

          <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.025em]">
            {course.title}
          </h1>

          {course.description && (
            <p className="max-w-[560px] text-[15px] leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          )}

          {/* Stats bar — only counts that come from real rows */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-[13px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <PlayCircle size={14} className="text-primary" />
              <span className="font-medium text-foreground">{totalLessons}</span> lesson{totalLessons !== 1 ? 's' : ''}
            </span>
            {totalHours > 0 && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock size={14} className="text-accent" />
                <span className="font-medium text-foreground">{totalHours}h</span> total
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <BookOpen size={14} className="text-cyan-400" />
              <span className="font-medium text-foreground">{modules.length}</span> module{modules.length !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users size={14} className="text-emerald-400" />
              <span className="font-medium text-foreground">{cohorts.length}</span> cohort{cohorts.length !== 1 ? 's' : ''}
              {activeCohortCount > 0 && <span className="text-emerald-400/80">· {activeCohortCount} active</span>}
            </span>
          </div>
        </div>

        {/* Hero thumbnail (real thumbnail_url or gradient fallback) */}
        <div
          className="relative aspect-[16/11] overflow-hidden rounded-[22px] border border-border"
          style={{ background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.30),transparent_55%)]" />
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-mono text-[120px] font-bold text-white/95 drop-shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              {hue.symbol}
            </span>
          )}
        </div>
      </section>

      {/* ── What you'll learn (module titles, real) ─────────────── */}
      {learningOutcomes.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[20px] font-bold tracking-tight">What you&apos;ll learn</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {learningOutcomes.map((o, i) => {
              const Icon = o.Icon
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-[0_4px_16px_rgba(139,92,246,0.08)]">
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-primary/20 to-accent/15 ring-1 ring-primary/30">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <div className="text-[13.5px] font-medium leading-snug">{o.text}</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Two-col: Curriculum + Cohorts ───────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px] lg:items-start">

        {/* Curriculum */}
        <section className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[20px] font-bold tracking-tight">Curriculum</h2>
            <span className="text-[12px] text-muted-foreground">
              {modules.length} module{modules.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
            </span>
          </div>

          {modules.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No modules available yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {modules.map((mod, i) => {
                const lessons = (mod.lessons ?? []).slice().sort((a, b) => a.position - b.position)
                const moduleSeconds = lessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0)
                const moduleMinutes = Math.round(moduleSeconds / 60)

                return (
                  <div key={mod.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-3 border-b border-border bg-secondary/20 px-5 py-3.5">
                      <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-primary/20 to-accent/15 font-mono text-[12px] font-bold text-primary ring-1 ring-primary/30">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Module {i + 1}</div>
                        <div className="text-[14.5px] font-bold tracking-tight">{mod.title}</div>
                      </div>
                      <div className="text-right text-[11.5px] text-muted-foreground">
                        <div>{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</div>
                        {moduleMinutes > 0 && <div>{moduleMinutes} min</div>}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      {lessons.map((lesson, li) => (
                        <Link
                          key={lesson.id}
                          href={`/dashboard/lesson/${lesson.id}`}
                          className="group flex items-center gap-3 border-t border-border/40 px-5 py-2.5 first:border-t-0 transition-colors hover:bg-secondary/30"
                        >
                          <div className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[10px] font-medium text-muted-foreground transition-colors group-hover:bg-primary/20 group-hover:text-primary">
                            {li + 1}
                          </div>
                          <PlayCircle size={13} className="flex-shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                          <span className="flex-1 truncate text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
                            {lesson.title}
                          </span>
                          {lesson.duration_seconds && (
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
                              {Math.round(lesson.duration_seconds / 60)} min
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Cohorts (sticky right rail) */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-bold tracking-tight">Cohorts</h2>
            {upcomingCohortCount > 0 && (
              <span className="text-[11px] text-emerald-400">{upcomingCohortCount} upcoming</span>
            )}
          </div>

          {cohorts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
              No cohorts scheduled yet. Check back soon.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cohorts.map((cohort) => {
                const enrolled = enrolledCohortIds.has(cohort.id)
                const startsAt = new Date(cohort.starts_at)
                const isUpcoming = startsAt.getTime() > Date.now()
                const isActive = cohort.status === 'active'

                return (
                  <div
                    key={cohort.id}
                    className={[
                      'flex flex-col gap-3 rounded-2xl border p-5 transition-all',
                      enrolled
                        ? 'border-emerald-400/30 bg-gradient-to-br from-emerald-400/[0.08] to-transparent'
                        : 'border-border bg-card hover:border-primary/30',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Past'}
                        </div>
                        <div className="text-[14.5px] font-bold leading-snug">{cohort.title}</div>
                      </div>
                      {enrolled && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 size={10} /> Enrolled
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 rounded-[10px] border border-border/60 bg-secondary/20 p-3">
                      <div className="flex items-center gap-1.5 text-[12px]">
                        <Clock size={11} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Starts</span>
                        <span className="ml-auto font-medium tabular-nums">
                          {startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {cohort.ends_at && (
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <Calendar size={11} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Ends</span>
                          <span className="ml-auto font-medium tabular-nums">
                            {new Date(cohort.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {cohort.max_seats > 0 && (
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <Users size={11} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Seats</span>
                          <span className="ml-auto font-medium">Up to {cohort.max_seats}</span>
                        </div>
                      )}
                    </div>

                    {!enrolled && <EnrollButton cohortId={cohort.id} />}
                    {enrolled && (
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card px-4 py-2 text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        Go to dashboard <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
