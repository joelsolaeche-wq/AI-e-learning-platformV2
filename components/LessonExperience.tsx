'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  ChevronRight,
  Lock,
  Sparkles,
  Check,
  FlaskConical,
  Menu,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { QuizSection } from '@/components/QuizSection'
import { LabSection, type LabData, type LabSubmission } from '@/components/LabSection'
import { CurriculumTree, type CurriculumModule } from '@/components/CurriculumTree'
import { TranscriptView } from '@/components/TranscriptView'
import { TutorPanel } from '@/components/TutorPanel'
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
    transcript_segments: { start: number; text: string }[] | null
    video_source: string
    youtube_id: string | null
  }
  moduleTitle: string
  courseTitle: string | null
  resumePosition: number
  isLessonComplete: boolean
  clientQuestions: ClientQuestion[]
  curriculum: CurriculumModule[]
  lab?: LabData | null
  latestSubmission?: LabSubmission | null
  /** Prior tutor messages for this lesson, fed into the embedded Synapse panel. */
  tutorInitialMessages?: { id?: string; role: string; content: string; createdAt?: Date }[]
}

const BASE_TABS = ['Overview', 'Transcript', 'Resources', 'Notes'] as const
const ALL_TABS = [...BASE_TABS, 'Lab'] as const
type Tab = (typeof ALL_TABS)[number]

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
  lab = null,
  latestSubmission = null,
  tutorInitialMessages,
}: LessonExperienceProps) {
  const TABS = lab ? ALL_TABS : BASE_TABS
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [marking, setMarking] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  // Course-wide totals + flat lesson list (used for the curriculum drawer +
  // the "Next lesson" CTA on the locked-quiz/no-quiz states).
  const flatLessons = curriculum.flatMap((m) => m.lessons)
  const totalLessons = flatLessons.length
  const completedLessons = flatLessons.filter((l) => l.completed).length
  const coursePct =
    totalLessons > 0 ? Math.floor((completedLessons / totalLessons) * 100) : 0

  const currentIndex = flatLessons.findIndex((l) => l.id === lesson.id)
  const nextLesson =
    currentIndex >= 0 && currentIndex < flatLessons.length - 1
      ? flatLessons[currentIndex + 1]
      : null

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
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      {/* ── Top lesson bar — course title + curriculum drawer trigger ─────── */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-5 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-[12.5px] font-medium text-foreground hover:bg-secondary transition-colors"
          aria-label="Open course curriculum"
        >
          <Menu size={14} />
          <span className="hidden sm:inline">Curriculum</span>
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[14px] font-bold tracking-tight">
            {courseTitle ?? moduleTitle}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {moduleTitle}
          </div>
        </div>

        <div className="hidden items-center gap-2 text-[12px] text-muted-foreground md:flex">
          <span className="font-mono tabular-nums">{coursePct}%</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${coursePct}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Curriculum drawer (slide-in from right) ───────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close curriculum"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 bg-black/55 backdrop-blur-sm"
          />
          {/* Panel */}
          <div className="flex h-full w-full max-w-[420px] flex-col border-l border-border bg-[#11111C] shadow-[-12px_0_32px_rgba(0,0,0,0.5)] animate-[fadeUp_.18s_ease]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Course
                </div>
                <div className="text-[14.5px] font-bold tracking-tight">
                  {courseTitle ?? moduleTitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">
                      {completedLessons}
                    </span>
                    <span className="mx-1">/</span>
                    <span className="font-mono">{totalLessons}</span> complete
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {coursePct}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/60">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${coursePct}%` }}
                  />
                </div>
              </div>
              <CurriculumTree
                modules={curriculum}
                currentLessonId={lesson.id}
                variant="compact"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Main 2-column area: lesson content (left) + Synapse (right) ──── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
        {/* LEFT: Learn — video + tabs + quiz */}
        <div className="min-w-0 flex-1 flex flex-col gap-6">
          {/* Video */}
          <div className="relative rounded-2xl overflow-hidden glow-soft">
            {(lesson.video_source === 'youtube' ? lesson.youtube_id : lesson.mux_playback_id) ? (
              <VideoPlayer
                lessonId={lesson.id}
                resumePosition={resumePosition}
                duration={lesson.duration_seconds ?? 0}
                videoSource={lesson.video_source === 'youtube' ? 'youtube' : 'mux'}
                playbackId={lesson.mux_playback_id}
                youtubeId={lesson.youtube_id}
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
                  onClick={() => setActiveTab(tab as Tab)}
                  className={cn(
                    'relative px-4 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200',
                    activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {activeTab === tab && (
                    <span className="absolute inset-0 rounded-lg bg-gradient-to-b from-primary/20 to-primary/[0.08] ring-1 ring-primary/30 shadow-[0_0_12px_rgba(139,92,246,0.2)]" />
                  )}
                  {tab === 'Lab' ? (
                    <span className="relative flex items-center gap-1.5">
                      <FlaskConical size={12} /> Lab
                    </span>
                  ) : (
                    <span className="relative">{tab}</span>
                  )}
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
                <TranscriptView
                  segments={lesson.transcript_segments}
                  flatText={lesson.transcript}
                />
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
              {activeTab === 'Lab' && lab && (
                <LabSection lessonId={lesson.id} lab={lab} latestSubmission={latestSubmission} />
              )}
            </div>
          </div>

          {/* Knowledge check — ALWAYS rendered, three states */}
          <section className="flex flex-col gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Knowledge check
            </h2>

            {clientQuestions.length === 0 ? (
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
              <QuizSection
                clientQuestions={clientQuestions}
                lessonId={lesson.id}
                isLessonComplete={true}
              />
            )}
          </section>
        </div>

        {/* RIGHT: Synapse — always visible, fills the right column down to
            the bottom of the viewport. Sticky so it stays put while the
            left column scrolls. */}
        <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:w-[400px] xl:w-[420px]">
          <TutorPanel
            mode="embedded"
            lessonId={lesson.id}
            initialMessages={tutorInitialMessages}
          />
        </aside>
      </div>
    </main>
  )
}
