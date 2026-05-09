// components/TutorPanel.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Minus, Maximize2, Minimize2 } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

type DisplayMode = 'pill' | 'default' | 'embedded' | 'expanded'

const STORAGE_KEY = 'synapse-panel-mode'

const WELCOME: Message = {
  role: 'assistant',
  content: "Hi! I'm Synapse — your AI tutor. Ask me anything about this lesson, or try one of the prompts below.",
}

interface Props {
  lessonId?: string
  initialMessages?: { id?: string; role: string; content: string; createdAt?: Date }[]
  /**
   * Layout mode:
   *   'floating' (default) — fixed bottom-right pill that opens to a
   *     small panel; legacy behavior used outside lesson pages.
   *   'embedded' — renders inline, full-width inside the parent column.
   *     Always visible. Used in the lesson right sidebar (Codecademy
   *     layout). Expand still toggles to a near-fullscreen overlay.
   */
  mode?: 'floating' | 'embedded'
}

export function TutorPanel({ lessonId, initialMessages, mode = 'floating' }: Props) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    mode === 'embedded' ? 'embedded' : 'pill',
  )
  // For floating mode only: which size to restore when re-opening from pill.
  const [lastFloatingOpenMode, setLastFloatingOpenMode] = useState<'default' | 'expanded'>('default')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    }
    return [WELCOME]
  })
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Restore preferred open size from localStorage (floating mode only).
  useEffect(() => {
    if (mode !== 'floating') return
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'default' || saved === 'expanded') {
        setLastFloatingOpenMode(saved)
      }
    } catch {
      // ignore
    }
  }, [mode])

  // Persist preferred open size when it changes (floating mode only).
  useEffect(() => {
    if (mode !== 'floating') return
    try {
      window.localStorage.setItem(STORAGE_KEY, lastFloatingOpenMode)
    } catch {
      // ignore
    }
  }, [lastFloatingOpenMode, mode])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, [messages, displayMode])

  function openFromPill() {
    setDisplayMode(lastFloatingOpenMode)
  }

  function toggleExpanded() {
    if (mode === 'embedded') {
      setDisplayMode((prev) => (prev === 'expanded' ? 'embedded' : 'expanded'))
    } else {
      const next: 'default' | 'expanded' = displayMode === 'expanded' ? 'default' : 'expanded'
      setDisplayMode(next)
      setLastFloatingOpenMode(next)
    }
  }

  function minimizeToPill() {
    setDisplayMode('pill')
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading || !lessonId) return
    setMessages((m) => [...m, { role: 'user', content }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, message: content }),
      })

      if (!res.ok || !res.body) {
        let serverError = ''
        try {
          const data = (await res.json()) as { error?: string }
          serverError = data.error ?? ''
        } catch {
          try {
            serverError = await res.text()
          } catch {
            // ignore
          }
        }
        const baseMsg =
          res.status === 401
            ? 'Please sign in again.'
            : res.status === 403
            ? "You don't have access to this lesson — make sure you're enrolled in a cohort for this course."
            : res.status === 400
            ? 'That message is invalid or too long (max 2000 chars).'
            : `Server error (${res.status}).`
        const detail = serverError ? ` Details: ${serverError}` : ''
        console.error('[TutorPanel] chat error', { status: res.status, error: serverError })
        setLoading(false)
        setMessages((m) => [...m, { role: 'assistant', content: baseMsg + detail }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      let added = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        if (!added) {
          added = true
          setLoading(false)
          setMessages((m) => [...m, { role: 'assistant', content: assistantText }])
        } else {
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', content: assistantText }
            return copy
          })
        }
      }

      if (!added) {
        setLoading(false)
        setMessages((m) => [...m, { role: 'assistant', content: 'Sorry — empty response.' }])
      }
    } catch (err) {
      console.error('[TutorPanel] network error', err)
      setLoading(false)
      const detail = err instanceof Error ? ` (${err.message})` : ''
      setMessages((m) => [...m, { role: 'assistant', content: `Network error.${detail} Please try again.` }])
    }
  }

  // ---------------------------------------------------------------------
  // PILL — floating mode only
  // ---------------------------------------------------------------------
  if (displayMode === 'pill') {
    return (
      <button
        onClick={openFromPill}
        className="fixed bottom-7 right-7 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-b from-primary to-primary/75 px-5 py-3.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
      >
        <Sparkles size={15} className="drop-shadow-[0_0_8px_white]" />
        Ask Synapse
        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">⌘J</span>
      </button>
    )
  }

  // ---------------------------------------------------------------------
  // PANEL — picks container styling based on displayMode
  // ---------------------------------------------------------------------
  const isExpanded = displayMode === 'expanded'
  const isEmbedded = displayMode === 'embedded'

  const containerClasses = isExpanded
    ? // Fullscreen-ish overlay (anchored bottom-right of viewport)
      'fixed bottom-7 right-7 z-50 h-[min(720px,85vh)] w-[min(900px,92vw)] shadow-[0_32px_64px_rgba(0,0,0,0.6),0_0_48px_rgba(139,92,246,0.3)]'
    : isEmbedded
      ? // Inline inside the parent column (Codecademy-style)
        'relative w-full h-[520px] shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
      : // Floating mode default size
        'fixed bottom-7 right-7 z-50 h-[640px] w-[440px] shadow-[0_24px_48px_rgba(0,0,0,0.5),0_0_32px_rgba(139,92,246,0.25)]'

  return (
    <div
      className={[
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-[#11111C]/95 backdrop-blur-xl',
        isEmbedded ? '' : 'animate-[fadeUp_.18s_ease]',
        containerClasses,
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border bg-gradient-to-r from-primary/[0.14] to-accent/[0.08] px-3.5 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-[0_0_16px_rgba(139,92,246,0.5)]">
          <Sparkles size={15} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold">Synapse</div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
            Online · learns from this lesson
          </div>
        </div>
        <button
          onClick={toggleExpanded}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {/* Minimize/close are floating-mode only — embedded chat is always visible. */}
        {mode === 'floating' && (
          <>
            <button
              onClick={minimizeToPill}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Minimize"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={minimizeToPill}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Close"
              title="Close"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={[
              'rounded-xl px-3 py-2 text-[13px] leading-[1.5]',
              isExpanded ? 'max-w-[78%]' : 'max-w-[88%]',
              m.role === 'user'
                ? 'self-end bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
                : 'self-start border border-border bg-secondary/60 text-foreground',
            ].join(' ')}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex gap-1 self-start rounded-xl border border-border bg-secondary/60 px-3 py-2.5">
            <span className="h-1.5 w-1.5 animate-[pulseDot_1.2s_ease_infinite] rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 animate-[pulseDot_1.2s_ease_infinite_.2s] rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 animate-[pulseDot_1.2s_ease_infinite_.4s] rounded-full bg-primary" />
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5 border-t border-border bg-white/[0.02] px-3.5 py-2.5">
        {['Explain this simpler', 'Quiz me', 'Code example'].map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            className="rounded-full border border-primary/25 bg-primary/[0.10] px-2.5 py-1 text-[11px] text-primary hover:border-primary/40 hover:bg-primary/[0.18]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send() }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything…"
          className="flex-1 rounded-[10px] border border-border bg-secondary/60 px-3 py-2 text-[13px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-b from-primary to-primary/75 text-primary-foreground glow-primary disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
