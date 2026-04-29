import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { TablesInsert } from '@/lib/database.types'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check — returns 401 if no valid session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: {
    lessonId?: string
    position?: number
    duration?: number
    completed?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lessonId, position, duration, completed } = body

  if (!lessonId || position === undefined || position === null) {
    return NextResponse.json(
      { error: 'Missing required fields: lessonId and position are required' },
      { status: 400 }
    )
  }

  // WR-06: Validate UUID format early — malformed lessonId causes PostgREST to
  // return a query error which maps to a misleading 403. Return 400 instead.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
  }

  if (typeof position !== 'number' || position < 0) {
    return NextResponse.json(
      { error: 'position must be a non-negative number' },
      { status: 400 }
    )
  }

  // Enrollment check via RLS on lessons table.
  // Migration 20260428000004 restricts lessons SELECT to enrolled users only.
  // If this query returns no row, the user is either not enrolled or the lesson
  // does not exist — both cases should 403.
  //
  // NOTE: `as unknown as LessonRow | null` cast is the established workaround
  // for PostgREST 14.5 / Supabase v2.105.x schema inference returning `never`
  // for complex multi-column selects (same pattern as enrollment.actions.ts).
  type LessonRow = { id: string; duration_seconds: number | null }
  const { data: rawLesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, duration_seconds')
    .eq('id', lessonId)
    .maybeSingle()
  const lesson = rawLesson as unknown as LessonRow | null

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine completion: explicit flag OR 90% threshold
  const effectiveDuration =
    typeof duration === 'number' && duration > 0
      ? duration
      : (lesson.duration_seconds ?? 0)

  const pct = effectiveDuration > 0 ? position / effectiveDuration : 0
  const isCompleted = completed === true || pct >= 0.9

  // Upsert lesson_progress — unique constraint: (user_id, lesson_id)
  // NOTE: `as never` cast is the established workaround for PostgREST 14.5 /
  // Supabase v2.105.x schema inference (same pattern as enrollment.actions.ts).
  const now = new Date().toISOString()
  const upsertData: TablesInsert<'lesson_progress'> = {
    user_id: user.id,
    lesson_id: lessonId,
    last_position: Math.round(position),
    completed: isCompleted,
    updated_at: now,
    completed_at: isCompleted ? now : null,
  }

  const { error: upsertError } = await supabase
    .from('lesson_progress')
    .upsert(upsertData as never, { onConflict: 'user_id,lesson_id' })

  if (upsertError) {
    console.error('[progress API] lesson_progress upsert error', upsertError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, completed: isCompleted })
}
