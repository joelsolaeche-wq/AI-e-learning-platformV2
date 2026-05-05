// lib/labs/evaluate.ts
//
// Synchronous lab evaluator. Pulls a public GitHub repo snapshot, asks Claude
// for per-criterion 1–3 star scores + feedback, persists everything via
// service_role (lab_submissions has no UPDATE policy for learners — by design).

import { createAdminClient } from '@/lib/supabase/admin'
import { generateJSON } from '@/lib/ai/model'
import { z } from 'zod'
import { fetchPublicRepoSnapshot, type GitHubFetchError } from '@/lib/github/fetch-repo'

// 90s ceiling for the model call. The route handler should also have
// `export const maxDuration = 90` so Vercel doesn't kill us early.
const EVAL_TIMEOUT_MS = 90_000
const MAX_TRANSCRIPT_CHARS = 12_000 // grading prompt is dominated by the repo snapshot
const REPO_SNAPSHOT_CHAR_BUDGET = 120_000 // leaves headroom for prompt + JSON

export type EvaluateResult =
  | { ok: true; submissionId: string }
  | { ok: false; submissionId: string; error: string }

const PerItemScoreSchema = z.object({
  rubricItemId: z.string().uuid(),
  stars: z.number().int().min(1).max(3),
  feedback: z.string().min(1).max(1500),
})

const EvalSchema = z.object({
  items: z.array(PerItemScoreSchema).min(1),
  overallStars: z.number().int().min(1).max(3),
  summary: z.string().min(1).max(2000),
})

// -------------------------------------------------------------------------
// Public entrypoint. Caller is responsible for authorization — this function
// trusts that the submissionId belongs to a request the caller is allowed
// to act on.
// -------------------------------------------------------------------------
export async function evaluateSubmission(submissionId: string): Promise<EvaluateResult> {
  const admin = createAdminClient()

  // 1. Load submission + lab + rubric + lesson context (service_role bypasses RLS).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submissionRaw, error: subErr } = await (admin as any)
    .from('lab_submissions')
    .select('id, lab_id, github_url, status')
    .eq('id', submissionId)
    .maybeSingle()
  if (subErr || !submissionRaw) {
    return { ok: false, submissionId, error: subErr?.message ?? 'Submission not found.' }
  }
  const submission = submissionRaw as {
    id: string
    lab_id: string
    github_url: string
    status: string
  }

  // Idempotency: don't re-evaluate something already in flight or already done.
  // (Caller can manually flip status back to 'pending' to retry a 'failed' row.)
  if (submission.status === 'evaluating' || submission.status === 'scored') {
    return { ok: false, submissionId, error: `Already ${submission.status}.` }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: labRaw } = await (admin as any)
    .from('labs')
    .select('id, title, brief_md, lesson_id')
    .eq('id', submission.lab_id)
    .maybeSingle()
  const lab = labRaw as {
    id: string
    title: string
    brief_md: string
    lesson_id: string
  } | null
  if (!lab) {
    await markFailed(submissionId, 'Lab no longer exists.')
    return { ok: false, submissionId, error: 'Lab no longer exists.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rubricRaw } = await (admin as any)
    .from('lab_rubric_items')
    .select('id, position, criterion, description, weight')
    .eq('lab_id', lab.id)
    .order('position', { ascending: true })
  type RubricItem = {
    id: string
    position: number
    criterion: string
    description: string
    weight: number
  }
  const rubric = (rubricRaw ?? []) as RubricItem[]
  if (rubric.length === 0) {
    await markFailed(submissionId, 'Lab has no rubric items.')
    return { ok: false, submissionId, error: 'Lab has no rubric items.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lessonRaw } = await (admin as any)
    .from('lessons')
    .select('id, title, transcript')
    .eq('id', lab.lesson_id)
    .maybeSingle()
  const lesson = lessonRaw as { title: string; transcript: string | null } | null

  // 2. Mark evaluating BEFORE the slow operations so the UI can reflect it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: markErr } = await (admin as any)
    .from('lab_submissions')
    .update({ status: 'evaluating' })
    .eq('id', submissionId)
  if (markErr) {
    return { ok: false, submissionId, error: `Failed to mark evaluating: ${markErr.message}` }
  }

  try {
    // 3. Fetch a snapshot of the repo.
    const snapshot = await fetchPublicRepoSnapshot(submission.github_url)

    if (snapshot.fetchedFiles.length === 0) {
      await markFailed(submissionId, 'No code-text files were found in this repo.')
      return { ok: false, submissionId, error: 'No code-text files were found in this repo.' }
    }

    // 4. Build the grading prompt.
    const transcriptSlice = (lesson?.transcript ?? '').slice(0, MAX_TRANSCRIPT_CHARS)
    const repoText = renderSnapshotForPrompt(snapshot.fetchedFiles, REPO_SNAPSHOT_CHAR_BUDGET)
    const rubricText = rubric
      .map(
        (r) =>
          `- id: ${r.id}\n  criterion: ${r.criterion}\n  description: ${r.description}\n  weight: ${r.weight}`,
      )
      .join('\n')

    const systemPrompt = `You are a strict but fair AI grader for an enterprise AI engineering curriculum. You grade learners' GitHub repos against an admin-authored rubric.

Rules:
- Score each rubric item from 1 to 3 stars.
  - 3 stars: meets the description's "excellent" bar with clear evidence in the repo.
  - 2 stars: clearly attempts the criterion but has gaps or omissions.
  - 1 star: missing, broken, or trivially satisfied.
- Use the lesson transcript and the lab brief as context for what the learner was supposed to build, but ground every score in evidence from the repo files. Cite specific file paths in your feedback when possible.
- For items at 1 or 2 stars, your feedback MUST include a concrete suggestion the learner can act on.
- For 3-star items, feedback should call out specifically what made the work strong (so the learner knows what to keep doing).
- overallStars must be the rounded weighted average of per-item stars, clamped to 1–3.
- summary is 2–4 sentences: what the learner did well, the highest-leverage thing to improve, and an honest read of overall readiness.

Return ONE rubricItemId per item. The set of rubricItemIds you return must exactly match the rubric provided — no extras, no omissions.`

    const userPrompt = `LESSON: ${lesson?.title ?? '(unknown)'}

LESSON TRANSCRIPT (first ${MAX_TRANSCRIPT_CHARS} chars):
"""
${transcriptSlice}
"""

LAB TITLE: ${lab.title}

LAB BRIEF:
"""
${lab.brief_md}
"""

RUBRIC ITEMS:
${rubricText}

REPO: ${snapshot.owner}/${snapshot.repo} (default branch: ${snapshot.defaultBranch})
${snapshot.truncatedReason ? `[snapshot truncated: ${snapshot.truncatedReason}]` : ''}

REPO CONTENTS:
${repoText}

Grade the repo now.`

    const evalSchemaHint = `{
  "items": array (one entry per rubric item) of {
    "rubricItemId": string (UUID — copy verbatim from the RUBRIC ITEMS list above),
    "stars": integer (1, 2, or 3),
    "feedback": string (1-1500 chars; concrete and actionable)
  },
  "overallStars": integer (1, 2, or 3),
  "summary": string (1-2000 chars; 2-4 sentences)
}`

    const parsed = await Promise.race([
      generateJSON({
        schema: EvalSchema,
        schemaHint: evalSchemaHint,
        system: systemPrompt,
        prompt: userPrompt,
        // Per-item feedback (≤1500 chars × N items, ~6000 tok worst case) +
        // 2000-char summary + JSON envelope. 8000 leaves headroom.
        maxTokens: 8000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Evaluator timed out after ${EVAL_TIMEOUT_MS}ms`)),
          EVAL_TIMEOUT_MS,
        ),
      ),
    ])

    // 5. Validate that the model returned exactly the rubric items we asked
    //    about. If it hallucinated an id or skipped one, fail loudly — the
    //    learner's report would be confusing otherwise.
    const expectedIds = new Set(rubric.map((r) => r.id))
    const returnedIds = new Set(parsed.items.map((i) => i.rubricItemId))
    if (returnedIds.size !== expectedIds.size) {
      throw new Error(
        `Model returned ${returnedIds.size} rubric scores but rubric has ${expectedIds.size}.`,
      )
    }
    for (const id of expectedIds) {
      if (!returnedIds.has(id)) {
        throw new Error(`Model omitted score for rubric item ${id}.`)
      }
    }

    // 6. Compute weighted scores. Stars are 1..3, weight is 1..5.
    const weightById = new Map(rubric.map((r) => [r.id, r.weight]))
    let totalScore = 0
    let maxScore = 0
    for (const it of parsed.items) {
      const w = weightById.get(it.rubricItemId) ?? 1
      totalScore += it.stars * w
      maxScore += 3 * w
    }

    // Trust the model's overallStars only if it's plausible. Otherwise compute
    // from the weighted average so the learner doesn't see a contradiction
    // (e.g. all 3-star items but model says overallStars=2).
    const sumWeight = rubric.reduce((acc, r) => acc + r.weight, 0)
    const computedOverall = Math.max(1, Math.min(3, Math.round(totalScore / sumWeight)))
    const overallStars =
      Math.abs(parsed.overallStars - computedOverall) <= 0
        ? parsed.overallStars
        : computedOverall

    // 7. Persist the per-item scores.
    const scoreRows = parsed.items.map((it) => ({
      submission_id: submissionId,
      rubric_item_id: it.rubricItemId,
      stars: it.stars,
      feedback_md: it.feedback,
    }))
    // Clear any prior scores in case this is a re-evaluation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('lab_submission_scores')
      .delete()
      .eq('submission_id', submissionId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: scoreInsertErr } = await (admin as any)
      .from('lab_submission_scores')
      .insert(scoreRows)
    if (scoreInsertErr) {
      throw new Error(`Failed to persist scores: ${scoreInsertErr.message}`)
    }

    // 8. Persist the submission summary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: finalUpdateErr } = await (admin as any)
      .from('lab_submissions')
      .update({
        status: 'scored',
        overall_stars: overallStars,
        total_score: totalScore,
        max_score: maxScore,
        summary_md: parsed.summary,
        error_message: null,
        scored_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
    if (finalUpdateErr) {
      throw new Error(`Failed to update submission: ${finalUpdateErr.message}`)
    }

    return { ok: true, submissionId }
  } catch (e) {
    let msg: string
    if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
      const err = e as GitHubFetchError
      msg = `[${err.code}] ${err.message}`
    } else if (e instanceof Error) {
      msg = e.message
    } else {
      msg = 'Unknown evaluator error.'
    }
    await markFailed(submissionId, msg)
    return { ok: false, submissionId, error: msg }
  }
}

async function markFailed(submissionId: string, errorMessage: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('lab_submissions')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 1000),
      scored_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
}

// Render the file snapshot as a single text blob the model can read. Kept
// inline rather than deeply structured because Claude reads code in plain
// text faster than nested JSON, and the path/content fence pattern is what
// the model has seen in training.
function renderSnapshotForPrompt(
  files: Array<{ path: string; size: number; content: string }>,
  charBudget: number,
): string {
  let used = 0
  const blocks: string[] = []
  for (const f of files) {
    const header = `\n--- FILE: ${f.path} (${f.size} bytes) ---\n`
    const block = header + f.content + '\n'
    if (used + block.length > charBudget) {
      // Truncate this last file rather than dropping it entirely — the
      // README and main entry points are early in the list, they should
      // make it through.
      const remaining = Math.max(0, charBudget - used - header.length - 32)
      if (remaining > 256) {
        blocks.push(header + f.content.slice(0, remaining) + '\n[…truncated]\n')
      }
      break
    }
    blocks.push(block)
    used += block.length
  }
  return blocks.join('')
}
