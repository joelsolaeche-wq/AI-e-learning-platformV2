import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateJSON } from '@/lib/ai/model'
import { z } from 'zod'
import { UUID_RE } from '@/lib/constants/regex'
import {
  AI_LAB_DRAFT_TRANSCRIPT_MAX_CHARS,
  AI_LAB_DRAFT_MAX_OUTPUT_TOKENS,
} from '@/lib/constants/limits'

const RubricItemSchema = z.object({
  criterion: z.string().min(2).max(200),
  description: z.string().min(2).max(1000),
  weight: z.number().int().min(1).max(5),
})

const DraftSchema = z.object({
  title: z.string().min(2).max(200),
  brief: z.string().min(2).max(8000),
  items: z.array(RubricItemSchema).min(3).max(8),
})

// POST /api/admin/labs/draft  body: { lessonId }
// Returns { title, brief, items[] } generated from the lesson transcript.
// Admin always edits before save — this is suggestion only.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { lessonId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const lessonId = body.lessonId
  if (!lessonId || !UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: lesson, error } = await admin
    .from('lessons')
    .select('id, title, transcript')
    .eq('id', lessonId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  if (!lesson.transcript || lesson.transcript.trim().length < 100) {
    return NextResponse.json(
      { error: 'Lesson has no transcript yet. Run ingest-transcript first.' },
      { status: 400 },
    )
  }

  const transcriptSlice = String(lesson.transcript).slice(0, AI_LAB_DRAFT_TRANSCRIPT_MAX_CHARS)

  const systemPrompt = `You design hands-on coding labs for an enterprise AI engineering curriculum. Given a lesson transcript, propose:
- A short lab title (≤80 chars).
- A markdown brief that gives the learner a concrete coding task they can complete in 1–3 hours, grounded in the lesson content. Include "What you'll build", "Requirements", and "How to submit" sections.
- 4 to 6 rubric items the AI evaluator will use to grade the learner's GitHub submission. Each item needs a short criterion (≤80 chars) and a description that defines what 3-star excellence looks like and what disqualifies a submission. Weight 1 = nice-to-have, 5 = must-have. Most items should be weight 2–3.

Rules:
- Lab must require code in a public GitHub repo (no Jupyter notebooks, no Google Docs).
- Stay within the scope of what the transcript covers — do not invent topics.
- Avoid criteria that depend on subjective taste; prefer ones an AI evaluator can verify by reading the repo (file structure, presence of tests, README quality, code clarity, error handling).`

  const userPrompt = `Lesson title: ${lesson.title}

Lesson transcript (first ${AI_LAB_DRAFT_TRANSCRIPT_MAX_CHARS} chars):
"""
${transcriptSlice}
"""

Generate the lab spec now.`

  const schemaHint = `{
  "title": string (2-200 chars),
  "brief": string (2-8000 chars, markdown with sections),
  "items": array (3-8 elements) of {
    "criterion": string (2-200 chars),
    "description": string (2-1000 chars),
    "weight": integer (1-5)
  }
}`

  try {
    const parsed = await generateJSON({
      schema: DraftSchema,
      schemaHint,
      system: systemPrompt,
      prompt: userPrompt,
      // 8000-char brief (~2000 tok) + up to 8 items × 1000-char descriptions
      // (~250 tok each = up to 2000 tok) + title + JSON envelope. 6000 leaves
      // headroom so the model never truncates mid-JSON.
      maxTokens: AI_LAB_DRAFT_MAX_OUTPUT_TOKENS,
    })

    return NextResponse.json({
      title: parsed.title,
      brief: parsed.brief,
      items: parsed.items,
    })
  } catch (e) {
    console.error('[labs/draft] generateJSON failed', {
      message: e instanceof Error ? e.message : String(e),
      cause: e instanceof Error ? e.cause : undefined,
    })
    const msg = e instanceof Error ? e.message : 'Unknown error drafting lab.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
