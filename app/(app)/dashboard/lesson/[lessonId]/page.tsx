// app/(app)/dashboard/lesson/[lessonId]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import type { Message } from 'ai'
import { TutorPanel } from '@/components/TutorPanel'
import { LessonExperience } from '@/components/LessonExperience'
import type { CurriculumModule } from '@/components/CurriculumTree'
import { LabSection, type LabData, type LabSubmission } from '@/components/LabSection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LessonRow = Pick<
  Database['public']['Tables']['lessons']['Row'],
  | 'id'
  | 'title'
  | 'module_id'
  | 'mux_playback_id'
  | 'duration_seconds'
  | 'transcript'
  | 'video_source'
  | 'youtube_id'
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

type CourseModuleRow = {
  id: string
  title: string
  position: number
  course_id: string
}

type CourseLessonRow = {
  id: string
  title: string
  position: number
  module_id: string
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

  // Phase 1: lesson (with module + course join) + lesson progress + quiz + chat
  const [lessonResult, progressResult, quizResult, chatHistory] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, title, module_id, mux_playback_id, duration_seconds, transcript, video_source, youtube_id, modules(id, title, course_id, courses(id, title))',
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

  type LessonWithJoins = LessonRow & {
    modules: {
      id: string
      title: string
      course_id: string
      courses: { id: string; title: string } | null
    } | null
  }
  const lesson = rawLesson as LessonWithJoins
  const progress = progressResult.data as unknown as ProgressRow | null
  const isLessonComplete = progress?.completed ?? false
  const resumePosition = progress?.last_position ?? 0

  // Strip correct_answer (QUIZ-02 / T-5-01)
  const quizDef = quizResult.data as unknown as RawQuizDef | null
  const rawQuestions = (quizDef?.questions ?? []) as RawQuizQuestion[]
  const clientQuestions: ClientQuestion[] = rawQuestions.map(({ id, question, options }) => ({
    id,
    question,
    options,
  }))

  const initialMessages: Message[] = (chatHistory as ChatMessageRow[]).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    createdAt: new Date(m.created_at),
  }))

  const courseId = lesson.modules?.course_id
  const moduleTitle = lesson.modules?.title ?? 'Module'
  const courseTitle = lesson.modules?.courses?.title ?? null

  // Phase 2: ALL modules + ALL lessons of the parent course (for unified curriculum)
  // + user's lesson progress (own-only via RLS)
  const [allModulesResult, allLessonsResult, userProgressResult] = await Promise.all([
    courseId
      ? supabase
          .from('modules')
          .select('id, title, position, course_id')
          .eq('course_id', courseId)
          .order('position')
      : Promise.resolve({ data: [], error: null }),
    courseId
      ? supabase
          .from('lessons')
          .select('id, title, position, module_id, duration_seconds, modules!inner(course_id)')
          .eq('modules.course_id', courseId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('lesson_progress').select('lesson_id, completed').eq('user_id', user.id),
  ])

  const allModules = (allModulesResult.data ?? []) as CourseModuleRow[]
  const allLessons = (allLessonsResult.data ?? []) as CourseLessonRow[]
  const progressMap = new Map<string, boolean>(
    ((userProgressResult.data ?? []) as UserProgressRow[]).map((r) => [r.lesson_id, r.completed]),
  )

  // ---------------------------------------------------------------------------
  // Lab + latest submission + per-criterion scores
  // RLS gates everything: a learner only sees a lab if they're enrolled in a
  // cohort for its course (see migration 20260504000002), so we don't repeat
  // the enrollment check here.
  // ---------------------------------------------------------------------------
  type LabRow = { id: string; title: string; brief_md: string }
  type RubricItemRow = {
    id: string
    position: number
    criterion: string
    description: string
    weight: number
  }
  type SubmissionRow = {
    id: string
    status: 'pending' | 'evaluating' | 'scored' | 'failed'
    github_url: string
    overall_stars: number | null
    total_score: number
    max_score: number
    summary_md: string | null
    error_message: string | null
    submitted_at: string
    scored_at: string | null
  }
  type ScoreRow = { rubric_item_id: string; stars: number; feedback_md: string }

  const { data: labRowRaw } = await supabase
    .from('labs')
    .select('id, title, brief_md')
    .eq('lesson_id', lessonId)
    .maybeSingle()
  const labRow = labRowRaw as unknown as LabRow | null

  let labData: LabData | null = null
  let latestSubmission: LabSubmission | null = null

  if (labRow) {
    const { data: rubricRows } = await supabase
      .from('lab_rubric_items')
      .select('id, position, criterion, description, weight')
      .eq('lab_id', labRow.id)
      .order('position', { ascending: true })

    const rubric_items = ((rubricRows ?? []) as unknown as RubricItemRow[]).map((r) => ({
      id: r.id,
      position: r.position,
      criterion: r.criterion,
      description: r.description,
      weight: r.weight,
    }))

    labData = {
      id: labRow.id,
      title: labRow.title,
      brief_md: labRow.brief_md,
      rubric_items,
    }

    const { data: subRows } = await supabase
      .from('lab_submissions')
      .select(
        'id, status, github_url, overall_stars, total_score, max_score, summary_md, error_message, submitted_at, scored_at',
      )
      .eq('user_id', user.id)
      .eq('lab_id', labRow.id)
      .order('submitted_at', { ascending: false })
      .limit(1)

    const subs = (subRows ?? []) as unknown as SubmissionRow[]
    if (subs.length > 0) {
      const sub = subs[0]
      const { data: scoreRows } = await supabase
        .from('lab_submission_scores')
        .select('rubric_item_id, stars, feedback_md')
        .eq('submission_id', sub.id)

      latestSubmission = {
        id: sub.id,
        status: sub.status,
        github_url: sub.github_url,
        overall_stars: sub.overall_stars,
        total_score: sub.total_score,
        max_score: sub.max_score,
        summary_md: sub.summary_md,
        error_message: sub.error_message,
        submitted_at: sub.submitted_at,
        scored_at: sub.scored_at,
        scores: ((scoreRows ?? []) as unknown as ScoreRow[]).map((s) => ({
          rubric_item_id: s.rubric_item_id,
          stars: s.stars,
          feedback_md: s.feedback_md,
        })),
      }
    }
  }

  // Group lessons under modules → CurriculumTree shape
  const lessonsByModule = new Map<string, CourseLessonRow[]>()
  for (const l of allLessons) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push(l)
    lessonsByModule.set(l.module_id, arr)
  }

  const curriculum: CurriculumModule[] = allModules
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      title: m.title,
      position: m.position,
      lessons: (lessonsByModule.get(m.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          id: l.id,
          title: l.title,
          position: l.position,
          duration_seconds: l.duration_seconds,
          completed: progressMap.get(l.id) ?? false,
        })),
    }))

  return (
    <>
      <LessonExperience
        lesson={lesson}
        moduleTitle={moduleTitle}
        courseTitle={courseTitle}
        resumePosition={resumePosition}
        isLessonComplete={isLessonComplete}
        clientQuestions={clientQuestions}
        curriculum={curriculum}
        labSection={
          labData ? (
            <LabSection
              lessonId={lesson.id}
              lab={labData}
              latestSubmission={latestSubmission}
            />
          ) : null
        }
      />
      <TutorPanel lessonId={lesson.id} initialMessages={initialMessages} />
    </>
  )
}
