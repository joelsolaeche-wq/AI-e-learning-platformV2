// app/dashboard/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ring } from '@/components/ui/Ring'
import { Clock, Flame, Sparkles, Play, ChevronRight, Check, Trophy } from 'lucide-react'
import type { Database } from '@/lib/database.types'

// Types — same as your existing dashboard
type EnrollmentWithCohort = Pick<
  Database['public']['Tables']['enrollments']['Row'],
  'id' | 'cohort_id' | 'enrolled_at' | 'status'
> & {
  cohorts:
    | (Pick<
        Database['public']['Tables']['cohorts']['Row'],
        'id' | 'title' | 'status' | 'starts_at' | 'course_id'
      > & {
        courses: Pick<
          Database['public']['Tables']['courses']['Row'],
          'id' | 'title' | 'slug'
        > | null
      })
    | null
}

type LessonRowMin = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'module_id' | 'title'
>

// A simple deterministic gradient pair per cohort (so visuals stay stable)
const HUES: Array<{ from: string; to: string; icon: string }> = [
  { from: '#7C3AED', to: '#22D3EE', icon: '✦' },
  { from: '#06B6D4', to: '#10B981', icon: '◐' },
  { from: '#F472B6', to: '#FB923C', icon: '◇' },
  { from: '#FB7185', to: '#A78BFA', icon: '◎' },
  { from: '#34D399', to: '#60A5FA', icon: '△' },
  { from: '#FBBF24', to: '#F472B6', icon: '◈' },
]
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [enrollmentsResult, progressResult] = await Promise.all([
    supabase
      .from('enrollments')
      .select(`id, cohort_id, enrolled_at, status,
               cohorts ( id, title, status, starts_at, course_id,
                 courses ( id, title, slug ) )`)
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', user.id)
      .eq('completed', true),
  ])

  const enrollments: EnrollmentWithCohort[] =
    (enrollmentsResult.data as EnrollmentWithCohort[] | null) ?? []
  type LessonProgressRow = { lesson_id: string; completed: boolean }
  const completedLessonIds = new Set<string>(
    ((progressResult.data ?? []) as LessonProgressRow[]).map((r) => r.lesson_id),
  )

  const courseIds = enrollments
    .map((e) => e.cohorts?.course_id)
    .filter((id): id is string => Boolean(id))

  const lessonsByCourse = new Map<string, LessonRowMin[]>()
  if (courseIds.length > 0) {
    type ModuleRow = { id: string; course_id: string }
    const { data: rawModuleData } = await supabase
      .from('modules')
      .select('id, course_id')
      .in('course_id', courseIds)
    const moduleData = (rawModuleData ?? []) as unknown as ModuleRow[]
    const moduleIds = moduleData.map((m) => m.id)
    const moduleToCourse = new Map(moduleData.map((m) => [m.id, m.course_id]))
    if (moduleIds.length > 0) {
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, module_id, title')
        .in('module_id', moduleIds)
      const rows = (lessonsData ?? []) as LessonRowMin[]
      for (const row of rows) {
        const courseId = moduleToCourse.get(row.module_id)
        if (!courseId) continue
        const arr = lessonsByCourse.get(courseId) ?? []
        arr.push(row)
        lessonsByCourse.set(courseId, arr)
      }
    }
  }

  const totalCompleted = completedLessonIds.size
  const greetingName = (user.email ?? 'there').split('@')[0]

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(600px_300px_at_10%_0%,rgba(139,92,246,0.22),transparent_60%),radial-gradient(500px_280px_at_90%_100%,rgba(34,211,238,0.18),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-11 py-10">
        <div className="relative z-10 max-w-[640px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" /> Continue learning
          </div>
          <h1 className="my-4 text-[40px] font-bold leading-[1.08] tracking-[-0.025em]">
            Welcome back, <span className="grad-text">{greetingName}</span>.
            <br />
            You&apos;ve completed <span className="grad-text">{totalCompleted}</span> lessons this season.
          </h1>
          <div className="mb-6 flex gap-4 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> 18 min today</span>
            <span className="inline-flex items-center gap-1.5"><Flame size={14} /> 7-day streak</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> +120 XP today</span>
          </div>
          <div className="flex gap-2.5">
            <Link href="/catalog" className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-4.5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5">
              <Play size={14} fill="currentColor" /> Browse catalog
            </Link>
          </div>
        </div>
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-10 -top-10 -bottom-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-primary/45 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[220px] w-[220px] rounded-full bg-accent/35 blur-[40px]" />
          <div className="absolute right-[220px] top-[60px] h-[140px] w-[140px] rounded-full bg-pink-400/30 blur-[40px]" />
        </div>
      </section>

      {/* Empty state */}
      {enrollments.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-12 text-center">
          <Trophy size={36} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No cohorts yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse the catalog to find your team&apos;s AI course.</p>
          <Link href="/catalog" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Browse catalog <ChevronRight size={14} />
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Your cohorts</h2>
            <Link href="/catalog" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => {
              const cohort = enrollment.cohorts
              if (!cohort) return null
              const courseLessons = lessonsByCourse.get(cohort.course_id) ?? []
              const totalLessons = courseLessons.length
              const completedCount = courseLessons.filter((l) => completedLessonIds.has(l.id)).length
              const pct = totalLessons > 0 ? Math.floor((completedCount / totalLessons) * 100) : 0
              const hue = hueFor(cohort.id)
              const firstUnfinished = courseLessons.find((l) => !completedLessonIds.has(l.id)) ?? courseLessons[0]
              const resumeHref = firstUnfinished ? `/dashboard/lesson/${firstUnfinished.id}` : `/catalog/${cohort.course_id}`

              return (
                <Link
                  key={enrollment.id}
                  href={resumeHref}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                >
                  <div
                    className="relative grid aspect-[16/8] place-items-center"
                    style={{ background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_50%)]" />
                    <span className="font-mono text-5xl font-semibold text-white/85 drop-shadow-[0_0_24px_rgba(0,0,0,0.4)]">
                      {hue.icon}
                    </span>
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-black/40 px-2.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-md">
                      {cohort.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5 p-4">
                    <div className="text-[14.5px] font-semibold tracking-tight">{cohort.title}</div>
                    <div className="text-[12px] text-muted-foreground">{totalLessons} lessons</div>
                    <div className="mt-1 flex items-center gap-3">
                      <Ring pct={pct} size={48} stroke={5}>
                        <span className="text-[11px]">{pct}%</span>
                      </Ring>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold">{completedCount}/{totalLessons}</div>
                        <div className="text-[11px] text-muted-foreground">lessons complete</div>
                      </div>
                      <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-primary/30 bg-primary/15 text-primary transition-all group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                        <Play size={14} fill="currentColor" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
