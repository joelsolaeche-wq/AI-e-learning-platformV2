import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import type { Message } from 'ai'
import { TutorPanel } from '@/components/TutorPanel'
import { LessonExperience } from '@/components/LessonExperience'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LessonRow = Pick<
  Database['public']['Tables']['lessons']['Row'],
  'id' | 'title' | 'module_id' | 'mux_playback_id' | 'duration_seconds' | 'transcript'
>

type ProgressRow = Pick<
  Database['public']['Tables']['lesson_progress']['Row'],
  'last_position' | 'completed'
>

// answer-key-stripped shape — never sent to client (QUIZ-02)
type ClientQuestion = {
  id: string
  question: string
  options: string[]
}

type RawQuizQuestion = ClientQuestion & {
  correct_answer: string
  explanation?: string
}

type RawQuizDef = { questions: unknown }

type ChatMessageRow = {
  id: string
  role: string
  content: string
  created_at: string
}

type ModuleLessonRow = {
  id: string
  title: string
  position: number
  duration_seconds: number | null
}

type UserProgressRow = { lesson_id: string; completed: boolean }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface LessonPageProps {
  params: Promise<{ lessonId: string }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Phase 1: lesson (with module join) + current-lesson progress + quiz + chat history
  const [lessonResult, progressResult, quizResult, chatHistory] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, title, module_id, mux_playback_id, duration_seconds, transcript, modules(id, title)',
      )
      .eq('id', lessonId)
      .single(),
    supabase
      .from('lesson_progress')
      .select('last_position, completed')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    supabase.from('quiz_definitions').select('questions').eq('lesson_id', lessonId).maybeSingle(),
    (async (): Promise<ChatMessageRow[]> => {
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

      if (msgsError) console.error('[lesson page] ai_chat_messages fetch error', msgsError)
      return (messagesData ?? []) as unknown as ChatMessageRow[]
    })(),
  ])

  const rawLesson = lessonResult.data
  if (lessonResult.error || !rawLesson) notFound()

  const lesson = rawLesson as LessonRow & { modules: { id: string; title: string } | null }
  const progress = progressResult.data as unknown as ProgressRow | null
  const isLessonComplete = progress?.completed ?? false
  const resumePosition = progress?.last_position ?? 0

  // Strip correct_answer before passing to client (QUIZ-02 / T-5-01)
  const quizDef = quizResult.data as unknown as RawQuizDef | null
  const rawQuestions = (quizDef?.questions ?? []) as RawQuizQuestion[]
  const clientQuestions: ClientQuestion[] = rawQuestions.map(({ id, question, options }) => ({
    id,
    question,
    options,
  }))

  // Build initialMessages for TutorPanel
  const initialMessages: Message[] = (chatHistory as ChatMessageRow[]).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    createdAt: new Date(m.created_at),
  }))

  // Phase 2: all lessons in this module + user's lesson progress
  // (needs lesson.module_id from phase 1)
  const [moduleLessonsResult, userProgressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, position, duration_seconds')
      .eq('module_id', lesson.module_id)
      .order('position'),
    supabase.from('lesson_progress').select('lesson_id, completed').eq('user_id', user.id),
  ])

  const rawModuleLessons = (moduleLessonsResult.data ?? []) as ModuleLessonRow[]
  const progressMap = new Map<string, boolean>(
    ((userProgressResult.data ?? []) as UserProgressRow[]).map((r) => [r.lesson_id, r.completed]),
  )
  const moduleLessons = rawModuleLessons.map((ml) => ({
    ...ml,
    completed: progressMap.get(ml.id) ?? false,
  }))

  const moduleTitle = lesson.modules?.title ?? 'Module'

  return (
    <>
      <LessonExperience
        lesson={lesson}
        moduleTitle={moduleTitle}
        resumePosition={resumePosition}
        isLessonComplete={isLessonComplete}
        clientQuestions={clientQuestions}
        moduleLessons={moduleLessons}
      />
      {/* TutorPanel with lessonId context overlays the global layout panel */}
      <TutorPanel lessonId={lesson.id} initialMessages={initialMessages} />
    </>
  )
}
