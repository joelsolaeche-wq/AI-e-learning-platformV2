import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateSubmission } from '@/lib/labs/evaluate'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Vercel function timeout. Default is 10s on Hobby — bump to 90s so the
// generateObject call has room. (Pro is 60s default, Enterprise is 900s.)
export const maxDuration = 90

// POST /api/labs/evaluate  body: { submissionId }
//
// Authorization: must be the owner of the submission OR an admin. Owner case
// is the typical "auto-trigger from submit" path; admin case is for retrying
// a failed evaluation. Service-role tooling can bypass and call
// `evaluateSubmission(id)` directly without going through this route.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { submissionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const submissionId = body.submissionId
  if (!submissionId || !UUID_RE.test(submissionId)) {
    return NextResponse.json({ error: 'Invalid submissionId' }, { status: 400 })
  }

  // Authorization: owner or admin. We use service_role to look up the
  // submission's owner because RLS on lab_submissions only lets a user see
  // their own rows — that's correct, but we explicitly want to check
  // ownership before letting evaluateSubmission run.
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submission } = await (admin as any)
    .from('lab_submissions')
    .select('id, user_id')
    .eq('id', submissionId)
    .maybeSingle()
  if (!submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let allowed = (submission as { user_id: string }).user_id === user.id
  if (!allowed) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role === 'admin') allowed = true
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await evaluateSubmission(submissionId)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, submissionId, error: result.error },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, submissionId })
}
