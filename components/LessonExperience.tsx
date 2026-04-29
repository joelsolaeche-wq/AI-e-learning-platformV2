'use client'

import { useState } from 'react'
import { Check, Clock, ChevronRight, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { QuizSection } from '@/components/QuizSection'
import { Ring } from '@/components/ui/Ring'
import { cn } from '@/lib/utils'

type ClientQuestion = {
  id: string
  question: string
  options: string[]
}

type ModuleLesson = {
  id: string
  title: string
  position: number
  duration_seconds: number | null
  completed: boolean
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
  resumePosition: number
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  moduleLessons: ModuleLesson[]
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
  resumePosition,
  isLessonComplete,
  clientQuestions,
  moduleLessons,
}: LessonExperienceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  const completedCount = moduleLessons.filter((l) => l.completed).length
  const totalLessons = moduleLessons.length
  const pct = totalLessons > 0 ? Math.floor((completedCount / totalLessons) * 100) : 0

  const currentIdx = moduleLessons.findIndex((l) => l.id === lesson.id)
  const nextLesson =
    currentIdx >= 0 && currentIdx + 1 < moduleLessons.length
      ? moduleLessons[currentIdx + 1]
      : null

  return (
    <main className="mx-auto w-full max-w-[1280px] flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Left: main content */}
      <div className="min-w-0 flex-1 flex flex-col gap-6 pb-20">
        {/* Video — rounded-2xl + violet glow */}
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
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-tight">{lesson.title}</h1>
          {lesson.duration_seconds && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Clock size={13} />
              <span>{formatDuration(lesson.duration_seconds)}</span>
            </div>
          )}
        </div>

        {/* Tabbed panel */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-0.5 rounded-xl border border-border bg-card/50 p-1 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'relative px-4 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200',
                  activeTab === tab
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
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

        {/* Quiz — below the video, NOT in the sidebar */}
        {clientQuestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Knowledge check
            </h2>
            <QuizSection
              clientQuestions={clientQuestions}
              lessonId={lesson.id}
              isLessonComplete={isLessonComplete}
            />
          </section>
        )}
      </div>

      {/* Right: module sidebar (320px, sticky) */}
      <aside className="w-full flex-shrink-0 flex flex-col gap-4 lg:w-[320px] lg:sticky lg:top-6">
        {/* Module progress card */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Module progress
            </span>
            <span className="text-[11px] text-muted-foreground">
              {completedCount}/{totalLessons}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Ring pct={pct} size={64} stroke={6}>
              <span className="text-[13px] font-bold">{pct}%</span>
            </Ring>
            <div>
              <div className="text-[14.5px] font-bold leading-tight">{moduleTitle}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {completedCount} of {totalLessons} complete
              </div>
            </div>
          </div>

          {/* Lesson list */}
          <div className="flex flex-col gap-0.5 border-t border-border pt-3">
            {moduleLessons.map((ml, i) => {
              const isCurrent = ml.id === lesson.id
              return (
                <Link
                  key={ml.id}
                  href={`/dashboard/lesson/${ml.id}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-all',
                    isCurrent
                      ? 'bg-primary/10 text-foreground ring-1 ring-primary/25'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors',
                      ml.completed
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isCurrent
                        ? 'bg-primary/20 text-primary'
                        : 'bg-white/[0.08] text-muted-foreground',
                    )}
                  >
                    {ml.completed ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{ml.title}</span>
                  {ml.duration_seconds && (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                      {formatDuration(ml.duration_seconds)}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Up next card */}
        {nextLesson && (
          <Link
            href={`/dashboard/lesson/${nextLesson.id}`}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(139,92,246,0.15)]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Up next
            </span>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] border border-primary/30 bg-primary/15 text-primary transition-all group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                <PlayCircle size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{nextLesson.title}</div>
                {nextLesson.duration_seconds && (
                  <div className="text-[11px] text-muted-foreground">
                    {formatDuration(nextLesson.duration_seconds)}
                  </div>
                )}
              </div>
              <ChevronRight
                size={15}
                className="ml-auto shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              />
            </div>
          </Link>
        )}
      </aside>
    </main>
  )
}
