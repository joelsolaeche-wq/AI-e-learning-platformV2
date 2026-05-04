'use client'

import { useActionState, useState } from 'react'
import { upsertLabAction, type LabActionResult, type CriterionInput } from '@/lib/actions/labs.actions'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

type Lab = {
  id: string
  title: string
  description: string | null
  context_instructions: string | null
  passing_score: number
  lab_criteria: CriterionInput[]
}

const initialState: LabActionResult = { error: null }

let localIdCounter = 0
function tempId() { return `new-${++localIdCounter}` }

export function LabForm({ lab, lessonId }: { lab?: Lab; lessonId: string }) {
  const [state, formAction, isPending] = useActionState(upsertLabAction, initialState)
  const [criteria, setCriteria] = useState<Array<CriterionInput & { _key: string }>>(() =>
    (lab?.lab_criteria ?? []).map((c) => ({ ...c, _key: c.id ?? tempId() }))
  )

  function addCriterion() {
    setCriteria((prev) => [
      ...prev,
      { _key: tempId(), name: '', description: '', weight: 1, position: prev.length + 1 },
    ])
  }

  function removeCriterion(key: string) {
    setCriteria((prev) => {
      const next = prev.filter((c) => c._key !== key)
      return next.map((c, i) => ({ ...c, position: i + 1 }))
    })
  }

  function updateCriterion(key: string, field: keyof CriterionInput, value: string | number) {
    setCriteria((prev) => prev.map((c) => c._key === key ? { ...c, [field]: value } : c))
  }

  const criteriaForSubmit: CriterionInput[] = criteria.map((c) => ({
    ...(c.id ? { id: c.id } : {}),
    name: c.name,
    description: c.description,
    weight: c.weight,
    position: c.position,
  }))

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lab_id" value={lab?.id ?? ''} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="criteria" value={JSON.stringify(criteriaForSubmit)} />

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="lab_title">Lab title *</label>
        <input
          id="lab_title" name="title" required
          defaultValue={lab?.title ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="e.g. Build a prompt chain"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="lab_description">Description / Enunciado</label>
        <textarea
          id="lab_description" name="description" rows={4}
          defaultValue={lab?.description ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-y"
          placeholder="Describe the lab goal and what the learner should deliver."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="lab_context">Evaluator context</label>
        <textarea
          id="lab_context" name="context_instructions" rows={4}
          defaultValue={lab?.context_instructions ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-y"
          placeholder="Instructions for the AI evaluator: expected depth, language, specific requirements, red flags to penalize."
        />
        <p className="text-[11px] text-muted-foreground">The AI evaluator reads this as context when scoring submissions.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="passing_score">Passing score (%)</label>
        <input
          id="passing_score" name="passing_score" type="number" min="0" max="100"
          defaultValue={lab?.passing_score ?? 60}
          className="w-40 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Criteria */}
      <fieldset className="rounded-xl border border-border p-4 space-y-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Evaluation criteria</legend>

        {criteria.length === 0 && (
          <p className="text-sm text-muted-foreground">No criteria yet. Add at least one.</p>
        )}

        {criteria.map((c, idx) => (
          <div key={c._key} className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground shrink-0">#{idx + 1}</span>
              <input
                value={c.name}
                onChange={(e) => updateCriterion(c._key, 'name', e.target.value)}
                placeholder="Criterion name *"
                className="flex-1 rounded-lg border border-border bg-secondary px-2 py-1.5 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">Weight</span>
                <input
                  type="number" min="0.1" step="0.1"
                  value={c.weight}
                  onChange={(e) => updateCriterion(c._key, 'weight', parseFloat(e.target.value) || 1)}
                  className="w-16 rounded-lg border border-border bg-secondary px-2 py-1.5 text-sm outline-none focus:border-primary/60 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => removeCriterion(c._key)}
                className={cn('rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors', criteria.length <= 1 && 'opacity-30 pointer-events-none')}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              value={c.description ?? ''}
              onChange={(e) => updateCriterion(c._key, 'description', e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none focus:border-primary/60 transition-all"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addCriterion}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <Plus size={12} /> Add criterion
        </button>
      </fieldset>

      {state.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Lab saved successfully.
        </p>
      )}

      <button
        type="submit" disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : lab ? 'Update lab' : 'Create lab'}
      </button>
    </form>
  )
}
