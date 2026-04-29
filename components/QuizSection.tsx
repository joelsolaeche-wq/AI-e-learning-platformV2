// components/QuizSection.tsx
'use client'

import { useState } from 'react'
import { Check, X, ChevronRight, Trophy, RotateCcw } from 'lucide-react'

interface QuizQuestion {
  id: string
  prompt: string
  options: { id: string; text: string }[]
  correct_option_id: string
  explanation?: string
}

interface QuizSectionProps {
  questions: QuizQuestion[]
  lessonId: string
  onComplete?: (score: number) => void
}

export function QuizSection({ questions, lessonId, onComplete }: QuizSectionProps) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  if (!questions || questions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No quiz available for this lesson yet.
      </div>
    )
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-accent/[0.06] p-10 text-center">
        <Trophy size={40} className="mx-auto mb-3 text-primary drop-shadow-[0_0_16px_hsl(var(--primary))]" />
        <div className="text-[28px] font-bold tracking-tight">{score}/{questions.length} correct</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {pct >= 80 ? '🎉 Nailed it — +50 XP earned' : 'Keep going — review and retry to lock it in.'}
        </div>
        <button
          onClick={() => { setIdx(0); setPicked(null); setRevealed(false); setScore(0); setDone(false) }}
          className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-semibold hover:bg-secondary"
        >
          <RotateCcw size={13} /> Retry
        </button>
      </div>
    )
  }

  const q = questions[idx]
  const isCorrect = picked === q.correct_option_id

  function submit() {
    if (!picked || revealed) return
    setRevealed(true)
    if (isCorrect) setScore((s) => s + 1)
  }
  function next() {
    if (idx + 1 >= questions.length) {
      setDone(true)
      onComplete?.(score + (isCorrect ? 0 : 0))
    } else {
      setIdx(idx + 1)
      setPicked(null)
      setRevealed(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Question {idx + 1} of {questions.length}
        </div>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${((idx + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6 text-[20px] font-semibold leading-[1.3] tracking-[-0.01em]">{q.prompt}</div>

      <div className="flex flex-col gap-2.5">
        {q.options.map((opt) => {
          const isPicked = picked === opt.id
          const isRight = revealed && opt.id === q.correct_option_id
          const isWrongPick = revealed && isPicked && !isRight
          return (
            <button
              key={opt.id}
              disabled={revealed}
              onClick={() => setPicked(opt.id)}
              className={[
                'group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[14px] transition-all',
                isRight
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                  : isWrongPick
                  ? 'border-rose-400/50 bg-rose-400/10 text-rose-200'
                  : isPicked
                  ? 'border-primary/50 bg-primary/[0.10] text-foreground'
                  : 'border-border bg-secondary/40 text-foreground hover:border-white/15 hover:bg-secondary',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-6 w-6 flex-shrink-0 place-items-center rounded-md border text-[11px] font-bold transition-all',
                  isRight
                    ? 'border-emerald-400 bg-emerald-400 text-emerald-950'
                    : isWrongPick
                    ? 'border-rose-400 bg-rose-400 text-rose-950'
                    : isPicked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                ].join(' ')}
              >
                {isRight ? <Check size={12} /> : isWrongPick ? <X size={12} /> : opt.id.toUpperCase().slice(0, 1)}
              </span>
              <span>{opt.text}</span>
            </button>
          )
        })}
      </div>

      {revealed && q.explanation && (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-[13px] leading-[1.55] text-foreground/90">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Why</div>
          {q.explanation}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {!revealed ? (
          <button
            disabled={!picked}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Submit answer
          </button>
        ) : (
          <button
            onClick={next}
            className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
          >
            {idx + 1 >= questions.length ? 'See results' : 'Next question'} <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
