// lib/learner-stats.ts
// Computes learner stats (XP, level, streak, today's activity) from real
// lesson_progress + quiz_attempts rows. No mock data — every value derives
// from rows the current user can read under RLS.

import type { createClient } from './supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export const XP_PER_LESSON = 50
export const XP_PER_PERFECT_QUIZ = 25
export const XP_PER_QUIZ_ATTEMPT = 10
// 10 lessons + some quiz activity per level — keeps "lessons away" achievable
export const XP_PER_LEVEL = 500

export interface LearnerStats {
  totalLessonsCompleted: number
  perfectQuizzes: number
  totalQuizAttempts: number

  // Today (UTC date boundary)
  todayLessonsCompleted: number
  todayMinutesWatched: number
  todayXPEarned: number

  // This week (last 7 days, calendar)
  weekLessonsCompleted: number
  weekXPEarned: number
  weekMinutesWatched: number

  // Activity history
  currentStreakDays: number
  longestStreakDays: number
  maxLessonsInOneDay: number
  firstActivityDate: string | null
  lastActivityDate: string | null

  // Watch time
  totalSecondsWatched: number

  // XP / level
  xp: number
  level: number
  xpInCurrentLevel: number
  xpForNextLevel: number     // total XP needed to reach next level
  lessonsAwayFromLevelUp: number
}

type ProgressRow = {
  lesson_id: string
  completed: boolean
  completed_at: string | null
  last_position: number
  updated_at: string
}

type QuizRow = {
  score: number
  max_score: number
  submitted_at: string
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayDiff(a: string, b: string): number {
  // Days between two YYYY-MM-DD strings (a - b)
  const ms = new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()
  return Math.round(ms / 86_400_000)
}

export async function getLearnerStats(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<LearnerStats> {
  const [progressResult, quizResult] = await Promise.all([
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed, completed_at, last_position, updated_at')
      .eq('user_id', userId),
    supabase
      .from('quiz_attempts')
      .select('score, max_score, submitted_at')
      .eq('user_id', userId),
  ])

  const progress = (progressResult.data ?? []) as ProgressRow[]
  const quizzes = (quizResult.data ?? []) as QuizRow[]

  const completed = progress.filter((p) => p.completed)
  const totalLessonsCompleted = completed.length
  const perfectQuizzes = quizzes.filter((q) => q.max_score > 0 && q.score === q.max_score).length
  const totalQuizAttempts = quizzes.length

  // Activity dates (UTC day buckets)
  const today = isoDay(new Date())
  const sevenDaysAgo = isoDay(new Date(Date.now() - 7 * 86_400_000))

  // Per-day lesson count (for streak + max-in-day + week stats)
  const lessonsByDay = new Map<string, number>()
  const minutesByDay = new Map<string, number>()
  for (const p of completed) {
    if (!p.completed_at) continue
    const d = p.completed_at.slice(0, 10)
    lessonsByDay.set(d, (lessonsByDay.get(d) ?? 0) + 1)
    minutesByDay.set(d, (minutesByDay.get(d) ?? 0) + Math.round(p.last_position / 60))
  }

  // Per-day quiz count
  const quizzesByDay = new Map<string, { attempts: number; perfect: number }>()
  for (const q of quizzes) {
    const d = q.submitted_at.slice(0, 10)
    const cur = quizzesByDay.get(d) ?? { attempts: 0, perfect: 0 }
    cur.attempts++
    if (q.max_score > 0 && q.score === q.max_score) cur.perfect++
    quizzesByDay.set(d, cur)
  }

  // Today
  const todayLessonsCompleted = lessonsByDay.get(today) ?? 0
  const todayMinutesWatched = minutesByDay.get(today) ?? 0
  const todayQuizDay = quizzesByDay.get(today) ?? { attempts: 0, perfect: 0 }
  const todayXPEarned =
    todayLessonsCompleted * XP_PER_LESSON +
    todayQuizDay.perfect * XP_PER_PERFECT_QUIZ +
    todayQuizDay.attempts * XP_PER_QUIZ_ATTEMPT

  // This week (any day from last 7 days)
  let weekLessonsCompleted = 0
  let weekMinutesWatched = 0
  for (const [day, n] of lessonsByDay) {
    if (day >= sevenDaysAgo) {
      weekLessonsCompleted += n
      weekMinutesWatched += minutesByDay.get(day) ?? 0
    }
  }
  let weekQuizPerfect = 0
  let weekQuizAttempts = 0
  for (const [day, { attempts, perfect }] of quizzesByDay) {
    if (day >= sevenDaysAgo) {
      weekQuizPerfect += perfect
      weekQuizAttempts += attempts
    }
  }
  const weekXPEarned =
    weekLessonsCompleted * XP_PER_LESSON +
    weekQuizPerfect * XP_PER_PERFECT_QUIZ +
    weekQuizAttempts * XP_PER_QUIZ_ATTEMPT

  // Active days = union of lesson + quiz days
  const activeDays = new Set<string>([...lessonsByDay.keys(), ...quizzesByDay.keys()])
  const sortedActiveDays = [...activeDays].sort() // ascending YYYY-MM-DD lex sort

  // Current streak — start from today (or yesterday if no activity today),
  // count consecutive days back through activeDays.
  let currentStreakDays = 0
  if (activeDays.size > 0) {
    let cursor = today
    if (!activeDays.has(cursor)) {
      // No activity today → start from yesterday if there's activity there
      const yesterday = isoDay(new Date(Date.now() - 86_400_000))
      cursor = yesterday
    }
    while (activeDays.has(cursor)) {
      currentStreakDays++
      const prev = new Date(cursor + 'T00:00:00Z')
      prev.setUTCDate(prev.getUTCDate() - 1)
      cursor = isoDay(prev)
    }
  }

  // Longest streak — walk sorted active days, count consecutive runs
  let longestStreakDays = 0
  if (sortedActiveDays.length > 0) {
    let run = 1
    longestStreakDays = 1
    for (let i = 1; i < sortedActiveDays.length; i++) {
      const diff = dayDiff(sortedActiveDays[i], sortedActiveDays[i - 1])
      if (diff === 1) {
        run++
        if (run > longestStreakDays) longestStreakDays = run
      } else {
        run = 1
      }
    }
  }

  const maxLessonsInOneDay = lessonsByDay.size > 0 ? Math.max(...lessonsByDay.values()) : 0
  const firstActivityDate = sortedActiveDays[0] ?? null
  const lastActivityDate = sortedActiveDays[sortedActiveDays.length - 1] ?? null

  const totalSecondsWatched = completed.reduce((s, p) => s + p.last_position, 0)

  // XP / level
  const xp =
    totalLessonsCompleted * XP_PER_LESSON +
    perfectQuizzes * XP_PER_PERFECT_QUIZ +
    totalQuizAttempts * XP_PER_QUIZ_ATTEMPT
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInCurrentLevel = xp % XP_PER_LEVEL
  const xpForNextLevel = level * XP_PER_LEVEL
  const lessonsAwayFromLevelUp = Math.max(
    0,
    Math.ceil((XP_PER_LEVEL - xpInCurrentLevel) / XP_PER_LESSON),
  )

  return {
    totalLessonsCompleted,
    perfectQuizzes,
    totalQuizAttempts,
    todayLessonsCompleted,
    todayMinutesWatched,
    todayXPEarned,
    weekLessonsCompleted,
    weekXPEarned,
    weekMinutesWatched,
    currentStreakDays,
    longestStreakDays,
    maxLessonsInOneDay,
    firstActivityDate,
    lastActivityDate,
    totalSecondsWatched,
    xp,
    level,
    xpInCurrentLevel,
    xpForNextLevel,
    lessonsAwayFromLevelUp,
  }
}
