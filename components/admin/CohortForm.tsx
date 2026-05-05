'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createCohortAction, updateCohortAction, type CohortActionResult } from '@/lib/actions/cohorts.actions'

type Course = { id: string; title: string }
type Company = { id: string; name: string }
type Cohort = {
  id: string; title: string; course_id: string; company_id: string | null;
  starts_at: string; ends_at: string | null; max_seats: number;
  modality: string | null; notes: string | null; status: string;
}

const initialState: CohortActionResult = { error: null }

const MODALITIES = ['virtual', 'in-person', 'hybrid']
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function toDateInput(iso: string | null) {
  if (!iso) return ''
  return iso.split('T')[0]
}

interface Props {
  cohort?: Cohort
  courses: Course[]
  companies: Company[]
}

export function CohortForm({ cohort, courses, companies }: Props) {
  const isEdit = !!cohort
  const action = isEdit ? updateCohortAction : createCohortAction
  const [state, formAction, isPending] = useActionState(action, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.success && !isEdit && state.id) {
      router.push(`/admin/cohorts/${state.id}`)
    }
  }, [state.success, state.id, isEdit, router])

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="cohort_id" value={cohort.id} />}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="title">Title *</label>
        <input
          id="title" name="title" required
          defaultValue={cohort?.title ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="May 2026 Cohort"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="course_id">Course *</label>
          <select
            id="course_id" name="course_id" required
            defaultValue={cohort?.course_id ?? ''}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          >
            <option value="">Select a course…</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="company_id">Company</label>
          <select
            id="company_id" name="company_id"
            defaultValue={cohort?.company_id ?? ''}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          >
            <option value="">No company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="starts_at">Start date *</label>
          <input
            id="starts_at" name="starts_at" type="date" required
            defaultValue={toDateInput(cohort?.starts_at ?? null)}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="ends_at">End date</label>
          <input
            id="ends_at" name="ends_at" type="date"
            defaultValue={toDateInput(cohort?.ends_at ?? null)}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="max_seats">Max seats (0 = unlimited)</label>
          <input
            id="max_seats" name="max_seats" type="number" min="0"
            defaultValue={cohort?.max_seats ?? 0}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="modality">Modality</label>
          <select
            id="modality" name="modality"
            defaultValue={cohort?.modality ?? 'virtual'}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          >
            {MODALITIES.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
          </select>
        </div>
      </div>

      {isEdit && (
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="status">Status</label>
          <select
            id="status" name="status"
            defaultValue={cohort?.status ?? 'draft'}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="notes">Notes</label>
        <textarea
          id="notes" name="notes" rows={2}
          defaultValue={cohort?.notes ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-none"
          placeholder="Internal notes about this cohort"
        />
      </div>

      {state.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && isEdit && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Saved successfully.
        </p>
      )}

      <button
        type="submit" disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create cohort'}
      </button>
    </form>
  )
}
