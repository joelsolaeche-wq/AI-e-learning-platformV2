// app/(app)/dashboard/lesson/[lessonId]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import type { Message } from 'ai'
import { LessonExperience } from '@/components/LessonExperience'
import type { CurriculumModule } from '@/components/CurriculumTree'

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
> & {
  // transcript_segments was added in 20260509000001; not yet in regenerated
  // database.types.ts, so widen the row type here.
  transcript_segments: { start: number; text: string }[] | null
}

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
        'id, title, module_id, mux_playback_id, duration_seconds, transcript, transcript_segments, video_source, youtube_id, modules(id, title, course_id, courses(id, title))',
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

  // Fetch lab for this lesson + learner's latest submission.
  // Schema A: labs(brief_md) + lab_rubric_items + lab_submissions(github_url,
  // overall_stars, ...) + lab_submission_scores. See migration
  // 20260504000002_create_labs.sql.
  type LabRubricItemRow = {
    id: string; position: number; criterion: string; description: string; weight: number
  }
  type LabRow = {
    id: string; title: string; brief_md: string
    lab_rubric_items: LabRubricItemRow[]
  }
  type SubmissionRow = {
    id: string
    status: 'pending' | 'evaluating' | 'scored' | 'failed'
    submission_type: 'github' | 'pdf' | 'text'
    github_url: string | null
    pdf_path: string | null
    text_content: string | null
    overall_stars: number | null
    total_score: number
    max_score: number
    summary_md: string | null
    error_message: string | null
    submitted_at: string
    scored_at: string | null
    lab_submission_scores: Array<{ rubric_item_id: string; stars: number; feedback_md: string }>
  }

  // RLS on `labs` permits enrolled users to read; service-role isn't needed
  // here. See migration 20260504000002_create_labs.sql ("Enrolled users can
  // view labs" + "Enrolled users can view lab rubric items").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labResult = await (supabase as any)
    .from('labs')
    .select('id, title, brief_md, lab_rubric_items(id, position, criterion, description, weight)')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  const labRow = (labResult.data as LabRow | null) ?? null
  // Reshape to LabSection's LabData type: rubric_items sorted by position.
  const lab = labRow
    ? {
        id: labRow.id,
        title: labRow.title,
        brief_md: labRow.brief_md,
        rubric_items: [...(labRow.lab_rubric_items ?? [])].sort(
          (a, b) => a.position - b.position,
        ),
      }
    : null

  let latestSubmission: {
    id: string
    status: 'pending' | 'evaluating' | 'scored' | 'failed'
    submission_type: 'github' | 'pdf' | 'text'
    github_url: string | null
    pdf_path: string | null
    text_content: string | null
    overall_stars: number | null
    total_score: number
    max_score: number
    summary_md: string | null
    error_message: string | null
    submitted_at: string
    scored_at: string | null
    scores: Array<{ rubric_item_id: string; stars: number; feedback_md: string }>
  } | null = null
  if (lab) {
    // RLS on `lab_submissions` already restricts each row to its owner
    // ("Users can view their own lab submissions"), so the .eq('user_id',
    // user.id) below is belt-and-suspenders on top of RLS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subResult = await (supabase as any)
      .from('lab_submissions')
      .select(
        'id, status, submission_type, github_url, pdf_path, text_content, overall_stars, total_score, max_score, summary_md, error_message, submitted_at, scored_at, lab_submission_scores(rubric_item_id, stars, feedback_md)',
      )
      .eq('lab_id', lab.id)
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const subRow = (subResult.data as SubmissionRow | null) ?? null
    if (subRow) {
      latestSubmission = {
        id: subRow.id,
        status: subRow.status,
        submission_type: subRow.submission_type,
        github_url: subRow.github_url,
        pdf_path: subRow.pdf_path,
        text_content: subRow.text_content,
        overall_stars: subRow.overall_stars,
        total_score: subRow.total_score,
        max_score: subRow.max_score,
        summary_md: subRow.summary_md,
        error_message: subRow.error_message,
        submitted_at: subRow.submitted_at,
        scored_at: subRow.scored_at,
        scores: subRow.lab_submission_scores ?? [],
      }
    }
  }

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
    <LessonExperience
      lesson={lesson}
      moduleTitle={moduleTitle}
      courseTitle={courseTitle}
      resumePosition={resumePosition}
      isLessonComplete={isLessonComplete}
      clientQuestions={clientQuestions}
      curriculum={curriculum}
      lab={lab}
      latestSubmission={latestSubmission}
      tutorInitialMessages={initialMessages}
    />
  )
}
