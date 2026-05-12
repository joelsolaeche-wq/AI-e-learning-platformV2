import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateSubmission } from '@/lib/labs/evaluate'
import { UUID_RE } from '@/lib/constants/regex'
import { LAB_TEXT_MIN_CHARS, LAB_TEXT_MAX_CHARS } from '@/lib/constants/limits'

const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/

// Bumped because we run evaluation synchronously in this handler.
export const maxDuration = 90

// POST /api/labs/submit
//   body: { lessonId, submissionType: 'github' | 'pdf' | 'text', githubUrl?, pdfPath?, textContent? }
//   (legacy clients may still send { lessonId, githubUrl } — we infer github type)
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    lessonId?: string
    submissionType?: string
    githubUrl?: string
    pdfPath?: string
    textContent?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const lessonId = body.lessonId
  if (!lessonId || !UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
  }

  // Resolve submissionType (default to 'github' for legacy callers that
  // only sent githubUrl).
  const rawType = body.submissionType ?? (body.githubUrl ? 'github' : null)
  if (rawType !== 'github' && rawType !== 'pdf' && rawType !== 'text') {
    return NextResponse.json(
      { error: 'submissionType must be one of: github, pdf, text.' },
      { status: 400 },
    )
  }

  // Validate the type-specific payload and prepare the row fields.
  const insertFields: {
    github_url: string | null
    pdf_path: string | null
    text_content: string | null
    submission_type: 'github' | 'pdf' | 'text'
  } = {
    github_url: null,
    pdf_path: null,
    text_content: null,
    submission_type: rawType,
  }

  if (rawType === 'github') {
    const githubUrl = (body.githubUrl ?? '').trim()
    if (!GITHUB_URL_RE.test(githubUrl)) {
      return NextResponse.json(
        { error: 'githubUrl must be a public GitHub repo URL (https://github.com/owner/repo).' },
        { status: 400 },
      )
    }
    insertFields.github_url = githubUrl
  } else if (rawType === 'pdf') {
    const pdfPath = (body.pdfPath ?? '').trim()
    // Must be the path returned by /api/labs/upload, namespaced under this user.
    if (!pdfPath || !pdfPath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: 'pdfPath is missing or not owned by you. Re-upload via /api/labs/upload.' },
        { status: 400 },
      )
    }
    insertFields.pdf_path = pdfPath
  } else {
    // text
    const text = (body.textContent ?? '').trim()
    if (text.length < LAB_TEXT_MIN_CHARS) {
      return NextResponse.json(
        { error: `Written response must be at least ${LAB_TEXT_MIN_CHARS} characters.` },
        { status: 400 },
      )
    }
    if (text.length > LAB_TEXT_MAX_CHARS) {
      return NextResponse.json(
        { error: `Written response too long (max ${LAB_TEXT_MAX_CHARS} chars).` },
        { status: 400 },
      )
    }
    insertFields.text_content = text
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

  // limit(1) is load-bearing: a learner may hold multiple active enrollments
  // for the same course (different cohorts). Without it, maybeSingle() errors
  // on >1 row and returns data:null → spurious 403.
  type EnrollmentRow = { id: string; cohort_id: string }
  const { data: enrollment } =
    cohortIds.length > 0
      ? await supabase
          .from('enrollments')
          .select('id, cohort_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('cohort_id', cohortIds)
          .limit(1)
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

  // Insert the submission row. RLS verifies auth.uid() = user_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('lab_submissions')
    .insert({
      user_id: user.id,
      lab_id: labRow.id,
      cohort_id: enrollmentRow.cohort_id,
      ...insertFields,
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

  // Sync evaluation. Caller blocks ~30–90s; evaluator catches its own errors
  // and persists 'failed' state so the row is always usable post-call.
  const evalResult = await evaluateSubmission(inserted.id)

  return NextResponse.json({
    submissionId: inserted.id,
    submittedAt: inserted.submitted_at,
    evaluated: evalResult.ok,
    evalError: evalResult.ok ? null : evalResult.error,
  })
}
