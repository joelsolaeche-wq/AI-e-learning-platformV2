// app/dashboard/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ring } from '@/components/ui/Ring'
import {
  Clock, Flame, Sparkles, Play, ChevronRight, Trophy,
  Zap, Target, BookOpen, Award, Lock,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnrollmentWithCohort = Pick<
  Database['public']['Tables']['enrollments']['Row'],
  'id' | 'cohort_id' | 'enrolled_at' | 'status'
> & {
  cohorts:
    | (Pick<
        Database['public']['Tables']['cohorts']['Row'],
        'id' | 'title' | 'status' | 'starts_at' | 'ends_at' | 'course_id'
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

type QuizAttemptRow = { score: number; max_score: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function statusBadge(pct: number): { label: string; cls: string } {
  if (pct === 0) return { label: 'Just started', cls: 'bg-blue-400/20 text-blue-300 border-blue-400/40' }
  if (pct < 80) return { label: 'On track', cls: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40' }
  if (pct < 100) return { label: 'Almost done', cls: 'bg-orange-400/20 text-orange-300 border-orange-400/40' }
  return { label: 'Completed', cls: 'bg-primary/20 text-primary border-primary/40' }
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000))
}

// ---------------------------------------------------------------------------
// Mock leaderboard peers (replace with DB view/RPC in production)
// ---------------------------------------------------------------------------
const MOCK_PEERS = [
  { name: 'Devon Cole', initials: 'DC', color: '#7C3AED', pct: 82 },
  { name: 'Riya Shah', initials: 'RS', color: '#22D3EE', pct: 64 },
  { name: 'Marcus Lee', initials: 'ML', color: '#F472B6', pct: 51 },
  { name: 'Aiko Nakamura', initials: 'AN', color: '#34D399', pct: 47 },
  { name: 'Theo Bauer', initials: 'TB', color: '#FBBF24', pct: 31 },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Parallel: enrollments + completed lessons + quiz attempts
  const [enrollmentsResult, progressResult, quizResult] = await Promise.all([
    supabase
      .from('enrollments')
      .select(`id, cohort_id, enrolled_at, status,
               cohorts ( id, title, status, starts_at, ends_at, course_id,
                 courses ( id, title, slug ) )`)
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', user.id)
      .eq('completed', true),
    supabase
      .from('quiz_attempts')
      .select('score, max_score')
      .eq('user_id', user.id),
  ])

  const enrollments: EnrollmentWithCohort[] =
    (enrollmentsResult.data as EnrollmentWithCohort[] | null) ?? []

  type LessonProgressRow = { lesson_id: string; completed: boolean }
  const completedLessonIds = new Set<string>(
    ((progressResult.data ?? []) as LessonProgressRow[]).map((r) => r.lesson_id),
  )

  const perfectQuizCount = ((quizResult.data ?? []) as QuizAttemptRow[]).filter(
    (a) => a.max_score > 0 && a.score === a.max_score,
  ).length

  // Build lessonsByCourse
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
      for (const row of (lessonsData ?? []) as LessonRowMin[]) {
        const courseId = moduleToCourse.get(row.module_id)
        if (!courseId) continue
        const arr = lessonsByCourse.get(courseId) ?? []
        arr.push(row)
        lessonsByCourse.set(courseId, arr)
      }
    }
  }

  const totalCompleted = completedLessonIds.size
  const totalLessonsAcrossAll = [...lessonsByCourse.values()].reduce((s, ls) => s + ls.length, 0)
  const lessonsAway = Math.max(0, totalLessonsAcrossAll - totalCompleted)

  // First incomplete lesson → Resume button
  let resumeLesson: { href: string; title: string } | null = null
  for (const enrollment of enrollments) {
    const courseId = enrollment.cohorts?.course_id
    if (!courseId) continue
    const next = (lessonsByCourse.get(courseId) ?? []).find((l) => !completedLessonIds.has(l.id))
    if (next) { resumeLesson = { href: `/dashboard/lesson/${next.id}`, title: next.title }; break }
  }

  // Overall pct for leaderboard "You" entry
  const overallPct = totalLessonsAcrossAll > 0
    ? Math.floor((totalCompleted / totalLessonsAcrossAll) * 100)
    : 0

  // Build leaderboard (insert real user as "You")
  const youInitials = ((user.email ?? 'YO').split('@')[0]).slice(0, 2).toUpperCase()
  const leaderboard = [
    ...MOCK_PEERS,
    { name: 'You', initials: youInitials, color: '#A78BFA', pct: overallPct, isYou: true },
  ]
    .sort((a, b) => b.pct - a.pct)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // Achievements (derived from real data)
  const anyCourseDone = [...lessonsByCourse.entries()].some(([courseId]) => {
    const lessons = lessonsByCourse.get(courseId) ?? []
    return lessons.length > 0 && lessons.every((l) => completedLessonIds.has(l.id))
  })

  const achievements = [
    {
      id: 'streak',
      Icon: Flame,
      label: '7-day streak',
      desc: 'Earned today',
      iconBg: 'from-orange-400 to-rose-500',
      earned: true,
    },
    {
      id: 'speed',
      Icon: Zap,
      label: 'Speed runner',
      desc: '5 lessons in a day',
      iconBg: 'from-yellow-400 to-orange-400',
      earned: totalCompleted >= 5,
    },
    {
      id: 'quiz',
      Icon: Target,
      label: 'Quiz master',
      desc: '10 perfect scores',
      iconBg: 'from-blue-400 to-cyan-400',
      earned: perfectQuizCount >= 3,
    },
    {
      id: 'diver',
      Icon: BookOpen,
      label: 'Deep diver',
      desc: 'Finish a course',
      iconBg: 'from-violet-400 to-pink-400',
      earned: anyCourseDone,
      progress: anyCourseDone ? null : (overallPct > 0 ? Math.min(overallPct, 80) : null),
    },
    {
      id: 'finetune',
      Icon: Award,
      label: 'First fine-tune',
      desc: 'Complete any module',
      iconBg: 'from-teal-400 to-emerald-400',
      earned: false,
      progress: Math.min(overallPct, 40) || null,
    },
  ] as const

  const earnedCount = achievements.filter((a) => a.earned).length

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(600px_300px_at_10%_0%,rgba(139,92,246,0.22),transparent_60%),radial-gradient(500px_280px_at_90%_100%,rgba(34,211,238,0.18),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-11 py-10">
        <div className="relative z-10 max-w-[620px]">
          {lessonsAway > 0 ? (
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.025em]">
              You&apos;re{' '}
              <span className="text-orange-400">{lessonsAway} lesson{lessonsAway !== 1 ? 's' : ''}</span>{' '}
              <span className="grad-text">away from</span>
              <br />leveling up.
            </h1>
          ) : (
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.025em]">
              Welcome back,{' '}
              <span className="grad-text">{(user.email ?? 'there').split('@')[0]}</span>.
              <br />All caught up!
            </h1>
          )}

          <div className="my-5 flex flex-wrap gap-5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> 18 min today</span>
            <span className="inline-flex items-center gap-1.5"><Flame size={14} /> 7-day streak</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> +120 XP today</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {resumeLesson && (
              <Link
                href={resumeLesson.href}
                className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
              >
                <Play size={13} fill="currentColor" />
                Resume &ldquo;{resumeLesson.title.length > 28
                  ? resumeLesson.title.slice(0, 26) + '…'
                  : resumeLesson.title}&rdquo;
              </Link>
            )}
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-foreground transition-all hover:bg-white/[0.11]"
            >
              Browse catalog
            </Link>
          </div>
        </div>

        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -bottom-10 -right-10 -top-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-primary/45 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[220px] w-[220px] rounded-full bg-accent/35 blur-[40px]" />
          <div className="absolute right-[220px] top-[60px] h-[140px] w-[140px] rounded-full bg-pink-400/30 blur-[40px]" />
        </div>
      </section>

      {/* ── Cohorts ──────────────────────────────────────────────── */}
      {enrollments.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-12 text-center">
          <Trophy size={36} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No cohorts yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse the catalog to join your team&apos;s AI course.</p>
          <Link href="/catalog" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Browse catalog <ChevronRight size={14} />
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold tracking-tight">Your cohorts</h2>
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
              const badge = statusBadge(pct)
              const days = daysLeft(cohort.ends_at)
              const firstUnfinished = courseLessons.find((l) => !completedLessonIds.has(l.id)) ?? courseLessons[0]
              const resumeHref = firstUnfinished
                ? `/dashboard/lesson/${firstUnfinished.id}`
                : `/catalog/${cohort.course_id}`

              return (
                <div
                  key={enrollment.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                >
                  {/* Gradient thumbnail */}
                  <div
                    className="relative grid aspect-[16/7] place-items-center overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.30),transparent_55%)]" />
                    <span className="font-mono text-[52px] font-semibold text-white/90 drop-shadow-[0_0_24px_rgba(0,0,0,0.4)]">
                      {hue.symbol}
                    </span>
                    <span className={`absolute right-2.5 top-2.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-md ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <div className="text-[14.5px] font-bold tracking-tight leading-snug">
                        {cohort.courses?.title ?? cohort.title}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {totalLessons} lessons
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Ring pct={pct} size={52} stroke={5}>
                        <span className="text-[11px] font-bold">{pct}%</span>
                      </Ring>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold">{completedCount}/{totalLessons}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {days !== null ? `${days} days left` : 'No deadline'}
                        </div>
                      </div>
                      <Link
                        href={resumeHref}
                        className="grid h-9 w-9 place-items-center rounded-[10px] border border-primary/30 bg-primary/15 text-primary transition-all hover:border-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]"
                        aria-label="Resume course"
                      >
                        <Play size={14} fill="currentColor" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Bottom row: Achievements + Leaderboard ─────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">

        {/* Achievements */}
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-tight">Achievements</h2>
            <span className="text-[12px] text-muted-foreground">
              {earnedCount} of {achievements.length} earned
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievements.map((a) => {
              const AchIcon = a.Icon
              return (
                <div
                  key={a.id}
                  className={[
                    'relative flex flex-col gap-2.5 rounded-xl border p-3.5 transition-all',
                    a.earned
                      ? 'border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]'
                      : 'border-border bg-secondary/20',
                  ].join(' ')}
                >
                  {/* Earned badge */}
                  {a.earned && (
                    <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.6)]">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}

                  <div className={`grid h-10 w-10 place-items-center rounded-[10px] bg-gradient-to-br ${a.earned ? a.iconBg : 'from-secondary to-muted'}`}>
                    <AchIcon
                      size={18}
                      className={a.earned ? 'text-white drop-shadow-sm' : 'text-muted-foreground'}
                    />
                  </div>

                  <div>
                    <div className={`text-[13px] font-semibold leading-tight ${a.earned ? '' : 'text-muted-foreground'}`}>
                      {a.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{a.desc}</div>
                  </div>

                  {/* Progress bar for locked achievements */}
                  {!a.earned && 'progress' in a && a.progress !== null && a.progress !== undefined && (
                    <div className="mt-auto h-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${a.progress}%` }}
                      />
                    </div>
                  )}
                  {!a.earned && (!('progress' in a) || a.progress === null || a.progress === undefined) && (
                    <Lock size={11} className="mt-auto text-muted-foreground/40" />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Cohort Leaderboard — adapted from 21st.dev compact-row pattern */}
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-tight">Cohort leaderboard</h2>
            <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              This week
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {leaderboard.map((entry) => {
              const isYou = 'isYou' in entry && entry.isYou
              return (
                <div
                  key={entry.name}
                  className={[
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                    isYou
                      ? 'bg-primary/[0.08] ring-1 ring-primary/20'
                      : 'hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  {/* Rank */}
                  <span className={`w-4 flex-shrink-0 text-center font-mono text-[12px] font-bold ${entry.rank <= 3 ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {entry.rank}
                  </span>

                  {/* Avatar */}
                  <div
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    style={{ background: entry.color }}
                  >
                    {entry.initials}
                  </div>

                  {/* Name */}
                  <span className="flex-1 text-[13px] font-medium leading-none">
                    {entry.name}
                    {isYou && (
                      <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">
                        YOU
                      </span>
                    )}
                  </span>

                  {/* Progress bar + % — 21st.dev pattern: colored bar matching avatar */}
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[88px] overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${entry.pct}%`,
                          background: entry.color,
                          boxShadow: `0 0 6px ${entry.color}88`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {entry.pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
