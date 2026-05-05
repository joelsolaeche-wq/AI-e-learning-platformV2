import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cap the slice of transcript we feed the model. 24k chars is roughly
// 6k tokens — enough for a 30-min lesson once whitespace-collapsed, well
// under context limits, keeps cost ≪ $0.05 per draft.
const MAX_TRANSCRIPT_CHARS = 24_000

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson, error } = await (admin as any)
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

  const transcriptSlice = String(lesson.transcript).slice(0, MAX_TRANSCRIPT_CHARS)

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

  const systemPrompt = `You design hands-on coding labs for an enterprise AI engineering curriculum. Given a lesson transcript, propose:
- A short lab title (≤80 chars).
- A markdown brief that gives the learner a concrete coding task they can complete in 1–3 hours, grounded in the lesson content. Include "What you'll build", "Requirements", and "How to submit" sections.
- 4 to 6 rubric items the AI evaluator will use to grade the learner's GitHub submission. Each item needs a short criterion (≤80 chars) and a description that defines what 3-star excellence looks like and what disqualifies a submission. Weight 1 = nice-to-have, 5 = must-have. Most items should be weight 2–3.

Rules:
- Lab must require code in a public GitHub repo (no Jupyter notebooks, no Google Docs).
- Stay within the scope of what the transcript covers — do not invent topics.
- Avoid criteria that depend on subjective taste; prefer ones an AI evaluator can verify by reading the repo (file structure, presence of tests, README quality, code clarity, error handling).`

  const userPrompt = `Lesson title: ${lesson.title}

Lesson transcript (first ${MAX_TRANSCRIPT_CHARS} chars):
"""
${transcriptSlice}
"""

Generate the lab spec now.`

  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: DraftSchema,
      system: systemPrompt,
      prompt: userPrompt,
    })

    // ai@4.3 typings infer Zod 3 schemas but we're on Zod 4, so the result
    // comes back as `unknown`. Schema validation already happened inside
    // generateObject, so the cast is sound.
    const parsed = object as z.infer<typeof DraftSchema>

    return NextResponse.json({
      title: parsed.title,
      brief: parsed.brief,
      items: parsed.items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error drafting lab.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
