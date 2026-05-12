// app/dashboard/team/page.tsx
// All data sourced from Supabase under RLS:
//   - profiles (own + cohort-mates) for member roster
//   - enrollments (cohort-mate-readable) for who's in the cohort
//   - cohorts for active cohort schedule (start/end dates from real rows)
// Peer lesson_progress is RLS-blocked, so no peer progress %s here.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Users, Building2, Sparkles, ChevronRight, Calendar, BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'
import { getLearnerStats } from '@/lib/learner-stats'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string
  org_id: string | null
  role: string
  organizations: { name: string; slug: string } | null
}

type EnrollmentJoined = {
  user_id: string
  enrolled_at: string
  cohort_id: string
  cohorts: Pick<
    Database['public']['Tables']['cohorts']['Row'],
    'id' | 'title' | 'starts_at' | 'ends_at' | 'status' | 'course_id'
  > & {
    courses: Pick<
      Database['public']['Tables']['courses']['Row'],
      'id' | 'title'
    > | null
  }
}

const PEER_COLORS = ['#7C3AED', '#22D3EE', '#F472B6', '#34D399', '#FBBF24', '#FB7185', '#60A5FA', '#FB923C', '#A78BFA', '#10B981']
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PEER_COLORS[h % PEER_COLORS.length]
}

function initialsOf(name: string | null, email: string): string {
  const src = (name && name.trim()) || email.split('@')[0]
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function relativeDays(iso: string): string {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  if (d === 0) return 'Joined today'
  if (d === 1) return 'Joined yesterday'
  if (d < 7) return `Joined ${d}d ago`
  if (d < 30) return `Joined ${Math.floor(d / 7)}w ago`
  return `Joined ${Math.floor(d / 30)}mo ago`
}

function formatCohortDates(start: string, end: string | null): string {
  const s = new Date(start)
  const sFmt = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!end) return `Starts ${sFmt}`
  const e = new Date(end)
  const eFmt = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sFmt} → ${eFmt}`
}

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Own profile + own learner stats. We fetch enrollments without an embed
  // because PostgREST resolves `enrollments → cohorts(...)` as ambiguous in
  // this schema (returns 300 Multiple Choices). Explicit per-table fetches
  // follow.
  const [profileResult, stats, ownEnrollmentsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, org_id, role')
      .eq('id', user.id)
      .maybeSingle(),
    getLearnerStats(supabase, user.id),
    supabase
      .from('enrollments')
      .select('user_id, enrolled_at, cohort_id')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ])

  const baseProfile = profileResult.data as { id: string; full_name: string | null; email: string; org_id: string | null; role: string } | null

  // Pull the user's organization (if any) explicitly. Returns null when
  // org_id is null OR when RLS hides the row.
  let ownOrg: { name: string; slug: string } | null = null
  if (baseProfile?.org_id) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, slug')
      .eq('id', baseProfile.org_id)
      .maybeSingle<{ name: string; slug: string }>()
    ownOrg = orgData ? { name: orgData.name, slug: orgData.slug } : null
  }

  const profile: ProfileRow | null = baseProfile
    ? { ...baseProfile, organizations: ownOrg }
    : null
  const orgName = profile?.organizations?.name ?? 'Your Cohort'

  type RawEnrollmentRow = { user_id: string; enrolled_at: string; cohort_id: string }
  const ownEnrollmentsRaw = (ownEnrollmentsResult.data ?? []) as RawEnrollmentRow[]
  if (ownEnrollmentsResult.error) {
    const e = ownEnrollmentsResult.error as {
      message?: string; code?: string; details?: string; hint?: string
    }
    console.error('[team] own enrollments query failed:', {
      message: e.message, code: e.code, details: e.details, hint: e.hint,
    })
  }
  const userCohortIds = ownEnrollmentsRaw.map((e) => e.cohort_id)

  // Fetch the cohorts + their courses explicitly.
  type CohortRowMin = {
    id: string
    title: string
    starts_at: string
    ends_at: string | null
    status: string
    course_id: string
  }
  type CourseRowMin = { id: string; title: string }
  const cohortMap = new Map<string, CohortRowMin>()
  const courseMap = new Map<string, CourseRowMin>()
  if (userCohortIds.length > 0) {
    const { data: rawCohorts } = await supabase
      .from('cohorts')
      .select('id, title, starts_at, ends_at, status, course_id')
      .in('id', userCohortIds)
    for (const c of (rawCohorts ?? []) as CohortRowMin[]) cohortMap.set(c.id, c)

    const courseIds = Array.from(
      new Set(Array.from(cohortMap.values()).map((c) => c.course_id).filter(Boolean)),
    )
    if (courseIds.length > 0) {
      const { data: rawCourses } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds)
      for (const c of (rawCourses ?? []) as CourseRowMin[]) courseMap.set(c.id, c)
    }
  }

  // Hydrate own enrollments into the EnrollmentJoined shape downstream code
  // expects.
  const hydrate = (e: RawEnrollmentRow): EnrollmentJoined | null => {
    const cohort = cohortMap.get(e.cohort_id)
    if (!cohort) return null
    const course = courseMap.get(cohort.course_id) ?? null
    return {
      user_id: e.user_id,
      enrolled_at: e.enrolled_at,
      cohort_id: e.cohort_id,
      cohorts: {
        id: cohort.id,
        title: cohort.title,
        starts_at: cohort.starts_at,
        ends_at: cohort.ends_at,
        status: cohort.status,
        course_id: cohort.course_id,
        courses: course,
      },
    }
  }

  const ownEnrollments: EnrollmentJoined[] = ownEnrollmentsRaw
    .map(hydrate)
    .filter((e): e is EnrollmentJoined => e !== null)

  // Cohort-mate enrollments (RLS allows for shared cohorts).
  let peerEnrollments: EnrollmentJoined[] = []
  if (userCohortIds.length > 0) {
    const { data: peerData } = await supabase
      .from('enrollments')
      .select('user_id, enrolled_at, cohort_id')
      .in('cohort_id', userCohortIds)
      .order('enrolled_at', { ascending: true })
    peerEnrollments = ((peerData ?? []) as RawEnrollmentRow[])
      .map(hydrate)
      .filter((e): e is EnrollmentJoined => e !== null)
  }

  // Group enrollments by user → primary cohort = most recent enrollment
  const userToEnrollment = new Map<string, EnrollmentJoined>()
  for (const e of peerEnrollments) {
    const existing = userToEnrollment.get(e.user_id)
    if (!existing || e.enrolled_at > existing.enrolled_at) {
      userToEnrollment.set(e.user_id, e)
    }
  }

  // Profiles for everyone in cohorts (RLS allows)
  const peerUserIds = [...userToEnrollment.keys()]
  type RosterMember = {
    id: string
    name: string
    email: string
    role: string
    initials: string
    color: string
    enrolledAt: string
    cohortTitle: string
    courseTitle: string | null
    isYou: boolean
  }

  let roster: RosterMember[] = []
  if (peerUserIds.length > 0) {
    const { data: peerProfilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', peerUserIds)

    type PeerProfile = { id: string; full_name: string | null; email: string; role: string }
    const peerProfiles = (peerProfilesData ?? []) as PeerProfile[]

    roster = peerProfiles.map((p) => {
      const e = userToEnrollment.get(p.id)!
      return {
        id: p.id,
        name: p.full_name ?? p.email.split('@')[0],
        email: p.email,
        role: p.role,
        initials: initialsOf(p.full_name, p.email),
        color: colorFor(p.id),
        enrolledAt: e.enrolled_at,
        cohortTitle: e.cohorts.title,
        courseTitle: e.cohorts.courses?.title ?? null,
        isYou: p.id === user.id,
      }
    })

    // Sort: you first, then by enrollment date desc
    roster.sort((a, b) => {
      if (a.isYou && !b.isYou) return -1
      if (!a.isYou && b.isYou) return 1
      return b.enrolledAt.localeCompare(a.enrolledAt)
    })
  }

  // Aggregate stats
  const totalMembers = roster.length
  const newThisWeek = roster.filter((m) => {
    const d = (Date.now() - new Date(m.enrolledAt).getTime()) / 86_400_000
    return d <= 7
  }).length

  // All cohorts the user is in (with full schedule)
  const cohortSchedule = ownEnrollments
    .map((e) => e.cohorts)
    .filter((c): c is EnrollmentJoined['cohorts'] => Boolean(c))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(700px_320px_at_15%_0%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(500px_280px_at_92%_100%,rgba(139,92,246,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-11 py-9">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_rgba(139,92,246,0.45)]">
              <Building2 size={26} className="text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
                <Users size={12} /> Cohort
              </div>
              <h1 className="my-2 text-[34px] font-bold leading-[1.08] tracking-[-0.02em]">{orgName}</h1>
              <p className="text-[14px] text-muted-foreground">
                {totalMembers > 0
                  ? `${totalMembers} learner${totalMembers !== 1 ? 's' : ''} sharing your cohort schedule`
                  : 'Join a cohort to see your teammates here'}
              </p>
            </div>
          </div>

          {/* Stat tiles — every value is real */}
          {totalMembers > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Members', value: totalMembers, hue: 'text-cyan-400' },
                { label: 'New this week', value: newThisWeek, hue: 'text-emerald-400' },
                { label: 'Your streak', value: `${stats.currentStreakDays}d`, hue: 'text-orange-400' },
                { label: 'Your XP', value: stats.xp.toLocaleString(), hue: 'text-primary' },
              ].map(({ label, value, hue }) => (
                <div key={label} className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
                  <div className={`text-[10.5px] uppercase tracking-[0.07em] ${hue}`}>{label}</div>
                  <div className="mt-1 font-mono text-[20px] font-bold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute -bottom-10 -right-10 -top-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-accent/35 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[220px] w-[220px] rounded-full bg-primary/40 blur-[40px]" />
        </div>
      </section>

      {/* ── Two-col: Members + Schedule ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* Team members */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold tracking-tight">Cohort members</h2>
            <span className="text-[12px] text-muted-foreground">{roster.length} total</span>
          </div>

          {roster.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-12 text-center">
              <Users size={32} className="text-muted-foreground/40" />
              <div>
                <div className="text-[14px] font-semibold">You&apos;re not in a cohort yet</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">
                  Join a cohort from the catalog to meet your team.
                </div>
              </div>
              <Link
                href="/catalog"
                className="mt-2 inline-flex items-center gap-1 rounded-[10px] border border-border bg-card px-4 py-2 text-[12.5px] font-semibold hover:bg-secondary"
              >
                Browse catalog <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {roster.map((m) => (
                <div
                  key={m.id}
                  className={[
                    'flex flex-col gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5',
                    m.isYou
                      ? 'border-primary/30 bg-gradient-to-br from-primary/[0.10] to-accent/[0.04] ring-1 ring-primary/20'
                      : 'border-border bg-card hover:border-white/15',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                      style={{ background: m.color }}
                    >
                      {m.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold">{m.name}</span>
                        {m.isYou && (
                          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">YOU</span>
                        )}
                      </div>
                      <div className="text-[11.5px] capitalize text-muted-foreground">{m.role}</div>
                    </div>
                    <span className="text-[10.5px] tabular-nums text-muted-foreground/70 whitespace-nowrap">
                      {relativeDays(m.enrolledAt)}
                    </span>
                  </div>

                  <div className="rounded-[10px] border border-border bg-secondary/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">In cohort</div>
                    <div className="mt-0.5 truncate text-[12.5px] font-medium">
                      {m.courseTitle ?? m.cohortTitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Cohort schedule (real cohort start/end dates only) */}
        <aside className="flex flex-col gap-4">
          <h2 className="text-[15px] font-bold tracking-tight">Cohort schedule</h2>

          {cohortSchedule.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-center text-[13px] text-muted-foreground">
              No cohort schedule yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {cohortSchedule.map((c) => {
                const start = new Date(c.starts_at)
                const isUpcoming = start.getTime() > Date.now()
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-primary/20 to-accent/15 ring-1 ring-primary/30">
                        <Calendar size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                            {isUpcoming ? 'Upcoming' : c.status}
                          </span>
                        </div>
                        <div className="text-[13.5px] font-semibold leading-snug">{c.title}</div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {formatCohortDates(c.starts_at, c.ends_at)}
                        </div>
                        {c.courses?.title && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                            <BookOpen size={9} /> {c.courses.title}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Trust strip — generic, no fake names */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] to-accent/[0.04] p-4 text-[11.5px] leading-relaxed text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <Sparkles size={13} className="text-primary" />
              <span className="font-semibold">Cohort-based learning</span>
            </div>
            Everyone in your cohort follows the same schedule. Progress at your own pace; check back to see who&apos;s shipped.
          </div>
        </aside>
      </div>
    </main>
  )
}
