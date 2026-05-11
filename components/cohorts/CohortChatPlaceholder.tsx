// components/cohorts/CohortChatPlaceholder.tsx
//
// Visual stub for the upcoming cohort chat feature. No backend, no state —
// it sells the concept on the cohort detail page until the real
// Realtime-backed channel ships. Locked input + disabled send + faded
// message bubbles signal "preview" without confusing admins.

import { MessageSquare, Send, Lock } from 'lucide-react'

const FAKE_MESSAGES = [
  { who: 'María Lopez',     role: 'Learner',    body: 'Quick question on lesson 3 — the prompt-tuning section.', when: '2 min ago' },
  { who: 'Tomás Rivera',    role: 'Learner',    body: 'Anyone else stuck on the lab rubric? Submitted my repo but the AI gave me 1★ on the README criterion.', when: '15 min ago' },
  { who: 'Joel Solaeche',         role: 'Instructor', body: 'Welcome everyone! Office hours Friday 4pm UTC.',         when: '1 hour ago' },
]

export function CohortChatPlaceholder({ cohortTitle }: { cohortTitle: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <MessageSquare size={16} />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold">Cohort chat — coming soon</p>
            <p className="text-[12px] text-muted-foreground">
              Real-time channel for {cohortTitle}. Threads, announcements, and instructor pins.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
          <Lock size={10} /> Preview
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden opacity-90">
        <div className="flex items-center gap-2.5 border-b border-border bg-secondary/30 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
          <p className="text-[12.5px] font-semibold">#general</p>
          <p className="text-[11.5px] text-muted-foreground">{FAKE_MESSAGES.length} messages</p>
        </div>

        <div className="flex flex-col gap-3 px-4 py-5">
          {FAKE_MESSAGES.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-foreground/70">
                {m.who.split(' ').map((p) => p[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-[13px] font-semibold">{m.who}</p>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {m.role}
                  </span>
                  <span className="ml-auto text-[10.5px] text-muted-foreground">{m.when}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">{m.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-secondary/20 px-3 py-2.5 opacity-60">
          <input
            type="text"
            disabled
            placeholder="Chat is read-only in preview — launching with realtime messaging next."
            className="flex-1 cursor-not-allowed rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[13px] text-muted-foreground placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            disabled
            className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/60 text-muted-foreground"
            aria-label="Send (disabled)"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
