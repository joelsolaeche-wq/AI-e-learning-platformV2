// components/synapse/AssistantMessage.tsx
//
// Renders a Synapse assistant turn as markdown (bold, lists, paragraphs,
// fenced code) and converts inline `(mm:ss)` / `(mm:ss-mm:ss)` /
// `(h:mm:ss)` timestamp citations into clickable pills that dispatch a
// `transcript-seek` window event — wired up by VideoPlayer to seek the
// Mux player or YouTube iframe to that exact moment.

'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
}

// Matches `(mm:ss)`, `(mm:ss-mm:ss)`, `(h:mm:ss)`, and `(h:mm:ss-h:mm:ss)`.
// Capture groups aren't used downstream — we re-parse the matched substring
// inside `parseTimestampSeconds` so we keep regex + parser in sync below.
const TIMESTAMP_RE = /\((\d{1,2}:)?\d{1,2}:\d{2}(?:-(\d{1,2}:)?\d{1,2}:\d{2})?\)/g

function parseTimestampSeconds(matched: string): number {
  // Strip the parentheses and pull the START side of the range (before any '-').
  const inner = matched.slice(1, -1)
  const startStr = inner.split('-')[0]
  const parts = startStr.split(':').map((n) => parseInt(n, 10))
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 3) {
    // h:mm:ss
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    // mm:ss
    return parts[0] * 60 + parts[1]
  }
  return 0
}

/**
 * Replace every `(mm:ss)` / range / hour citation in `text` with a Markdown
 * link of the form `[(mm:ss)](#seek=<seconds>)`. The `#seek=` href is a
 * sentinel react-markdown's `<a>` override picks up to render a clickable
 * timestamp pill instead of a normal anchor.
 */
function injectSeekLinks(text: string): string {
  return text.replace(TIMESTAMP_RE, (match) => {
    const seconds = parseTimestampSeconds(match)
    return `[${match}](#seek=${seconds})`
  })
}

function dispatchSeek(seconds: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('transcript-seek', { detail: { time: seconds } }))
}

export function AssistantMessage({ content }: Props) {
  const processed = useMemo(() => injectSeekLinks(content), [content])

  return (
    <div className="prose-synapse text-[13px] leading-[1.55]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tighten paragraph spacing inside chat bubbles.
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,

          // Bullets / ordered lists with consistent spacing and a clear marker.
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1 marker:text-primary/70">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1 marker:text-primary/70">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-[1.5]">{children}</li>,

          // Bold gets a tiny accent for skim-ability.
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),

          // Headings get muted scale relative to body text — chat bubble, not page.
          h1: ({ children }) => (
            <h3 className="mb-1 mt-3 text-[14.5px] font-bold first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-1 mt-3 text-[14px] font-bold first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-3 text-[13.5px] font-semibold first:mt-0">{children}</h3>
          ),

          // Code: inline pill vs fenced block.
          code: ({ className, children, ...props }) => {
            const isInline = !/language-/.test(className ?? '')
            if (isInline) {
              return (
                <code
                  className="rounded-md border border-border/60 bg-secondary/60 px-1 py-0.5 font-mono text-[11.5px]"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className={`block whitespace-pre overflow-x-auto rounded-lg bg-black/60 px-3 py-2 font-mono text-[11.5px] leading-[1.5] ${className ?? ''}`}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-border/40">
              {children}
            </pre>
          ),

          // The hook we care about: timestamp pills via the `#seek=N` href.
          a: ({ href, children, ...props }) => {
            if (typeof href === 'string' && href.startsWith('#seek=')) {
              const seconds = parseInt(href.slice('#seek='.length), 10)
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    if (!Number.isNaN(seconds)) dispatchSeek(seconds)
                  }}
                  className="mx-0.5 inline-flex items-center rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0 font-mono text-[11px] font-semibold tabular-nums text-primary transition-colors hover:border-primary/60 hover:bg-primary/25"
                  aria-label={`Jump to ${children}`}
                >
                  {children}
                </button>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
