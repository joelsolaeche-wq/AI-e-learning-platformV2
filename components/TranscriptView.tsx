'use client'

import { useMemo } from 'react'
import { groupSegmentsIntoParagraphs, type TranscriptSegment } from '@/lib/transcript/format'

interface Props {
  /** Structured segments — preferred when available. */
  segments: TranscriptSegment[] | null
  /** Flat fallback rendered when segments are not available. */
  flatText: string | null
}

/**
 * Renders a transcript as readable paragraphs with clickable [mm:ss]
 * timestamps. Clicking a timestamp dispatches a `transcript-seek` window
 * event with `{ time }` (seconds). The VideoPlayer listens for this event
 * and seeks the underlying Mux or YouTube player.
 *
 * When segments are unavailable (manual transcript paste), falls back to
 * rendering the flat text in pre-wrap.
 */
export function TranscriptView({ segments, flatText }: Props) {
  const paragraphs = useMemo(
    () => (segments && segments.length > 0 ? groupSegmentsIntoParagraphs(segments) : []),
    [segments],
  )

  if (paragraphs.length === 0) {
    if (flatText) {
      return (
        <div className="rounded-xl border border-border bg-card p-5 text-[13.5px] leading-relaxed text-foreground/80">
          <p className="whitespace-pre-wrap">{flatText}</p>
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-[13.5px] leading-relaxed">
        <p className="text-muted-foreground">No transcript available for this lesson.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mx-auto flex max-w-[68ch] flex-col gap-4 text-[13.5px] leading-[1.7] text-foreground/85">
        {paragraphs.map((p, i) => (
          <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
            <button
              type="button"
              onClick={() => seekTo(p.start)}
              className="self-start rounded-md border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary sm:mt-0.5 sm:shrink-0"
              aria-label={`Jump to ${p.startLabel}`}
            >
              {p.startLabel}
            </button>
            <p className="m-0">{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function seekTo(time: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('transcript-seek', { detail: { time } }))
}
