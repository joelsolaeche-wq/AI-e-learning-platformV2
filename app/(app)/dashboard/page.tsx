// app/dashboard/page.tsx
// All metrics derive from real Supabase rows the user can read under RLS:
//   - lesson_progress / quiz_attempts → personal stats (via getLearnerStats)
//   - enrollments + cohorts + courses → cohort cards (real)
//   - cohort-mate enrollments + profiles → roster (RLS allows for shared cohorts)
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Clock, Flame, Sparkles, Play, ChevronRight, Trophy,
  Zap, Target, BookOpen, Award, Lock, Users,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { getLearnerStats } from '@/lib/learner-stats'
import { JoinByCodeForm } from '@/components/JoinByCodeForm'
import { CohortCard } from '@/components/cohorts/CohortCard'
import { CompanyCard } from '@/components/companies/CompanyCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnrollmentWithCohort = Pick<
  Database['public']['Tables']['enrollments']['Row'],
  'id' | 'cohort_id' | 'enrolled_at' | 'status'
> & {
  // company_id (added in 20260506000001) and image_url (added in 20260509000002)
  // are not yet in the regenerated database.types.ts — declare the cohort
  // shape inline.
  cohorts:
    | {
        id: string
        title: string
        status: string
        starts_at: string
        ends_at: string | null
        course_id: string
        company_id: string | null
        image_url: string | null
        courses: Pick<
          Database['public']['Tables']['courses']['Row'],
          'id' | 'title' | 'slug'
        > | null
        organizations: {
          id: string
          name: string
          logo_url: string | null
        } | null
      }
    | null
}

type LessonRowMin = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'module_id' | 'title'
>

type PeerEnrollmentRow = { user_id: string; enrolled_at: string; cohort_id: string }
type PeerProfileRow = { id: string; full_name: string | null; email: string; role: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Deterministic avatar color from user id (used by the cohort roster only;
// cohort/company cards use their own palettes inside CohortCard/CompanyCard).
const PEER_COLORS = ['#7C3AED', '#22D3EE', '#F472B6', '#34D399', '#FBBF24', '#FB7185', '#60A5FA', '#FB923C']
function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PEER_COLORS[h % PEER_COLORS.length]
}

function relativeDays(iso: string): string {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

function initialsOf(name: string | null, email: string): string {
  const src = (name && name.trim()) || email.split('@')[0]
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Parallel: enrollments + own profile + learner stats (own only, by RLS)
  const [enrollmentsResult, ownProfileResult, stats] = await Promise.all([
    supabase
      .from('enrollments')
      .select(`id, cohort_id, enrolled_at, status,
               cohorts ( id, title, status, starts_at, ends_at, course_id, company_id, image_url,
                 courses ( id, title, slug ),
                 organizations ( id, name, logo_url ) )`)
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .maybeSingle(),
    getLearnerStats(supabase, user.id),
  ])

  if (enrollmentsResult.error) {
    // Surface PostgREST schema-cache or RLS issues that would otherwise
    // silently empty the cohort grid.
    console.error('[dashboard] enrollments query failed', enrollmentsResult.error)
  }
  const enrollments: EnrollmentWithCohort[] =
    (enrollmentsResult.data as EnrollmentWithCohort[] | null) ?? []
  const ownProfile = ownProfileResult.data as PeerProfileRow | null

  // Build lessonsByCourse for cohort-card percentages + Resume button
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

  // Completed lesson set (from getLearnerStats already pulls progress, but we
  // need lesson_id specifically for cohort cards + resume; pull again briefly)
  const { data: completedRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('completed', true)
  const completedLessonIds = new Set<string>(
    ((completedRows ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id),
  )

  // First incomplete lesson → Resume button
  let resumeLesson: { href: string; title: string } | null = null
  for (const enrollment of enrollments) {
    const courseId = enrollment.cohorts?.course_id
    if (!courseId) continue
    const next = (lessonsByCourse.get(courseId) ?? []).find((l) => !completedLessonIds.has(l.id))
    if (next) { resumeLesson = { href: `/dashboard/lesson/${next.id}`, title: next.title }; break }
  }

  // Cohort roster — real cohort-mates from RLS-allowed reads
  const userCohortIds = enrollments.map((e) => e.cohort_id)
  let cohortRoster: Array<{
    id: string
    name: string
    email: string
    role: string
    initials: string
    color: string
    enrolled_at: string
    isYou: boolean
  }> = []

  if (userCohortIds.length > 0) {
    const { data: peerEnrollmentsData } = await supabase
      .from('enrollments')
      .select('user_id, enrolled_at, cohort_id')
      .in('cohort_id', userCohortIds)
      .order('enrolled_at', { ascending: false })

    const peerEnrollments = (peerEnrollmentsData ?? []) as PeerEnrollmentRow[]

    // Most-recent enrollment per user
    const earliestByUser = new Map<string, string>()
    for (const e of peerEnrollments) {
      const existing = earliestByUser.get(e.user_id)
      if (!existing || e.enrolled_at > existing) earliestByUser.set(e.user_id, e.enrolled_at)
    }

    const peerUserIds = [...earliestByUser.keys()]
    if (peerUserIds.length > 0) {
      const { data: peerProfilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', peerUserIds)

      const peerProfiles = (peerProfilesData ?? []) as PeerProfileRow[]
      cohortRoster = peerProfiles
        .map((p) => ({
          id: p.id,
          name: p.full_name ?? p.email.split('@')[0],
          email: p.email,
          role: p.role,
          initials: initialsOf(p.full_name, p.email),
          color: colorFor(p.id),
          enrolled_at: earliestByUser.get(p.id) ?? new Date().toISOString(),
          isYou: p.id === user.id,
        }))
        .sort((a, b) => b.enrolled_at.localeCompare(a.enrolled_at))
    }
  }

  // Achievements — all derived from real data
  const anyCourseDone = [...lessonsByCourse.entries()].some(([courseId]) => {
    const lessons = lessonsByCourse.get(courseId) ?? []
    return lessons.length > 0 && lessons.every((l) => completedLessonIds.has(l.id))
  })

  const achievements = [
    { id: 'streak',  Icon: Flame,    label: '7-day streak',    desc: 'Earned today',          iconBg: 'from-orange-400 to-rose-500',   earned: stats.currentStreakDays >= 7 },
    { id: 'speed',   Icon: Zap,      label: 'Speed runner',    desc: '5 lessons in a day',    iconBg: 'from-yellow-400 to-orange-400', earned: stats.maxLessonsInOneDay >= 5 },
    { id: 'quiz',    Icon: Target,   label: 'Quiz master',     desc: '10 perfect scores',     iconBg: 'from-blue-400 to-cyan-400',     earned: stats.perfectQuizzes >= 10 },
    { id: 'diver',   Icon: BookOpen, label: 'Deep diver',      desc: 'Finish a course',       iconBg: 'from-violet-400 to-pink-400',   earned: anyCourseDone },
    { id: 'first',   Icon: Award,    label: 'First steps',     desc: 'Complete a lesson',     iconBg: 'from-teal-400 to-emerald-400',  earned: stats.totalLessonsCompleted >= 1 },
  ]
  const earnedCount = achievements.filter((a) => a.earned).length

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(600px_300px_at_10%_0%,rgba(139,92,246,0.22),transparent_60%),radial-gradient(500px_280px_at_90%_100%,rgba(34,211,238,0.18),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-11 py-10">
        <div className="relative z-10 max-w-[620px]">
          {stats.totalLessonsCompleted === 0 ? (
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.025em]">
              Welcome,{' '}
              <span className="grad-text">{(ownProfile?.full_name ?? user.email ?? 'there').split('@')[0]}</span>.
              <br />Start your first lesson.
            </h1>
          ) : (
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.025em]">
              You&apos;re{' '}
              <span className="text-orange-400">
                {stats.lessonsAwayFromLevelUp} lesson{stats.lessonsAwayFromLevelUp !== 1 ? 's' : ''}
              </span>{' '}
              <span className="grad-text">away from</span>
              <br />level {stats.level + 1}.
            </h1>
          )}

          <div className="my-5 flex flex-wrap gap-5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              {stats.todayMinutesWatched > 0 ? `${stats.todayMinutesWatched} min today` : 'No activity yet today'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame size={14} />
              {stats.currentStreakDays > 0
                ? `${stats.currentStreakDays}-day streak`
                : 'No streak yet'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={14} />
              {stats.todayXPEarned > 0 ? `+${stats.todayXPEarned} XP today` : `${stats.xp.toLocaleString()} XP total`}
            </span>
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
          <p className="mt-1 text-sm text-muted-foreground">
            Join with an invitation code from your team, or browse the catalog.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <JoinByCodeForm />
            <Link href="/catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Browse catalog <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Companies tier — only when learner spans multiple companies */}
          {(() => {
            const byCompany = new Map<string, { id: string; name: string; logo_url: string | null; cohortCount: number }>()
            for (const e of enrollments) {
              const org = e.cohorts?.organizations
              if (!org) continue
              const existing = byCompany.get(org.id)
              if (existing) existing.cohortCount += 1
              else byCompany.set(org.id, { id: org.id, name: org.name, logo_url: org.logo_url, cohortCount: 1 })
            }
            const companies = Array.from(byCompany.values())
            if (companies.length <= 1) return null
            return (
              <section className="flex flex-col gap-3">
                <h2 className="text-[16px] font-bold tracking-tight">Your companies</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {companies.map((c) => (
                    <CompanyCard
                      key={c.id}
                      company={{ id: c.id, name: c.name, logo_url: c.logo_url }}
                      cohortCount={c.cohortCount}
                      href={`/dashboard/team`}
                    />
                  ))}
                </div>
              </section>
            )
          })()}

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[18px] font-bold tracking-tight">Your cohorts</h2>
              <div className="flex items-center gap-3">
                <JoinByCodeForm />
                <Link href="/catalog" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
                  View all <ChevronRight size={14} />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => {
                const cohort = enrollment.cohorts
                if (!cohort) return null
                const courseLessons = lessonsByCourse.get(cohort.course_id) ?? []
                const totalLessons = courseLessons.length
                const completedCount = courseLessons.filter((l) => completedLessonIds.has(l.id)).length
                const firstUnfinished = courseLessons.find((l) => !completedLessonIds.has(l.id)) ?? courseLessons[0]
                const resumeHref = firstUnfinished
                  ? `/dashboard/lesson/${firstUnfinished.id}`
                  : `/catalog/${cohort.course_id}`
                const isNew = Date.now() - new Date(enrollment.enrolled_at).getTime() < 48 * 60 * 60 * 1000

                return (
                  <CohortCard
                    key={enrollment.id}
                    variant="learner"
                    cohort={{
                      id: cohort.id,
                      title: cohort.courses?.title ?? cohort.title,
                      status: cohort.status,
                      starts_at: cohort.starts_at,
                      ends_at: cohort.ends_at,
                      image_url: cohort.image_url,
                    }}
                    subtitle={`${totalLessons} lessons`}
                    progress={{ completed: completedCount, total: totalLessons }}
                    isNew={isNew}
                    primaryHref={resumeHref}
                  />
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* ── Bottom row: Achievements + Cohort roster ─────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">

        {/* Achievements (real-data only) */}
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-tight">Achievements</h2>
            <Link href="/dashboard/achievements" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              {earnedCount} of {achievements.length} earned <ChevronRight size={12} />
            </Link>
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
                  {a.earned && (
                    <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.6)]">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}

                  <div className={`grid h-10 w-10 place-items-center rounded-[10px] bg-gradient-to-br ${a.earned ? a.iconBg : 'from-secondary to-muted'}`}>
                    <AchIcon size={18} className={a.earned ? 'text-white drop-shadow-sm' : 'text-muted-foreground'} />
                  </div>

                  <div>
                    <div className={`text-[13px] font-semibold leading-tight ${a.earned ? '' : 'text-muted-foreground'}`}>
                      {a.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{a.desc}</div>
                  </div>

                  {!a.earned && (
                    <Lock size={11} className="mt-auto text-muted-foreground/40" />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Cohort roster — real members only (no faked progress %) */}
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-tight">Cohort members</h2>
            <Link href="/dashboard/team" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              View team <ChevronRight size={12} />
            </Link>
          </div>

          {cohortRoster.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Users size={28} className="text-muted-foreground/40" />
              <div className="text-[13px] text-muted-foreground">
                Join a cohort to see your teammates here.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {cohortRoster.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className={[
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                    m.isYou
                      ? 'bg-primary/[0.08] ring-1 ring-primary/20'
                      : 'hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  <div
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    style={{ background: m.color }}
                  >
                    {m.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium leading-none">
                      <span className="truncate">{m.name}</span>
                      {m.isYou && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">YOU</span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-[11px] capitalize text-muted-foreground">{m.role}</div>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                    {relativeDays(m.enrolled_at)}
                  </span>
                </div>
              ))}
              {cohortRoster.length > 6 && (
                <Link
                  href="/dashboard/team"
                  className="mt-1 inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  +{cohortRoster.length - 6} more cohort members <ChevronRight size={12} />
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
