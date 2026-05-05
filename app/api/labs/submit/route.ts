import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateSubmission } from '@/lib/labs/evaluate'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/

// Bumped because we run evaluation synchronously in this handler.
export const maxDuration = 90

// POST /api/labs/submit  body: { lessonId, githubUrl }
// Verifies enrollment, finds the lab for this lesson, inserts a
// lab_submissions row with status='pending'. Phase B leaves the row
// in pending — Phase C wires this handler to call the evaluator.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { lessonId?: string; githubUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const lessonId = body.lessonId
  const githubUrl = (body.githubUrl ?? '').trim()
  if (!lessonId || !UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
  }
  if (!GITHUB_URL_RE.test(githubUrl)) {
    return NextResponse.json(
      { error: 'githubUrl must be a public GitHub repo URL (https://github.com/owner/repo).' },
      { status: 400 },
    )
  }

  // Resolve lesson → module → course (mirror tutor enrollment check).
  type LessonRow = { id: string; module_id: string }
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, module_id')
    .eq('id', lessonId)
    .maybeSingle()
  if (!lesson) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const lessonRow = lesson as unknown as LessonRow

  type ModuleRow = { course_id: string }
  const { data: moduleData } = await supabase
    .from('modules')
    .select('course_id')
    .eq('id', lessonRow.module_id)
    .maybeSingle()
  const courseId = (moduleData as unknown as ModuleRow | null)?.course_id ?? null

  type CohortRow = { id: string }
  const cohortIds: string[] = []
  if (courseId) {
    const { data: cohortData } = await supabase
      .from('cohorts')
      .select('id')
      .eq('course_id', courseId)
    cohortIds.push(...((cohortData ?? []) as unknown as CohortRow[]).map((r) => r.id))
  }

  type EnrollmentRow = { id: string; cohort_id: string }
  const { data: enrollment } =
    cohortIds.length > 0
      ? await supabase
          .from('enrollments')
          .select('id, cohort_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('cohort_id', cohortIds)
          .maybeSingle()
      : { data: null }

  if (!enrollment) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const enrollmentRow = enrollment as unknown as EnrollmentRow

  // Find the lab for this lesson.
  type LabRow = { id: string }
  const { data: lab } = await supabase
    .from('labs')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()
  if (!lab) {
    return NextResponse.json(
      { error: 'No lab is configured for this lesson yet.' },
      { status: 404 },
    )
  }
  const labRow = lab as unknown as LabRow

  // Insert the submission row. We use the user-scoped client (not admin) so
  // RLS verifies auth.uid() = user_id, but writing user_id explicitly so the
  // insert policy is satisfied. status defaults to 'pending'.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('lab_submissions')
    .insert({
      user_id: user.id,
      lab_id: labRow.id,
      cohort_id: enrollmentRow.cohort_id,
      github_url: githubUrl,
      status: 'pending',
    })
    .select('id, status, submitted_at')
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to insert submission.' },
      { status: 500 },
    )
  }

  // Sync evaluation. Caller blocks ~30–60s; evaluator catches its own errors
  // and persists 'failed' state so the row is always usable post-call. The
  // result is informational only — the client refreshes the lesson page after
  // submit and reads the row back.
  const evalResult = await evaluateSubmission(inserted.id)

  return NextResponse.json({
    submissionId: inserted.id,
    submittedAt: inserted.submitted_at,
    evaluated: evalResult.ok,
    evalError: evalResult.ok ? null : evalResult.error,
  })
}
