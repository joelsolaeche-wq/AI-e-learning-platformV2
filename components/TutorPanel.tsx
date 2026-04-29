// components/TutorPanel.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Minus } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

export function TutorPanel({ lessonId }: { lessonId?: string } = {}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm Synapse — your AI tutor. Ask me anything about this lesson, or try one of the prompts below." },
  ])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, [messages, open])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setMessages((m) => [...m, { role: 'user', content }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content }], lessonId }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.message ?? 'Sorry — something went wrong.' }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-7 right-7 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-b from-primary to-primary/75 px-5 py-3.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
      >
        <Sparkles size={15} className="drop-shadow-[0_0_8px_white]" />
        Ask Synapse
        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">⌘J</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-7 right-7 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-[#11111C]/95 backdrop-blur-xl shadow-[0_24px_48px_rgba(0,0,0,0.5),0_0_32px_rgba(139,92,246,0.25)] animate-[fadeUp_.18s_ease]">
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
        <button onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Minimize">
          <Minus size={14} />
        </button>
        <button onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={[
              'max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-[1.5]',
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
