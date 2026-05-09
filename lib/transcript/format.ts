// lib/transcript/format.ts
//
// Helpers for turning raw YouTube caption segments into something readable.
// - normalizeSegmentOffset: youtube-transcript v1.3.x returns offsets in
//   milliseconds for the srv3 caption format and seconds for the classic
//   format. This normalizes both to seconds.
// - groupSegmentsIntoParagraphs: accumulates segments into paragraph-sized
//   chunks (~4-6 sentences) so the transcript is readable instead of a wall
//   of fragmented caption lines.
// - formatTimestamp: 0 → "0:00", 75 → "1:15", 3725 → "1:02:05".

export type RawSegment = { text: string; offset: number; duration?: number }

export type TranscriptSegment = { start: number; text: string }

export type TranscriptParagraph = {
  start: number
  startLabel: string
  text: string
}

const MS_THRESHOLD_SECONDS = 86_400 // 24 hours; offsets above this are clearly ms.

/**
 * Convert raw youtube-transcript output into normalized, seconds-based
 * segments. Detects ms-vs-seconds by looking at the last offset (videos
 * shorter than 24h cannot have a seconds-based offset above 86,400).
 */
export function normalizeSegments(raw: RawSegment[]): TranscriptSegment[] {
  if (raw.length === 0) return []
  const last = raw[raw.length - 1]
  const factor = last.offset > MS_THRESHOLD_SECONDS ? 1000 : 1
  return raw
    .map((s) => ({
      start: Math.max(0, Math.round((s.offset / factor) * 100) / 100),
      text: decodeEntities(s.text).trim(),
    }))
    .filter((s) => s.text.length > 0)
}

/**
 * Group caption-sized segments into paragraph-sized chunks. We accumulate
 * text until the chunk is at least MIN_CHARS long AND the most recent piece
 * ends with sentence-terminating punctuation, then start a new paragraph.
 * MAX_CHARS forces a break even without a sentence terminator.
 */
const MIN_CHARS = 320
const MAX_CHARS = 600

export function groupSegmentsIntoParagraphs(
  segments: TranscriptSegment[],
): TranscriptParagraph[] {
  const paragraphs: TranscriptParagraph[] = []
  let currentStart: number | null = null
  let currentText = ''

  const flush = () => {
    if (currentStart === null || currentText.trim().length === 0) return
    paragraphs.push({
      start: currentStart,
      startLabel: formatTimestamp(currentStart),
      text: currentText.trim().replace(/\s+/g, ' '),
    })
    currentStart = null
    currentText = ''
  }

  for (const seg of segments) {
    if (currentStart === null) currentStart = seg.start
    currentText += (currentText ? ' ' : '') + seg.text
    const trimmed = currentText.trim()
    const lastChar = trimmed.charAt(trimmed.length - 1)
    const endsSentence = /[.!?]/.test(lastChar)
    if (
      (trimmed.length >= MIN_CHARS && endsSentence) ||
      trimmed.length >= MAX_CHARS
    ) {
      flush()
    }
  }
  flush()
  return paragraphs
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
