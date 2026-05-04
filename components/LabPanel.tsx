'use client'

import { useState, useTransition } from 'react'
import { submitLabAction } from '@/lib/actions/labs.actions'
import { Star, FlaskConical, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculateWeightedScore, calculateStars } from '@/lib/lab-utils'

type Criterion = {
  id: string
  name: string
  description: string | null
  weight: number
  position: number
}

type Evaluation = {
  criteria_id: string
  score: number
  feedback: string
  suggestion: string | null
}

type Submission = {
  id: string
  status: 'pending' | 'evaluating' | 'evaluated'
  submission_text: string | null
  submission_url: string | null
  submitted_at: string
  lab_evaluations: Evaluation[]
}

type Lab = {
  id: string
  title: string
  description: string | null
  passing_score: number
  lab_criteria: Criterion[]
}

type Props = {
  lab: Lab
  latestSubmission: Submission | null
  cohortId: string | null
}

function StarRating({ count }: { count: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          size={20}
          className={cn(
            n <= count ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

export function LabPanel({ lab, latestSubmission, cohortId }: Props) {
  const [submitting, startSubmit] = useTransition()
  const [evalResult, setEvalResult] = useState<{
    stars: 1 | 2 | 3
    weightedScore: number
    evaluations: Evaluation[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(latestSubmission)

  const isEvaluated = currentSubmission?.status === 'evaluated'
  const isEvaluating = evaluating || currentSubmission?.status === 'evaluating'

  async function handleSubmit(formData: FormData) {
    setError(null)
    startSubmit(async () => {
      const result = await submitLabAction(undefined as never, formData)
      if (result.error) { setError(result.error); return }
      if (!result.labId) return

      setEvaluating(true)
      try {
        const res = await fetch('/api/labs/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: result.labId }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Evaluation failed'); setEvaluating(false); return }
        setEvalResult({ stars: data.stars, weightedScore: data.weightedScore, evaluations: data.evaluations })
        setCurrentSubmission({
          id: result.labId,
          status: 'evaluated',
          submission_text: formData.get('submission_text') as string | null,
          submission_url: formData.get('submission_url') as string | null,
          submitted_at: new Date().toISOString(),
          lab_evaluations: data.evaluations,
        })
      } finally {
        setEvaluating(false)
      }
    })
  }

  // Build eval display from DB submission or fresh API result
  const displayEvals: Evaluation[] = evalResult?.evaluations ?? currentSubmission?.lab_evaluations ?? []
  const displayScore = evalResult?.weightedScore ?? (
    displayEvals.length > 0
      ? calculateWeightedScore(displayEvals.map((e) => ({
          criteria_id: e.criteria_id,
          score: e.score,
          weight: lab.lab_criteria.find((c) => c.id === e.criteria_id)?.weight ?? 1,
        })))
      : null
  )
  const displayStars = evalResult?.stars ?? (displayScore !== null ? calculateStars(displayScore) : null)
  const passed = displayScore !== null ? displayScore >= lab.passing_score : null

  const criteriaMap = new Map(lab.lab_criteria.map((c) => [c.id, c]))

  return (
    <div className="space-y-6">
      {/* Lab header */}
      <div className="rounded-xl border border-border bg-card/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-primary shrink-0" />
          <h3 className="font-semibold text-base">{lab.title}</h3>
        </div>
        {lab.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{lab.description}</p>
        )}

        {/* Criteria */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evaluation criteria</p>
          <div className="space-y-1.5">
            {lab.lab_criteria
              .sort((a, b) => a.position - b.position)
              .map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-5 min-w-[1.25rem] rounded-full bg-primary/10 text-center text-[11px] font-bold text-primary leading-5">
                    {c.position}
                  </span>
                  <div>
                    <span className="font-medium">{c.name}</span>
                    {c.description && (
                      <span className="text-muted-foreground"> — {c.description}</span>
                    )}
                    <span className="ml-2 text-[11px] text-muted-foreground">×{c.weight}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Passing score: {lab.passing_score}%</p>
      </div>

      {/* Evaluation results */}
      {isEvaluated && displayEvals.length > 0 && displayStars !== null && (
        <div className="rounded-xl border border-border bg-card/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Your score</p>
              <div className="flex items-center gap-3">
                <StarRating count={displayStars} />
                <span className="text-2xl font-bold">{Math.round(displayScore ?? 0)}%</span>
                {passed !== null && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  )}>
                    {passed ? 'Passed' : 'Not passed'}
                  </span>
                )}
              </div>
            </div>
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>

          <div className="space-y-3">
            {displayEvals.map((ev) => {
              const criterion = criteriaMap.get(ev.criteria_id)
              return (
                <div key={ev.criteria_id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{criterion?.name ?? ev.criteria_id}</span>
                    <span className={cn(
                      'text-sm font-bold',
                      ev.score >= 85 ? 'text-emerald-400' : ev.score >= 60 ? 'text-amber-400' : 'text-rose-400'
                    )}>
                      {ev.score}/100
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ev.feedback}</p>
                  {ev.suggestion && (
                    <p className="text-xs text-amber-400/80 italic">Suggestion: {ev.suggestion}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Evaluating spinner */}
      {isEvaluating && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin text-primary" />
          AI evaluator is reviewing your submission…
        </div>
      )}

      {/* Submission form */}
      {!isEvaluated && !isEvaluating && (
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="lab_id" value={lab.id} />
          {cohortId && <input type="hidden" name="cohort_id" value={cohortId} />}

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="submission_text">
              Your submission
            </label>
            <textarea
              id="submission_text" name="submission_text" rows={6}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-y"
              placeholder="Describe your solution, paste code, explain your approach…"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="submission_url">
              Link (optional)
            </label>
            <div className="relative">
              <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                id="submission_url" name="submission_url" type="url"
                className="w-full rounded-lg border border-border bg-secondary pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                placeholder="https://github.com/you/repo"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={submitting}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Submit for AI evaluation'}
          </button>
        </form>
      )}
    </div>
  )
}
