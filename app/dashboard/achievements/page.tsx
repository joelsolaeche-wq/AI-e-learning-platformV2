// app/dashboard/achievements/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ring } from '@/components/ui/Ring'
import {
  Trophy, Flame, Zap, Target, BookOpen, Award, Brain, Sparkles,
  Crown, Lock, Shield, Cpu, GitBranch, MessageSquare, Calendar,
} from 'lucide-react'

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
  progress?: number   // 0-100, only when locked
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

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Real data: lesson progress, quizzes, enrollments
  const [progressResult, quizResult, enrollmentsResult] = await Promise.all([
    supabase.from('lesson_progress')
      .select('lesson_id, completed, completed_at')
      .eq('user_id', user.id)
      .eq('completed', true),
    supabase.from('quiz_attempts')
      .select('score, max_score, submitted_at')
      .eq('user_id', user.id),
    supabase.from('enrollments')
      .select('cohort_id, enrolled_at')
      .eq('user_id', user.id),
  ])

  type LP = { lesson_id: string; completed: boolean; completed_at: string | null }
  type QA = { score: number; max_score: number; submitted_at: string }
  const completions = (progressResult.data ?? []) as LP[]
  const quizzes = (quizResult.data ?? []) as QA[]

  const totalCompleted = completions.length
  const enrollmentsCount = (enrollmentsResult.data ?? []).length

  // Find max lessons in a single day (for "Quick Learner")
  const byDate = new Map<string, number>()
  for (const c of completions) {
    if (!c.completed_at) continue
    const d = c.completed_at.slice(0, 10)
    byDate.set(d, (byDate.get(d) ?? 0) + 1)
  }
  const maxLessonsInDay = byDate.size > 0 ? Math.max(...byDate.values()) : 0

  // Most recent completion → "earnedAt" for first-prompt badges
  const sortedCompletions = [...completions]
    .filter((c) => c.completed_at)
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  const firstCompletion = sortedCompletions[sortedCompletions.length - 1]?.completed_at ?? null

  // Quiz stats
  const perfectQuizzes = quizzes.filter((q) => q.max_score > 0 && q.score === q.max_score)
  const firstPerfectAt = perfectQuizzes.length > 0
    ? [...perfectQuizzes].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))[0].submitted_at
    : null

  // Streak — approximated for demo (in production, derive from daily activity)
  const streakDays = 7

  const achievements: Achievement[] = [
    // Learning milestones
    {
      id: 'first-prompt', Icon: Sparkles, category: 'Learning', tier: 'bronze',
      label: 'First Prompt', desc: 'Complete your first lesson', xp: 50,
      earned: totalCompleted >= 1, earnedAt: firstCompletion,
      progress: totalCompleted >= 1 ? undefined : 0,
    },
    {
      id: 'token-master', Icon: Cpu, category: 'Learning', tier: 'bronze',
      label: 'Token Master', desc: 'Complete 10 lessons', xp: 150,
      earned: totalCompleted >= 10,
      progress: totalCompleted >= 10 ? undefined : Math.min(100, (totalCompleted / 10) * 100),
      progressLabel: `${Math.min(totalCompleted, 10)} / 10`,
    },
    {
      id: 'context-window', Icon: Brain, category: 'Learning', tier: 'silver',
      label: 'Context Window', desc: 'Complete 50 lessons', xp: 400,
      earned: totalCompleted >= 50,
      progress: totalCompleted >= 50 ? undefined : Math.min(100, (totalCompleted / 50) * 100),
      progressLabel: `${Math.min(totalCompleted, 50)} / 50`,
    },
    {
      id: 'long-context', Icon: Award, category: 'Learning', tier: 'gold',
      label: '100k Context', desc: 'Complete 100 lessons', xp: 1000,
      earned: totalCompleted >= 100,
      progress: totalCompleted >= 100 ? undefined : Math.min(100, (totalCompleted / 100) * 100),
      progressLabel: `${Math.min(totalCompleted, 100)} / 100`,
    },

    // Streaks
    {
      id: 'streak-7', Icon: Flame, category: 'Streak', tier: 'bronze',
      label: '7-Day Streak', desc: 'Learn 7 days in a row', xp: 100,
      earned: streakDays >= 7,
      earnedAt: streakDays >= 7 ? new Date().toISOString() : null,
    },
    {
      id: 'streak-30', Icon: Flame, category: 'Streak', tier: 'gold',
      label: 'Marathon', desc: 'Learn 30 days in a row', xp: 750,
      earned: streakDays >= 30,
      progress: streakDays >= 30 ? undefined : Math.min(100, (streakDays / 30) * 100),
      progressLabel: `${streakDays} / 30 days`,
    },
    {
      id: 'speed-runner', Icon: Zap, category: 'Streak', tier: 'silver',
      label: 'Speed Runner', desc: '5 lessons in a single day', xp: 200,
      earned: maxLessonsInDay >= 5,
      progress: maxLessonsInDay >= 5 ? undefined : Math.min(100, (maxLessonsInDay / 5) * 100),
      progressLabel: `${maxLessonsInDay} / 5 today`,
    },

    // Quiz mastery
    {
      id: 'first-perfect', Icon: Target, category: 'Mastery', tier: 'bronze',
      label: 'Perfect Score', desc: 'Ace your first quiz', xp: 75,
      earned: perfectQuizzes.length >= 1, earnedAt: firstPerfectAt,
    },
    {
      id: 'quiz-master', Icon: Crown, category: 'Mastery', tier: 'silver',
      label: 'Quiz Master', desc: '10 perfect quiz scores', xp: 350,
      earned: perfectQuizzes.length >= 10,
      progress: perfectQuizzes.length >= 10 ? undefined : Math.min(100, (perfectQuizzes.length / 10) * 100),
      progressLabel: `${perfectQuizzes.length} / 10`,
    },

    // Builder achievements (AI-specific)
    {
      id: 'rag-architect', Icon: GitBranch, category: 'Builder', tier: 'gold',
      label: 'RAG Architect', desc: 'Finish a RAG systems course', xp: 600,
      earned: false, progress: 22, progressLabel: 'In progress',
    },
    {
      id: 'agent-engineer', Icon: Cpu, category: 'Builder', tier: 'gold',
      label: 'Agent Engineer', desc: 'Ship an agentic workflow project', xp: 600,
      earned: false, progress: 0, progressLabel: 'Locked — finish AI Foundations first',
    },
    {
      id: 'fine-tuner', Icon: Shield, category: 'Builder', tier: 'platinum',
      label: 'Fine-Tuner', desc: 'Train and deploy a custom model', xp: 1500,
      earned: false, progressLabel: 'Capstone project required',
    },

    // Cohort
    {
      id: 'cohort-joined', Icon: BookOpen, category: 'Cohort', tier: 'bronze',
      label: 'Cohort Member', desc: 'Join your first cohort', xp: 50,
      earned: enrollmentsCount >= 1,
      earnedAt: enrollmentsCount >= 1 ? null : null,
    },
    {
      id: 'pair-programmer', Icon: MessageSquare, category: 'Cohort', tier: 'silver',
      label: 'Pair Programmer', desc: 'Help a teammate in office hours', xp: 200,
      earned: false, progressLabel: 'Coming soon',
    },
    {
      id: 'cohort-champion', Icon: Trophy, category: 'Cohort', tier: 'gold',
      label: 'Cohort Champion', desc: 'Finish top 3 in your cohort', xp: 800,
      earned: false, progress: 62, progressLabel: 'Currently 3rd place',
    },
  ]

  const earnedCount = achievements.filter((a) => a.earned).length
  const totalXP = achievements.filter((a) => a.earned).reduce((s, a) => s + a.xp, 0)
  const overallPct = Math.floor((earnedCount / achievements.length) * 100)

  // Group by category for sectioned grid
  const categories: Category[] = ['Learning', 'Streak', 'Mastery', 'Builder', 'Cohort']
  const grouped = categories.map((cat) => ({
    category: cat,
    items: achievements.filter((a) => a.category === cat),
  }))

  // Recent unlocks: earned achievements with timestamps
  const recentUnlocks = achievements
    .filter((a) => a.earned)
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
              Earn badges for completing lessons, mastering quizzes, and shipping AI projects with your cohort.
            </p>
          </div>

          {/* Progress ring + XP */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <Ring pct={overallPct} size={108} stroke={9}>
                <div className="text-center">
                  <div className="text-[22px] font-bold leading-none">{overallPct}%</div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">complete</div>
                </div>
              </Ring>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total XP</div>
                <div className="mt-0.5 font-mono text-[22px] font-bold tabular-nums grad-text">{totalXP.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Lessons</div>
                <div className="mt-0.5 font-mono text-[22px] font-bold tabular-nums">{totalCompleted}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -bottom-10 -right-10 -top-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-yellow-400/30 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[220px] w-[220px] rounded-full bg-primary/40 blur-[40px]" />
        </div>
      </section>

      {/* ── Recent unlocks timeline ──────────────────────────────── */}
      {recentUnlocks.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[16px] font-bold tracking-tight text-muted-foreground uppercase tracking-[0.08em]">Recently unlocked</h2>
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

      {/* ── Achievements by category ─────────────────────────────── */}
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
                      {/* Tier chip */}
                      <span className={`absolute right-4 top-4 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${tier.chip}`}>
                        {tier.label}
                      </span>

                      {/* Icon */}
                      <div className={`grid h-14 w-14 place-items-center rounded-2xl ${a.earned ? `bg-gradient-to-br ${tier.bg} ${tier.glow}` : 'bg-secondary/60'}`}>
                        {a.earned ? (
                          <Icon size={26} className="text-white drop-shadow-md" />
                        ) : (
                          <Lock size={20} className="text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Label + desc */}
                      <div>
                        <div className={`text-[15px] font-bold ${a.earned ? '' : 'text-muted-foreground'}`}>{a.label}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{a.desc}</div>
                      </div>

                      {/* XP + earned date or progress */}
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

      {/* ── Footer hint ──────────────────────────────────────────── */}
      <section className="flex items-center justify-between rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] to-accent/[0.04] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <Calendar size={18} className="text-white" />
          </div>
          <div>
            <div className="text-[14px] font-semibold">Office hours every Thursday</div>
            <div className="text-[12px] text-muted-foreground">Help a teammate to unlock the &ldquo;Pair Programmer&rdquo; badge.</div>
          </div>
        </div>
      </section>
    </main>
  )
}
