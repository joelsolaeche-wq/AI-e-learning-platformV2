// components/QuizSection.tsx
'use client'

import { useState } from 'react'
import { Check, X, ChevronRight, Trophy, RotateCcw, Lock } from 'lucide-react'

interface ClientQuestion {
  id: string
  question: string
  options: string[]
}

interface QuizSectionProps {
  clientQuestions: ClientQuestion[]
  lessonId: string
  isLessonComplete?: boolean
}

type AnswerBreakdown = {
  questionId: string
  question: string
  options: string[]
  selectedAnswer: string | null
  correctAnswer: string
  correct: boolean
}

type QuizResult = {
  score: number
  total: number
  pct: number
  breakdown: AnswerBreakdown[]
}

export function QuizSection({ clientQuestions, lessonId, isLessonComplete }: QuizSectionProps) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!clientQuestions || clientQuestions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No quiz available for this lesson yet.
      </div>
    )
  }

  if (!isLessonComplete) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Lock size={28} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-[14px] font-semibold">Quiz locked</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Complete the video lesson to unlock the quiz.</p>
      </div>
    )
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-accent/[0.06] p-10">
        <div className="text-center">
          <Trophy size={40} className="mx-auto mb-3 text-primary drop-shadow-[0_0_16px_hsl(var(--primary))]" />
          <div className="text-[28px] font-bold tracking-tight">{result.score}/{result.total} correct</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {result.pct >= 80 ? '🎉 Nailed it — +50 XP earned' : 'Keep going — review and retry to lock it in.'}
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {result.breakdown.map((b, i) => (
            <div
              key={b.questionId}
              className={[
                'rounded-xl border p-4 text-[13px]',
                b.correct ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-rose-400/50 bg-rose-400/10',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center gap-2 font-semibold">
                {b.correct ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-rose-400" />}
                Q{i + 1}: {b.question}
              </div>
              <div className="text-muted-foreground">
                Your answer:{' '}
                <span className={b.correct ? 'text-emerald-300' : 'text-rose-300'}>
                  {b.selectedAnswer ?? '(none)'}
                </span>
              </div>
              {!b.correct && (
                <div className="text-muted-foreground">
                  Correct: <span className="text-emerald-300">{b.correctAnswer}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 text-center">
          <button
            onClick={() => { setIdx(0); setAnswers({}); setPicked(null); setResult(null); setError(null) }}
            className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-semibold hover:bg-secondary"
          >
            <RotateCcw size={13} /> Retry
          </button>
        </div>
      </div>
    )
  }

  const q = clientQuestions[idx]
  const isLast = idx + 1 >= clientQuestions.length

  async function handleNext() {
    if (!picked) return
    const newAnswers = { ...answers, [q.id]: picked }
    setAnswers(newAnswers)

    if (isLast) {
      setSubmitting(true)
      setError(null)
      try {
        const res = await fetch('/api/quiz/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, answers: newAnswers }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Failed to submit quiz')
        } else {
          setResult(data as QuizResult)
        }
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setSubmitting(false)
      }
    } else {
      setIdx(idx + 1)
      setPicked(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Question {idx + 1} of {clientQuestions.length}
        </div>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${((idx) / clientQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6 text-[20px] font-semibold leading-[1.3] tracking-[-0.01em]">{q.question}</div>

      <div className="flex flex-col gap-2.5">
        {q.options.map((opt, optIdx) => {
          const isPicked = picked === opt
          const letter = String.fromCharCode(65 + optIdx)
          return (
            <button
              key={opt}
              onClick={() => setPicked(opt)}
              className={[
                'group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[14px] transition-all',
                isPicked
                  ? 'border-primary/50 bg-primary/[0.10] text-foreground'
                  : 'border-border bg-secondary/40 text-foreground hover:border-white/15 hover:bg-secondary',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-6 w-6 flex-shrink-0 place-items-center rounded-md border text-[11px] font-bold transition-all',
                  isPicked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                ].join(' ')}
              >
                {letter}
              </span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/50 bg-rose-400/10 px-4 py-3 text-[13px] text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          disabled={!picked || submitting}
          onClick={handleNext}
          className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {submitting ? 'Submitting…' : isLast ? 'Submit quiz' : 'Next question'}
          {!isLast && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  )
}
