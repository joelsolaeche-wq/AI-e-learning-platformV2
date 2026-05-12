import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { YoutubeTranscript } from 'youtube-transcript'
import { normalizeSegments } from '@/lib/transcript/format'
import { UUID_RE } from '@/lib/constants/regex'
import { TRANSCRIPT_RAW_MAX_CHARS } from '@/lib/constants/limits'

// POST /api/admin/lessons/{lessonId}/ingest-transcript
// Body (optional): { youtube_id?: string, transcript?: string }
//   - If `transcript` is provided, store it verbatim (manual paste fallback).
//   - Else, fetch YouTube captions for `youtube_id` (or the lesson's stored id)
//     and concatenate into lessons.transcript.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: lessonId } = await params

  if (!UUID_RE.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 })
  }

  // Admin gate — same shape as lib/actions/admin.actions.ts:assertAdmin.
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

  let body: { youtube_id?: string; transcript?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is fine — we'll fall back to the lesson's stored youtube_id.
  }

  const admin = createAdminClient()

  // Manual override: caller pasted a transcript directly.
  if (body.transcript && typeof body.transcript === 'string') {
    const trimmed = body.transcript.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'transcript is empty' }, { status: 400 })
    }
    if (trimmed.length > TRANSCRIPT_RAW_MAX_CHARS) {
      return NextResponse.json({ error: 'transcript too long (max 500k chars)' }, { status: 400 })
    }
    // Manual paste has no segment metadata; clear segments so the UI
    // falls back to flat-text rendering. transcript_segments was added in
    // 20260509000001 — cast until database.types.ts is regenerated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (admin as any)
      .from('lessons')
      .update({ transcript: trimmed, transcript_segments: null })
      .eq('id', lessonId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    return NextResponse.json({
      source: 'manual',
      length: trimmed.length,
      preview: trimmed.slice(0, 200),
    })
  }

  // Auto-fetch from YouTube. Use the body's youtube_id if provided, else the
  // lesson's stored youtube_id. Also persists the body's id back to the row
  // so admins can pivot a lesson to YouTube + ingest in one call.
  const { data: lessonRow, error: lessonErr } = await admin
    .from('lessons')
    .select('id, youtube_id, video_source')
    .eq('id', lessonId)
    .maybeSingle()
  if (lessonErr) {
    return NextResponse.json({ error: lessonErr.message }, { status: 500 })
  }
  if (!lessonRow) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const youtubeId = body.youtube_id ?? lessonRow.youtube_id
  if (!youtubeId) {
    return NextResponse.json(
      { error: 'No youtube_id available. Set the lesson video to YouTube first or pass youtube_id in the body.' },
      { status: 400 },
    )
  }

  let segments: { text: string }[]
  try {
    segments = await YoutubeTranscript.fetchTranscript(youtubeId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error fetching captions'
    return NextResponse.json(
      { error: `Could not fetch YouTube captions: ${msg}` },
      { status: 502 },
    )
  }

  // Concatenate segments into a single readable block. The youtube-transcript
  // library returns text with HTML entities (e.g. &amp;) — decode the common ones.
  const decoded = segments
    .map((s) => s.text)
    .join(' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  if (decoded.length === 0) {
    return NextResponse.json(
      { error: 'YouTube returned an empty transcript for this video' },
      { status: 502 },
    )
  }

  // Build structured segments alongside the flat text so the UI can render
  // paragraph-grouped, timestamped transcript. The flat text still feeds the
  // tutor system prompt unchanged.
  const normalizedSegments = normalizeSegments(
    segments.map((s) => ({
      text: s.text,
      offset: (s as { offset?: number }).offset ?? 0,
      duration: (s as { duration?: number }).duration ?? 0,
    })),
  )

  // Persist transcript + (idempotently) flip the source/id if needed.
  const updates: {
    transcript: string
    transcript_segments: { start: number; text: string }[]
    youtube_id?: string
    video_source?: string
  } = {
    transcript: decoded,
    transcript_segments: normalizedSegments,
  }
  if (body.youtube_id && body.youtube_id !== lessonRow.youtube_id) {
    updates.youtube_id = body.youtube_id
    updates.video_source = 'youtube'
  } else if (lessonRow.video_source !== 'youtube') {
    updates.video_source = 'youtube'
  }

  // transcript_segments was added in 20260509000001 — cast until
  // database.types.ts is regenerated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('lessons')
    .update(updates)
    .eq('id', lessonId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    source: 'youtube',
    youtube_id: youtubeId,
    segments: segments.length,
    length: decoded.length,
    preview: decoded.slice(0, 200),
  })
}
