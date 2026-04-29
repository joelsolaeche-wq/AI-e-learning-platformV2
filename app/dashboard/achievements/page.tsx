// app/dashboard/achievements/page.tsx
// Every achievement state is derived from real Supabase rows:
//   - lesson_progress (count, dates, day grouping) → progression badges + streaks
//   - quiz_attempts (perfect-score count) → mastery badges
//   - enrollments (course / module completion) → builder badges
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ring } from '@/components/ui/Ring'
import {
  Trophy, Flame, Zap, Target, BookOpen, Award, Brain, Sparkles,
  Crown, Lock, Shield, Cpu, GitBranch, CheckCircle2, Clock,
} from 'lucide-react'
import { getLearnerStats, XP_PER_LESSON, XP_PER_PERFECT_QUIZ } from '@/lib/learner-stats'

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'
type Category = 'Learning' | 'Streak' | 'Mastery' | 'Builder' | 'Cohort'

interface Achievement {
  id: string
  Icon: React.ElementType
  label: string
  desc: string
  category: Category
  tier: Tier
  xp: number
  earned: boolean
  earnedAt?: string | null
  progress?: number          // 0-100
  progressLabel?: string
}

const TIER_STYLES: Record<Tier, { ring: string; glow: string; bg: string; chip: string; label: string }> = {
  bronze:   { ring: 'ring-amber-700/40', glow: 'shadow-[0_0_20px_rgba(180,83,9,0.25)]', bg: 'from-amber-700 to-orange-600', chip: 'bg-amber-700/15 text-amber-400 border-amber-700/40', label: 'Bronze' },
  silver:   { ring: 'ring-slate-300/40', glow: 'shadow-[0_0_20px_rgba(148,163,184,0.25)]', bg: 'from-slate-300 to-slate-500', chip: 'bg-slate-400/15 text-slate-300 border-slate-300/40', label: 'Silver' },
  gold:     { ring: 'ring-yellow-400/50', glow: 'shadow-[0_0_24px_rgba(250,204,21,0.30)]', bg: 'from-yellow-400 to-orange-400', chip: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40', label: 'Gold' },
  platinum: { ring: 'ring-violet-400/50', glow: 'shadow-[0_0_28px_rgba(167,139,250,0.40)]', bg: 'from-violet-400 to-cyan-400', chip: 'bg-primary/15 text-primary border-primary/40', label: 'Platinum' },
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pctOrNone(value: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

// Match courses by slug/title against AI-domain keywords
type CourseMatch = (slug: string, title: string) => boolean
function courseMatches(courseList: { slug: string; title: string }[], match: CourseMatch): boolean {
  return courseList.some((c) => match(c.slug.toLowerCase(), c.title.toLowerCase()))
}

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // All real queries
  const [stats, completedRowsResult, perfectFirstResult, enrollmentsResult] = await Promise.all([
    getLearnerStats(supabase, user.id),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('completed_at', { ascending: true })
      .limit(1),
    supabase
      .from('quiz_attempts')
      .select('score, max_score, submitted_at')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: true }),
    supabase
      .from('enrollments')
      .select(`id, enrolled_at, status, cohort_id,
               cohorts(course_id, courses(id, slug, title))`)
      .eq('user_id', user.id),
  ])

  type ProgressDateRow = { lesson_id: string; completed_at: string | null }
  const firstCompletion = ((completedRowsResult.data ?? []) as ProgressDateRow[])[0]?.completed_at ?? null

  type QuizDateRow = { score: number; max_score: number; submitted_at: string }
  const allQuizzes = (perfectFirstResult.data ?? []) as QuizDateRow[]
  const firstPerfect = allQuizzes.find((q) => q.max_score > 0 && q.score === q.max_score)?.submitted_at ?? null

  type EnrollmentJoined = {
    id: string
    enrolled_at: string
    status: string
    cohort_id: string
    cohorts: {
      course_id: string
      courses: { id: string; slug: string; title: string } | null
    } | null
  }
  const enrollments = (enrollmentsResult.data ?? []) as unknown as EnrollmentJoined[]
  const earliestEnrollment = enrollments
    .map((e) => e.enrolled_at)
    .sort()[0] ?? null
  const enrolledCourses = enrollments
    .map((e) => e.cohorts?.courses)
    .filter((c): c is { id: string; slug: string; title: string } => Boolean(c))

  // Determine which courses are 100% complete
  const courseIds = enrolledCourses.map((c) => c.id)
  const completedCourses: { slug: string; title: string }[] = []

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
        .select('id, module_id')
        .in('module_id', moduleIds)
      type LessonRow = { id: string; module_id: string }
      const lessonsByCourse = new Map<string, string[]>()
      for (const l of (lessonsData ?? []) as LessonRow[]) {
        const c = moduleToCourse.get(l.module_id)
        if (!c) continue
        const arr = lessonsByCourse.get(c) ?? []
        arr.push(l.id)
        lessonsByCourse.set(c, arr)
      }

      const { data: progressRows } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .eq('completed', true)
      const completedSet = new Set<string>(
        ((progressRows ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id),
      )

      for (const c of enrolledCourses) {
        const lessonIds = lessonsByCourse.get(c.id) ?? []
        if (lessonIds.length > 0 && lessonIds.every((id) => completedSet.has(id))) {
          completedCourses.push({ slug: c.slug, title: c.title })
        }
      }
    }
  }

  // AI-domain badge predicates — match against real course slugs/titles
  const completedRag = courseMatches(completedCourses, (s, t) =>
    s.includes('rag') || t.includes('rag') || t.includes('retrieval'))
  const completedAgents = courseMatches(completedCourses, (s, t) =>
    s.includes('agent') || t.includes('agent'))
  const completedFinetune = courseMatches(completedCourses, (s, t) =>
    s.includes('fine-tune') || s.includes('finetune') || t.includes('fine-tune') || t.includes('finetune'))

  // Build the achievements list — ALL fields derived from real data
  const achievements: Achievement[] = [
    // Learning milestones
    {
      id: 'first-prompt', Icon: Sparkles, category: 'Learning', tier: 'bronze',
      label: 'First Prompt', desc: 'Complete your first lesson', xp: 50,
      earned: stats.totalLessonsCompleted >= 1, earnedAt: firstCompletion,
    },
    {
      id: 'token-master', Icon: Cpu, category: 'Learning', tier: 'bronze',
      label: 'Token Master', desc: 'Complete 10 lessons', xp: 150,
      earned: stats.totalLessonsCompleted >= 10,
      progress: stats.totalLessonsCompleted >= 10 ? undefined : pctOrNone(stats.totalLessonsCompleted, 10),
      progressLabel: `${Math.min(stats.totalLessonsCompleted, 10)} / 10 lessons`,
    },
    {
      id: 'context-window', Icon: Brain, category: 'Learning', tier: 'silver',
      label: 'Context Window', desc: 'Complete 50 lessons', xp: 400,
      earned: stats.totalLessonsCompleted >= 50,
      progress: stats.totalLessonsCompleted >= 50 ? undefined : pctOrNone(stats.totalLessonsCompleted, 50),
      progressLabel: `${Math.min(stats.totalLessonsCompleted, 50)} / 50 lessons`,
    },
    {
      id: 'long-context', Icon: Award, category: 'Learning', tier: 'gold',
      label: '100k Context', desc: 'Complete 100 lessons', xp: 1000,
      earned: stats.totalLessonsCompleted >= 100,
      progress: stats.totalLessonsCompleted >= 100 ? undefined : pctOrNone(stats.totalLessonsCompleted, 100),
      progressLabel: `${Math.min(stats.totalLessonsCompleted, 100)} / 100 lessons`,
    },

    // Streaks (computed from real activity dates)
    {
      id: 'streak-7', Icon: Flame, category: 'Streak', tier: 'bronze',
      label: '7-Day Streak', desc: 'Learn 7 days in a row', xp: 100,
      earned: stats.currentStreakDays >= 7 || stats.longestStreakDays >= 7,
      progress: (stats.currentStreakDays >= 7 || stats.longestStreakDays >= 7)
        ? undefined : pctOrNone(Math.max(stats.currentStreakDays, stats.longestStreakDays), 7),
      progressLabel: `${Math.max(stats.currentStreakDays, stats.longestStreakDays)} / 7 days`,
    },
    {
      id: 'streak-30', Icon: Flame, category: 'Streak', tier: 'gold',
      label: 'Marathon', desc: 'Learn 30 days in a row', xp: 750,
      earned: stats.longestStreakDays >= 30,
      progress: stats.longestStreakDays >= 30
        ? undefined : pctOrNone(stats.longestStreakDays, 30),
      progressLabel: `${stats.longestStreakDays} / 30 days`,
    },
    {
      id: 'speed-runner', Icon: Zap, category: 'Streak', tier: 'silver',
      label: 'Speed Runner', desc: '5 lessons in a single day', xp: 200,
      earned: stats.maxLessonsInOneDay >= 5,
      progress: stats.maxLessonsInOneDay >= 5
        ? undefined : pctOrNone(stats.maxLessonsInOneDay, 5),
      progressLabel: `Best day: ${stats.maxLessonsInOneDay} lesson${stats.maxLessonsInOneDay !== 1 ? 's' : ''}`,
    },

    // Mastery
    {
      id: 'first-perfect', Icon: Target, category: 'Mastery', tier: 'bronze',
      label: 'Perfect Score', desc: 'Ace your first quiz', xp: 75,
      earned: stats.perfectQuizzes >= 1, earnedAt: firstPerfect,
    },
    {
      id: 'quiz-master', Icon: Crown, category: 'Mastery', tier: 'silver',
      label: 'Quiz Master', desc: '10 perfect quiz scores', xp: 350,
      earned: stats.perfectQuizzes >= 10,
      progress: stats.perfectQuizzes >= 10 ? undefined : pctOrNone(stats.perfectQuizzes, 10),
      progressLabel: `${stats.perfectQuizzes} / 10 perfect`,
    },

    // Builder (matched against real completed-course slugs)
    {
      id: 'rag-architect', Icon: GitBranch, category: 'Builder', tier: 'gold',
      label: 'RAG Architect', desc: 'Finish a RAG / retrieval course', xp: 600,
      earned: completedRag,
      progressLabel: completedRag ? undefined : 'Complete a RAG course to unlock',
    },
    {
      id: 'agent-engineer', Icon: Cpu, category: 'Builder', tier: 'gold',
      label: 'Agent Engineer', desc: 'Finish an agentic-workflow course', xp: 600,
      earned: completedAgents,
      progressLabel: completedAgents ? undefined : 'Complete an agents course to unlock',
    },
    {
      id: 'fine-tuner', Icon: Shield, category: 'Builder', tier: 'platinum',
      label: 'Fine-Tuner', desc: 'Complete a fine-tuning course', xp: 1500,
      earned: completedFinetune,
      progressLabel: completedFinetune ? undefined : 'Complete a fine-tuning course to unlock',
    },

    // Cohort
    {
      id: 'cohort-joined', Icon: BookOpen, category: 'Cohort', tier: 'bronze',
      label: 'Cohort Member', desc: 'Join your first cohort', xp: 50,
      earned: enrollments.length >= 1, earnedAt: earliestEnrollment,
    },
    {
      id: 'multi-cohort', Icon: Trophy, category: 'Cohort', tier: 'silver',
      label: 'Multi-Cohort', desc: 'Enroll in 2 or more cohorts', xp: 200,
      earned: enrollments.length >= 2,
      progress: enrollments.length >= 2 ? undefined : pctOrNone(enrollments.length, 2),
      progressLabel: `${enrollments.length} / 2 cohorts joined`,
    },
    {
      id: 'foundation', Icon: CheckCircle2, category: 'Cohort', tier: 'gold',
      label: 'Foundation Builder', desc: 'Finish any course end-to-end', xp: 500,
      earned: completedCourses.length >= 1,
      progressLabel: completedCourses.length >= 1
        ? `${completedCourses.length} course${completedCourses.length !== 1 ? 's' : ''} completed`
        : 'Finish a course to unlock',
    },
  ]

  const earnedCount = achievements.filter((a) => a.earned).length
  const totalXP = achievements.filter((a) => a.earned).reduce((s, a) => s + a.xp, 0)
  const overallPct = Math.floor((earnedCount / achievements.length) * 100)

  const categories: Category[] = ['Learning', 'Streak', 'Mastery', 'Builder', 'Cohort']
  const grouped = categories.map((cat) => ({
    category: cat,
    items: achievements.filter((a) => a.category === cat),
  }))

  // Recently unlocked (real timestamps only)
  const recentUnlocks = achievements
    .filter((a) => a.earned && a.earnedAt)
    .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''))
    .slice(0, 4)

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(700px_320px_at_15%_0%,rgba(250,204,21,0.18),transparent_60%),radial-gradient(500px_280px_at_92%_100%,rgba(139,92,246,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-11 py-9">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[560px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-yellow-300">
              <Trophy size={12} /> Achievements
            </div>
            <h1 className="my-3 text-[36px] font-bold leading-[1.08] tracking-[-0.02em]">
              <span className="grad-text">{earnedCount}</span> of {achievements.length} unlocked.
              <br />Keep shipping.
            </h1>
            <p className="text-[14px] text-muted-foreground max-w-[480px]">
              Earn badges for completing lessons, mastering quizzes, and finishing AI courses end-to-end.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Ring pct={overallPct} size={108} stroke={9}>
              <div className="text-center">
                <div className="text-[22px] font-bold leading-none">{overallPct}%</div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">complete</div>
              </div>
            </Ring>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">XP from badges</div>
                <div className="mt-0.5 font-mono text-[22px] font-bold tabular-nums grad-text">{totalXP.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Lessons</div>
                <div className="mt-0.5 font-mono text-[22px] font-bold tabular-nums">{stats.totalLessonsCompleted}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-10 -right-10 -top-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-yellow-400/30 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[220px] w-[220px] rounded-full bg-primary/40 blur-[40px]" />
        </div>
      </section>

      {/* ── Recent unlocks (real earnedAt timestamps only) ───────── */}
      {recentUnlocks.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Recently unlocked</h2>
          <div className="flex flex-wrap gap-3">
            {recentUnlocks.map((a) => {
              const tier = TIER_STYLES[a.tier]
              const Icon = a.Icon
              return (
                <div key={a.id} className={`flex items-center gap-3 rounded-xl border border-white/10 bg-card px-4 py-3 ring-1 ${tier.ring}`}>
                  <div className={`grid h-10 w-10 place-items-center rounded-[10px] bg-gradient-to-br ${tier.bg} ${tier.glow}`}>
                    <Icon size={18} className="text-white drop-shadow" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{a.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.earnedAt ? fmtDate(a.earnedAt) : 'Earned'} · +{a.xp} XP
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── By category ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-8">
        {grouped.map(({ category, items }) => {
          const earned = items.filter((i) => i.earned).length
          return (
            <section key={category} className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[18px] font-bold tracking-tight">{category}</h2>
                <span className="text-[12px] text-muted-foreground">{earned} of {items.length} earned</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((a) => {
                  const tier = TIER_STYLES[a.tier]
                  const Icon = a.Icon
                  return (
                    <div
                      key={a.id}
                      className={[
                        'group relative flex flex-col gap-3 rounded-2xl border p-5 transition-all',
                        a.earned
                          ? `border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] hover:-translate-y-0.5 hover:border-white/20 ring-1 ${tier.ring}`
                          : 'border-border bg-secondary/20',
                      ].join(' ')}
                    >
                      <span className={`absolute right-4 top-4 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${tier.chip}`}>
                        {tier.label}
                      </span>

                      <div className={`grid h-14 w-14 place-items-center rounded-2xl ${a.earned ? `bg-gradient-to-br ${tier.bg} ${tier.glow}` : 'bg-secondary/60'}`}>
                        {a.earned ? (
                          <Icon size={26} className="text-white drop-shadow-md" />
                        ) : (
                          <Lock size={20} className="text-muted-foreground/40" />
                        )}
                      </div>

                      <div>
                        <div className={`text-[15px] font-bold ${a.earned ? '' : 'text-muted-foreground'}`}>{a.label}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{a.desc}</div>
                      </div>

                      <div className="mt-auto flex flex-col gap-2">
                        {a.earned ? (
                          <>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {a.earnedAt ? fmtDate(a.earnedAt) : 'Earned'}
                            </div>
                            <div className="font-mono text-[12px] font-bold grad-text">+{a.xp} XP</div>
                          </>
                        ) : (
                          <>
                            {a.progress !== undefined && (
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                                  style={{ width: `${a.progress}%` }}
                                />
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-muted-foreground">{a.progressLabel ?? 'Locked'}</span>
                              <span className="font-mono text-[11px] text-muted-foreground/70">+{a.xp} XP</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* ── Footer: how XP works (transparent, derived constants) ── */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/[0.05] to-accent/[0.03] p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <Clock size={18} className="text-white" />
          </div>
          <div className="text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="text-foreground font-semibold">How XP is earned: </span>
            +{XP_PER_LESSON} XP per completed lesson · +{XP_PER_PERFECT_QUIZ} XP per perfect quiz score · +10 XP per quiz attempt.
          </div>
        </div>
      </section>
    </main>
  )
}
