import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import type { Message } from 'ai'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Separator } from '@/components/ui/separator'
import { QuizSection } from '@/components/QuizSection'
import { TutorPanel } from '@/components/TutorPanel'

// ---------------------------------------------------------------------------
// Types — explicit Pick aliases following the dashboard/catalog page convention
// ---------------------------------------------------------------------------

type LessonRow = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'title' | 'module_id' | 'mux_playback_id' | 'duration_seconds' | 'transcript'
>

type ProgressRow = Pick<
  Database['public']['Tables']['lesson_progress']['Row'],
  'last_position' | 'completed'
>

// ClientQuestion: answer-key-stripped shape safe to pass to client component.
// correct_answer and explanation are intentionally omitted — server only (QUIZ-02).
type ClientQuestion = {
  id: string
  question: string
  options: string[]
}

type RawQuizQuestion = ClientQuestion & {
  correct_answer: string  // present in DB, never sent to client
  explanation?: string
}

type RawQuizDef = {
  questions: unknown
}

// ChatMessageRow: shape of ai_chat_messages rows used to build initialMessages for TutorPanel.
type ChatMessageRow = {
  id: string
  role: string
  content: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface LessonPageProps {
  params: Promise<{ lessonId: string }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params

  const supabase = await createClient()

  // Belt-and-suspenders auth guard (middleware already protects /dashboard).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch lesson + progress + quiz in parallel.
  // RLS on lessons ensures only enrolled users can read rows — if the lesson
  // returns null (not found or not enrolled), we call notFound().
  const [lessonResult, progressResult, quizResult, chatHistoryResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, module_id, mux_playback_id, duration_seconds, transcript')
      .eq('id', lessonId)
      .single(),
    supabase
      .from('lesson_progress')
      .select('last_position, completed')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    supabase
      .from('quiz_definitions')
      .select('questions')
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    (async () => {
      // Load the chat session for this (user, lesson) pair, then fetch messages.
      // Returns [] if no session exists yet (first visit).
      const { data: sessionData } = await supabase
        .from('ai_chat_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle()

      if (!sessionData) return []

      const { data: messagesData, error: msgsError } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', (sessionData as unknown as { id: string }).id)
        .order('created_at', { ascending: true })
        .limit(20)

      if (msgsError) {
        console.error('[lesson page] ai_chat_messages fetch error', msgsError)
      }
      return (messagesData ?? []) as unknown as ChatMessageRow[]
    })(),
  ])

  const rawLesson = lessonResult.data
  if (lessonResult.error || !rawLesson) {
    notFound()
  }

  const lesson = rawLesson as LessonRow
  const progress = progressResult.data as unknown as ProgressRow | null
  const isLessonComplete = progress?.completed ?? false
  const resumePosition = progress?.last_position ?? 0

  // Strip correct_answer before passing to client component (QUIZ-02 / T-5-01).
  // RawQuizDef contains correct_answer; clientQuestions never does.
  const quizDef = quizResult.data as unknown as RawQuizDef | null
  const rawQuestions = (quizDef?.questions ?? []) as RawQuizQuestion[]
  const clientQuestions: ClientQuestion[] = rawQuestions.map(({ id, question, options }) => ({
    id,
    question,
    options,
  }))

  // Build initialMessages for TutorPanel — shape matches Vercel AI SDK Message type.
  // chatHistoryResult is ChatMessageRow[] | [] (never null — IIFE returns [] on missing session).
  const chatHistory = chatHistoryResult as ChatMessageRow[]
  const initialMessages: Message[] = chatHistory.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    createdAt: new Date(m.created_at),
  }))

  return (
    <main className="mx-auto w-full max-w-[896px] px-8 pt-8 pb-16 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </header>

      <div className="rounded-lg overflow-hidden bg-black">
        {lesson.mux_playback_id ? (
          <VideoPlayer
            playbackId={lesson.mux_playback_id}
            lessonId={lesson.id}
            resumePosition={resumePosition}
            duration={lesson.duration_seconds ?? 0}
          />
        ) : (
          <div className="aspect-video flex items-center justify-center bg-muted">
            <p className="text-sm text-muted-foreground">Video not available</p>
          </div>
        )}
      </div>

      {lesson.transcript && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Transcript
          </h2>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {lesson.transcript}
          </p>
        </section>
      )}

      {clientQuestions.length > 0 && (
        <>
          <Separator />
          <QuizSection
            isLessonComplete={isLessonComplete}
            clientQuestions={clientQuestions}
            lessonId={lesson.id}
          />
        </>
      )}

      <TutorPanel lessonId={lesson.id} initialMessages={initialMessages} />
    </main>
  )
}
