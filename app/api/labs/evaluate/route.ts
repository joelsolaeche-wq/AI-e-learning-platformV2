import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { calculateWeightedScore, calculateStars } from '@/lib/lab-utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Bump timeout so the generateText call has room on Vercel (default 10s Hobby, 60s Pro)
export const maxDuration = 90

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { submissionId?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { submissionId } = body
  if (!submissionId || !UUID_RE.test(submissionId)) {
    return NextResponse.json({ error: 'Invalid submissionId' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load submission + lab + criteria
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submission } = await (admin as any)
    .from('lab_submissions')
    .select('id, user_id, status, submission_text, submission_url, lab_id')
    .eq('id', submissionId)
    .single()

  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  // Allow owner OR admin to trigger evaluation
  const isOwner = submission.user_id === user.id
  if (!isOwner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (submission.status === 'evaluating') return NextResponse.json({ error: 'Already evaluating' }, { status: 409 })
  if (submission.status === 'evaluated') return NextResponse.json({ error: 'Already evaluated' }, { status: 409 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lab } = await (admin as any)
    .from('labs')
    .select('id, title, description, context_instructions, passing_score')
    .eq('id', submission.lab_id)
    .single()

  if (!lab) return NextResponse.json({ error: 'Lab not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: criteria } = await (admin as any)
    .from('lab_criteria')
    .select('id, name, description, weight, position')
    .eq('lab_id', lab.id)
    .order('position')

  if (!criteria || criteria.length === 0) {
    return NextResponse.json({ error: 'Lab has no criteria' }, { status: 422 })
  }

  // Mark as evaluating
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('lab_submissions').update({ status: 'evaluating' }).eq('id', submissionId)

  const submissionContent = [
    submission.submission_text ? `Submission text:\n${submission.submission_text}` : null,
    submission.submission_url ? `Submission URL: ${submission.submission_url}` : null,
  ].filter(Boolean).join('\n\n')

  const criteriaList = criteria
    .map((c: { id: string; name: string; description?: string; weight: number }) =>
      `- ID: ${c.id} | Name: ${c.name}${c.description ? ' — ' + c.description : ''} (weight: ${c.weight})`
    )
    .join('\n')

  const contextSection = lab.context_instructions
    ? `\n\nEvaluator context:\n${lab.context_instructions}`
    : ''

  const systemPrompt = `You are an AI evaluator for a hands-on lab titled "${lab.title}".
${lab.description ? `\nLab description: ${lab.description}` : ''}${contextSection}

Your task is to evaluate the learner's submission against each criterion and produce a score (0–100) with feedback.

Evaluation criteria (use the EXACT ID values in your tool call):
${criteriaList}

Rules:
- Use the exact criteria_id UUID strings listed above — do not modify them.
- Score each criterion from 0 to 100.
- Be fair, specific, and constructive.
- If a criterion score is below 60, add a concrete suggestion for improvement.

Call the evaluate_submission tool with all ${criteria.length} criterion evaluations.`

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

  type EvalInput = {
    evaluations: Array<{
      criteria_id: string
      score: number
      feedback: string
      suggestion?: string
    }>
  }

  let evalInput: EvalInput | null = null

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: systemPrompt,
      messages: [{ role: 'user', content: submissionContent }],
      tools: {
        evaluate_submission: tool({
          description: 'Report evaluation scores and feedback for each criterion',
          parameters: z.object({
            evaluations: z.array(z.object({
              criteria_id: z.string().describe('The criterion ID exactly as provided'),
              score: z.number().min(0).max(100).describe('Score from 0 to 100'),
              feedback: z.string().describe('Specific, constructive feedback for this criterion'),
              suggestion: z.string().optional().describe('Improvement suggestion (required if score < 60)'),
            })),
          }),
          execute: async (input) => {
            evalInput = input as EvalInput
            return { received: true }
          },
        }),
      },
      toolChoice: 'required',
      maxSteps: 2,
    })

    void result
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('lab_submissions').update({ status: 'pending' }).eq('id', submissionId)
    console.error('[lab evaluate] Claude error', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 500 })
  }

  if (!evalInput) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('lab_submissions').update({ status: 'pending' }).eq('id', submissionId)
    return NextResponse.json({ error: 'No evaluation produced' }, { status: 500 })
  }

  const evals = (evalInput as EvalInput).evaluations

  const criteriaMap = new Map(criteria.map((c: { id: string; weight: number }) => [c.id, c]))
  const rows = evals
    .filter((e: { criteria_id: string }) => criteriaMap.has(e.criteria_id))
    .map((e: { criteria_id: string; score: number; feedback: string; suggestion?: string }) => ({
      submission_id: submissionId,
      criteria_id: e.criteria_id,
      score: Math.round(Math.min(100, Math.max(0, e.score))),
      feedback: e.feedback,
      suggestion: e.suggestion || null,
    }))

  if (rows.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('lab_submissions').update({ status: 'pending' }).eq('id', submissionId)
    return NextResponse.json({ error: 'Criteria ID mismatch in AI response' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: evalInsertErr } = await (admin as any)
    .from('lab_evaluations')
    .insert(rows)

  if (evalInsertErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('lab_submissions').update({ status: 'pending' }).eq('id', submissionId)
    return NextResponse.json({ error: evalInsertErr.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('lab_submissions').update({ status: 'evaluated' }).eq('id', submissionId)

  const criterionEvals = rows.map((r: { criteria_id: string; score: number }) => ({
    criteria_id: r.criteria_id,
    score: r.score,
    weight: (criteriaMap.get(r.criteria_id) as { weight: number }).weight,
  }))
  const weightedScore = calculateWeightedScore(criterionEvals)
  const stars = calculateStars(weightedScore)

  return NextResponse.json({ success: true, weightedScore, stars, evaluations: rows })
}
