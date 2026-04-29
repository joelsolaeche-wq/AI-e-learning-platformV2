'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronRight, PlayCircle, Lock, Sparkles, Check } from 'lucide-react'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { QuizSection } from '@/components/QuizSection'
import { Ring } from '@/components/ui/Ring'
import { CurriculumTree, type CurriculumModule } from '@/components/CurriculumTree'
import { cn } from '@/lib/utils'

type ClientQuestion = {
  id: string
  question: string
  options: string[]
}

interface LessonExperienceProps {
  lesson: {
    id: string
    title: string
    mux_playback_id: string | null
    duration_seconds: number | null
    transcript: string | null
  }
  moduleTitle: string
  courseTitle: string | null
  resumePosition: number
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  curriculum: CurriculumModule[]
}

const TABS = ['Overview', 'Transcript', 'Resources', 'Notes'] as const
type Tab = (typeof TABS)[number]

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function LessonExperience({
  lesson,
  moduleTitle,
  courseTitle,
  resumePosition,
  isLessonComplete,
  clientQuestions,
  curriculum,
}: LessonExperienceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [marking, setMarking] = useState(false)
  const router = useRouter()

  // Course-wide totals
  const allLessons = curriculum.flatMap((m) => m.lessons)
  const totalLessons = allLessons.length
  const completedLessons = allLessons.filter((l) => l.completed).length
  const coursePct = totalLessons > 0 ? Math.floor((completedLessons / totalLessons) * 100) : 0

  // Find next lesson (current module first, then next module)
  let nextLesson: CurriculumModule['lessons'][0] | null = null
  let foundCurrent = false
  outer: for (const mod of curriculum) {
    for (const l of mod.lessons) {
      if (foundCurrent) { nextLesson = l; break outer }
      if (l.id === lesson.id) foundCurrent = true
    }
  }

  // Manual mark-complete escape hatch: hits the same /api/video/progress route
  // the player auto-uses, with completed=true. Used when auto-detect missed
  // because the lesson has no duration_seconds in the DB.
  async function markVideoComplete() {
    if (marking || isLessonComplete) return
    setMarking(true)
    try {
      const res = await fetch('/api/video/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          position: lesson.duration_seconds ?? Math.max(resumePosition, 1),
          duration: lesson.duration_seconds ?? 0,
          completed: true,
        }),
      })
      if (res.ok) router.refresh()
    } catch (e) {
      console.error('[LessonExperience] mark complete failed', e)
    } finally {
      setMarking(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Left: video + tabs + quiz */}
      <div className="min-w-0 flex-1 flex flex-col gap-6 pb-20">
        {/* Video */}
        <div className="relative rounded-2xl overflow-hidden glow-soft">
          {lesson.mux_playback_id ? (
            <VideoPlayer
              playbackId={lesson.mux_playback_id}
              lessonId={lesson.id}
              resumePosition={resumePosition}
              duration={lesson.duration_seconds ?? 0}
            />
          ) : (
            <div className="aspect-video flex items-center justify-center rounded-2xl bg-muted">
              <p className="text-sm text-muted-foreground">Video not available</p>
            </div>
          )}
        </div>

        {/* Title block */}
        <div>
          <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            {courseTitle && <span>{courseTitle}</span>}
            {courseTitle && <span className="text-muted-foreground/40">/</span>}
            <span className="text-primary">{moduleTitle}</span>
          </div>
          <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.02em] leading-tight">{lesson.title}</h1>
          <div className="mt-1.5 flex items-center gap-3 text-[13px] text-muted-foreground">
            {lesson.duration_seconds && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} />
                {formatDuration(lesson.duration_seconds)}
              </span>
            )}
            {isLessonComplete && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-400">
                <Check size={10} strokeWidth={3} /> Lesson complete
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-0.5 rounded-xl border border-border bg-card/50 p-1 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'relative px-4 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200',
                  activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {activeTab === tab && (
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-b from-primary/20 to-primary/[0.08] ring-1 ring-primary/30 shadow-[0_0_12px_rgba(139,92,246,0.2)]" />
                )}
                <span className="relative">{tab}</span>
              </button>
            ))}
          </div>

          <div className="min-h-[80px]">
            {activeTab === 'Overview' && (
              <div className="rounded-xl border border-border bg-card p-5 text-[14px] text-muted-foreground leading-relaxed">
                <p>
                  This lesson is part of the module{' '}
                  <span className="font-medium text-foreground">{moduleTitle}</span>. Watch the
                  full video to unlock the knowledge check below.
                </p>
              </div>
            )}
            {activeTab === 'Transcript' && (
              <div className="rounded-xl border border-border bg-card p-5 text-[13.5px] leading-relaxed text-foreground/80">
                {lesson.transcript ? (
                  <p className="whitespace-pre-wrap">{lesson.transcript}</p>
                ) : (
                  <p className="text-muted-foreground">No transcript available for this lesson.</p>
                )}
              </div>
            )}
            {activeTab === 'Resources' && (
              <div className="rounded-xl border border-border bg-card p-5 text-[14px] text-muted-foreground">
                No additional resources for this lesson.
              </div>
            )}
            {activeTab === 'Notes' && (
              <div className="rounded-xl border border-border bg-card p-5 text-[14px] text-muted-foreground">
                Personal notes coming soon.
              </div>
            )}
          </div>
        </div>

        {/* Knowledge check — ALWAYS rendered, three states */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Knowledge check
          </h2>

          {clientQuestions.length === 0 ? (
            // State 1: No quiz exists for this lesson
            <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 ring-1 ring-primary/20">
                <Sparkles size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold">No quiz for this lesson</p>
                <p className="mt-1 max-w-[440px] text-[13px] text-muted-foreground">
                  This lesson is watch-and-reflect. Let it sink in, then continue when you&apos;re ready.
                </p>
              </div>
              {nextLesson && (
                <Link
                  href={`/dashboard/lesson/${nextLesson.id}`}
                  className="mt-1 inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-4 py-2 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                >
                  Next lesson <ChevronRight size={13} />
                </Link>
              )}
            </div>
          ) : !isLessonComplete ? (
            // State 2: Has quiz, but video isn't complete yet
            <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary/60">
                <Lock size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-[14px] font-semibold">Quiz locked</p>
                <p className="mt-1 max-w-[440px] text-[13px] text-muted-foreground">
                  Watch the video to unlock {clientQuestions.length} question
                  {clientQuestions.length !== 1 ? 's' : ''}. The quiz auto-unlocks at 85%.
                </p>
              </div>
              <button
                type="button"
                onClick={markVideoComplete}
                disabled={marking}
                className="mt-1 inline-flex items-center gap-2 rounded-[10px] border border-primary/40 bg-primary/15 px-4 py-2 text-[13px] font-semibold text-primary transition-all hover:border-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_16px_rgba(139,92,246,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {marking ? 'Marking…' : (
                  <>
                    <Check size={13} strokeWidth={3} /> Mark video complete
                  </>
                )}
              </button>
            </div>
          ) : (
            // State 3: Has quiz, video is complete → render the actual quiz
            <QuizSection
              clientQuestions={clientQuestions}
              lessonId={lesson.id}
              isLessonComplete={true}
            />
          )}
        </section>
      </div>

      {/* Right: course curriculum sidebar */}
      <aside className="w-full flex-shrink-0 flex flex-col gap-4 lg:w-[360px] lg:sticky lg:top-6">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Course progress
              </span>
              <div className="mt-0.5 truncate text-[14.5px] font-bold tracking-tight">
                {courseTitle ?? moduleTitle}
              </div>
            </div>
            <Ring pct={coursePct} size={56} stroke={5}>
              <span className="text-[11px] font-bold">{coursePct}%</span>
            </Ring>
          </div>

          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{completedLessons}</span>
              <span className="mx-1">/</span>
              <span className="font-mono">{totalLessons}</span>{' '}
              lessons complete
            </span>
          </div>

          {nextLesson && (
            <Link
              href={`/dashboard/lesson/${nextLesson.id}`}
              className="group mt-1 flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3 transition-all hover:border-primary/30 hover:bg-secondary/60"
            >
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] border border-primary/30 bg-primary/15 text-primary transition-all group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                <PlayCircle size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Up next</div>
                <div className="truncate text-[12.5px] font-semibold">{nextLesson.title}</div>
              </div>
              <ChevronRight size={13} className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </Link>
          )}
        </div>

        <CurriculumTree
          modules={curriculum}
          currentLessonId={lesson.id}
          variant="compact"
        />
      </aside>
    </main>
  )
}
