'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, CheckCircle2, Circle, BookOpen, FlaskConical, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'

// ── Types ──────────────────────────────────────────────────────────────────────

export type Course = { id: string; title: string }

export type LessonStat = {
  lessonId: string
  title: string
  position: number
  moduleId: string
  completed: boolean
  lab?: {
    labId: string
    labTitle: string
    status: string | null
    overallStars: number | null
  }
}

export type ModuleStat = {
  moduleId: string
  title: string
  position: number
  lessons: LessonStat[]
}

export type CourseStat = {
  courseId: string
  courseTitle: string
  totalLessons: number
  completedLessons: number
  totalLabs: number
  completedLabs: number
  totalItems: number
  completedItems: number
  pct: number
  modules: ModuleStat[]
}

export type LearnerStat = {
  userId: string
  fullName: string | null
  email: string
  courses: CourseStat[]
  totalItems: number
  completedItems: number
  overallPct: number
}

export type CohortStatsData = {
  cohortTitle: string
  cohortStartsAt: string
  cohortStatus: string
  courses: Course[]
  learners: LearnerStat[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const LAB_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  evaluating: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  scored: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

function ProgressBar({ pct, thin }: { pct: number; thin?: boolean }) {
  return (
    <div className={`w-full rounded-full bg-white/10 overflow-hidden ${thin ? 'h-1' : 'h-1.5'}`}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function Stars({ count }: { count: number | null }) {
  if (count === null) return null
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          size={10}
          className={n <= count ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}
        />
      ))}
    </span>
  )
}

// ── Level 3: Lesson + Lab rows ─────────────────────────────────────────────────

function LessonRow({ lesson }: { lesson: LessonStat }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-md hover:bg-white/[0.03] transition-colors">
        {lesson.completed ? (
          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
        ) : (
          <Circle size={13} className="shrink-0 text-muted-foreground/40" />
        )}
        <BookOpen size={11} className="shrink-0 text-muted-foreground/50" />
        <span className={`text-xs flex-1 ${lesson.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
          {lesson.title}
        </span>
      </div>

      {lesson.lab && (
        <div className="flex items-center gap-2 py-1 px-3 ml-4 rounded-md">
          <FlaskConical size={11} className="shrink-0 text-muted-foreground/50" />
          <span className="text-[11px] text-muted-foreground flex-1 truncate">{lesson.lab.labTitle}</span>
          {lesson.lab.status ? (
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${LAB_STATUS_STYLES[lesson.lab.status] ?? ''}`}>
              {lesson.lab.status}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">not submitted</span>
          )}
          {lesson.lab.status === 'scored' && <Stars count={lesson.lab.overallStars} />}
        </div>
      )}
    </div>
  )
}

// ── Level 2: Course card ───────────────────────────────────────────────────────

function CourseCard({ course }: { course: CourseStat }) {
  const [open, setOpen] = useState(false)
  const showModuleHeaders = course.modules.length > 1

  return (
    <div className="rounded-lg border border-border/60 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium truncate">{course.courseTitle}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
              {course.completedItems}/{course.totalItems} ({course.pct}%)
            </span>
          </div>
          <ProgressBar pct={course.pct} thin />
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {course.modules.map((mod) => (
            <div key={mod.moduleId} className="space-y-0.5">
              {showModuleHeaders && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-3">
                  {mod.title}
                </p>
              )}
              {mod.lessons.map((lesson) => (
                <LessonRow key={lesson.lessonId} lesson={lesson} />
              ))}
            </div>
          ))}

          {course.modules.length === 0 && (
            <p className="text-xs text-muted-foreground px-3">No lessons in this course yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Level 1: Learner row ───────────────────────────────────────────────────────

function LearnerRow({
  learner,
  isExpanded,
  onToggle,
}: {
  learner: LearnerStat
  isExpanded: boolean
  onToggle: () => void
}) {
  const badge =
    learner.overallPct === 100
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : learner.overallPct > 0
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  const badgeLabel =
    learner.overallPct === 100 ? 'Completed' : learner.overallPct > 0 ? 'In progress' : 'Not started'

  return (
    <div className={`border-b border-border last:border-0 ${isExpanded ? 'bg-white/[0.02]' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials(learner.fullName, learner.email)}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{learner.fullName ?? '—'}</div>
          <div className="text-xs text-muted-foreground truncate">{learner.email}</div>
        </div>

        {/* Badge */}
        <span className={`hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge}`}>
          {badgeLabel}
        </span>

        {/* Progress */}
        <div className="flex items-center gap-2 w-32 shrink-0">
          <ProgressBar pct={learner.overallPct} />
          <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">
            {learner.overallPct}%
          </span>
        </div>

        {/* Expand chevron */}
        <ChevronRight
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
          {learner.courses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No courses assigned to this cohort.</p>
          ) : (
            learner.courses.map((course) => (
              <CourseCard key={course.courseId} course={course} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main client component ──────────────────────────────────────────────────────

type ProgressFilter = 'all' | 'not_started' | 'in_progress' | 'completed'
type SortKey = 'name_asc' | 'progress_asc' | 'progress_desc'

export function CohortStatsClient({ data }: { data: CohortStatsData }) {
  const [search, setSearch] = useState('')
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('name_asc')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...data.learners]

    // Search
    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (l) =>
          (l.fullName ?? '').toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q),
      )
    }

    // Progress filter
    if (progressFilter === 'not_started') list = list.filter((l) => l.overallPct === 0)
    else if (progressFilter === 'in_progress') list = list.filter((l) => l.overallPct > 0 && l.overallPct < 100)
    else if (progressFilter === 'completed') list = list.filter((l) => l.overallPct === 100)

    // Course filter — keep learners that have at least this course in their list
    if (courseFilter !== 'all') {
      list = list.filter((l) => l.courses.some((c) => c.courseId === courseFilter))
    }

    // Sort
    if (sort === 'name_asc') list.sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email))
    else if (sort === 'progress_asc') list.sort((a, b) => a.overallPct - b.overallPct)
    else if (sort === 'progress_desc') list.sort((a, b) => b.overallPct - a.overallPct)

    return list
  }, [data.learners, search, progressFilter, courseFilter, sort])

  const hasFilters = search || progressFilter !== 'all' || courseFilter !== 'all' || sort !== 'name_asc'

  const summaryStats = useMemo(() => {
    const total = data.learners.length
    const completed = data.learners.filter((l) => l.overallPct === 100).length
    const inProgress = data.learners.filter((l) => l.overallPct > 0 && l.overallPct < 100).length
    const notStarted = data.learners.filter((l) => l.overallPct === 0).length
    const avgPct =
      total > 0 ? Math.round(data.learners.reduce((s, l) => s + l.overallPct, 0) / total) : 0
    return { total, completed, inProgress, notStarted, avgPct }
  }, [data.learners])

  if (data.learners.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="font-medium">No enrolled learners yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enroll members to this cohort to see their progress here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avg. progress', value: `${summaryStats.avgPct}%` },
          { label: 'Completed', value: summaryStats.completed },
          { label: 'In progress', value: summaryStats.inProgress },
          { label: 'Not started', value: summaryStats.notStarted },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-card border-border"
          />
        </div>

        <select
          value={progressFilter}
          onChange={(e) => setProgressFilter(e.target.value as ProgressFilter)}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="all">All progress</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>

        {data.courses.length > 1 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="all">All courses</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="name_asc">Name A–Z</option>
          <option value="progress_desc">Progress ↓</option>
          <option value="progress_asc">Progress ↑</option>
        </select>
      </div>

      {/* Learner table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-white/[0.02]">
          <div className="w-8 shrink-0" />
          <div className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Learner</div>
          <div className="hidden sm:block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</div>
          <div className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Progress</div>
          <div className="w-4 shrink-0" />
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No learners match these filters.</p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setProgressFilter('all'); setCourseFilter('all'); setSort('name_asc') }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map((learner) => (
            <LearnerRow
              key={learner.userId}
              learner={learner}
              isExpanded={expandedUserId === learner.userId}
              onToggle={() => setExpandedUserId((prev) => prev === learner.userId ? null : learner.userId)}
            />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {data.learners.length} learner{data.learners.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
