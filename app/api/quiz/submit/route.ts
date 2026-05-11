import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check — returns 401 if no valid session.
  // Uses @/lib/supabase/server (NOT @supabase/auth-helpers-nextjs — forbidden per CLAUDE.md)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { lessonId?: string; answers?: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lessonId, answers } = body

  // CR-02: Validate lessonId is a proper UUID before using in DB queries.
  // PostgREST returns HTTP errors (not null) for malformed UUID predicates;
  // those errors are swallowed by maybeSingle() — validate early to prevent
  // silent gate bypasses and error-masking.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!lessonId || !UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
  }

  // CR-04: Array.isArray check — typeof [] === 'object', so arrays bypass the
  // typeof-only guard. Persisting an array into a jsonb object column corrupts
  // the attempt record and breaks audit/replay logic.
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return NextResponse.json(
      { error: 'Missing required fields: lessonId and answers are required' },
      { status: 400 }
    )
  }

  // CR-01: Enrollment authorization — verify user is enrolled in a cohort whose
  // course contains this lesson, piggybacking on the enrollment-scoped lessons
  // RLS from migration 00004. If RLS blocks the row, data is null → 403.
  const { data: enrollmentAuth, error: enrollmentAuthError } = await supabase
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .maybeSingle()

  if (enrollmentAuthError) {
    console.error('[quiz submit] enrollment auth query error', enrollmentAuthError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!enrollmentAuth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Server-side lesson completion gate.
  // Re-check DB — never trust the client's claim that lesson is complete.
  // T-5-03 mitigation: client sending isComplete=true in body is ignored.
  // NOTE: as unknown as T | null — PostgREST 14.5 schema inference workaround (STATE.md)
  // CR-03: Destructure error and return 500 on query failure — prevents silent gate bypass.
  type ProgressRow = { completed: boolean }
  const { data: rawProgress, error: progressError } = await supabase
    .from('lesson_progress')
    .select('completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (progressError) {
    console.error('[quiz submit] lesson_progress query error', progressError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  const progress = rawProgress as unknown as ProgressRow | null

  if (!progress?.completed) {
    return NextResponse.json({ error: 'Lesson not completed' }, { status: 403 })
  }

  // Fetch full quiz definition including correct_answer — server only, never sent to client.
  // T-5-01 mitigation layer 2: quiz_definitions only fetched in server context.
  // CR-03: Destructure error on this query too.
  type QuizDefRow = { id: string; questions: unknown }
  const { data: rawDef, error: defError } = await supabase
    .from('quiz_definitions')
    .select('id, questions')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (defError) {
    console.error('[quiz submit] quiz_definitions query error', defError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  const def = rawDef as unknown as QuizDefRow | null

  if (!def) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  // Score server-side: compare submitted answers against DB correct_answer values.
  // T-5-04: score is computed here, not from client-submitted score.
  type QuizQuestion = {
    id: string
    question: string
    options: string[]
    correct_answer: string
  }
  const questions = def.questions as QuizQuestion[]

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'Quiz has no questions' }, { status: 422 })
  }

  const breakdown = questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    options: q.options,
    selectedAnswer: answers[q.id] ?? null,
    correctAnswer: q.correct_answer,
    correct: answers[q.id] === q.correct_answer,
  }))

  const score = breakdown.filter((b) => b.correct).length
  const total = questions.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0

  // Look up cohort_id via a two-step sequential lookup so PostgREST can
  // actually execute both queries. The single-step deep-join filter
  // (.eq('cohorts.modules.lessons.id', lessonId)) is silently ignored by
  // PostgREST and returns the wrong cohort for multi-enrolled users.
  //
  // Step 1: resolve the course_id containing this lesson.
  type LessonModuleRow = { modules: { course_id: string } }
  const { data: lessonModule } = await supabase
    .from('lessons')
    .select('modules!inner(course_id)')
    .eq('id', lessonId)
    .maybeSingle()
  const courseId = (lessonModule as unknown as LessonModuleRow | null)?.modules?.course_id ?? null

  // Step 2: find the active enrollment for that specific course.
  type EnrollmentRow = { cohort_id: string }
  type CohortRow = { id: string }
  const { data: rawEnrollment, error: enrollError } = courseId
    ? await (async () => {
        const { data: cohortRows } = await supabase
          .from('cohorts')
          .select('id')
          .eq('course_id', courseId)
        const cohortIds = ((cohortRows ?? []) as unknown as CohortRow[]).map((r) => r.id)
        if (cohortIds.length === 0) return { data: null, error: null }
        // limit(1) is load-bearing: a learner may hold multiple active
        // enrollments for the same course (different cohorts). Without it,
        // maybeSingle() errors on >1 row, the cohort_id falls back to null,
        // and the attempt is recorded without its cohort linkage.
        return supabase
          .from('enrollments')
          .select('cohort_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('cohort_id', cohortIds)
          .limit(1)
          .maybeSingle()
      })()
    : { data: null, error: null }

  if (enrollError) {
    console.error('[quiz submit] enrollment cohort lookup error', enrollError)
  }
  const cohortId = (rawEnrollment as unknown as EnrollmentRow | null)?.cohort_id ?? null

  // Persist attempt — multiple attempts per (user_id, lesson_id) are allowed (retake = new row).
  // NOTE: as never cast — PostgREST 14.5 / Supabase v2.105.x schema inference workaround (STATE.md).
  const insertData = {
    user_id: user.id,
    lesson_id: lessonId,
    cohort_id: cohortId,
    answers: answers as Record<string, string>,
    score,
    max_score: total,
  }

  const { error: insertError } = await supabase
    .from('quiz_attempts')
    .insert(insertData as never)

  if (insertError) {
    console.error('[quiz submit] quiz_attempts insert error', insertError)
    return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 })
  }

  // Return full result in one response — no second round trip needed (QUIZ-03).
  // Note: breakdown.correctAnswer IS returned here (post-submit results reveal).
  // The answer key is NOT returned in the quiz questions fetch (Plan 03 Server Component strips it).
  return NextResponse.json({ score, total, pct, breakdown })
}
