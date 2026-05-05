// One-shot transcript ingest. Run with:
//   node --env-file=.env.local scripts/ingest-transcript.mjs <lessonId> [youtubeId]
// If youtubeId is omitted, the script reads it from the lesson row.

import { YoutubeTranscript } from 'youtube-transcript'
import { createClient } from '@supabase/supabase-js'

const lessonId = process.argv[2]
const overrideYoutubeId = process.argv[3]

if (!lessonId) {
  console.error('Usage: node --env-file=.env.local scripts/ingest-transcript.mjs <lessonId> [youtubeId]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data: lesson, error: lessonErr } = await admin
  .from('lessons')
  .select('id, title, youtube_id, video_source')
  .eq('id', lessonId)
  .maybeSingle()

if (lessonErr) {
  console.error('Failed to load lesson:', lessonErr.message)
  process.exit(1)
}
if (!lesson) {
  console.error(`Lesson ${lessonId} not found.`)
  process.exit(1)
}

const youtubeId = overrideYoutubeId ?? lesson.youtube_id
if (!youtubeId) {
  console.error('No youtube_id on lesson and none passed on the CLI.')
  process.exit(1)
}

console.log(`Lesson: ${lesson.title}`)
console.log(`Fetching transcript for YouTube id: ${youtubeId}`)

let segments
try {
  segments = await YoutubeTranscript.fetchTranscript(youtubeId)
} catch (err) {
  console.error('Failed to fetch transcript:', err?.message ?? err)
  process.exit(1)
}

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
  console.error('YouTube returned empty captions.')
  process.exit(1)
}

console.log(`Segments: ${segments.length}`)
console.log(`Total chars: ${decoded.length}`)
console.log(`Preview: ${decoded.slice(0, 200)}…`)

const updates = { transcript: decoded }
if (overrideYoutubeId && overrideYoutubeId !== lesson.youtube_id) {
  updates.youtube_id = overrideYoutubeId
  updates.video_source = 'youtube'
} else if (lesson.video_source !== 'youtube') {
  updates.video_source = 'youtube'
}

const { error: updateErr } = await admin
  .from('lessons')
  .update(updates)
  .eq('id', lessonId)

if (updateErr) {
  console.error('Failed to update lesson:', updateErr.message)
  process.exit(1)
}

console.log('OK — transcript saved.')
