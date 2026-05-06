'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createCohortAction, updateCohortAction, type CohortActionResult } from '@/lib/actions/cohorts.actions'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Course = { id: string; title: string }
type Company = { id: string; name: string }
type Cohort = {
  id: string; title: string; course_id: string | null; company_id: string | null;
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
  defaultCompanyId?: string
  lockCompany?: boolean
  redirectTo?: string
  selectedCourseIds?: string[]
}

export function CohortForm({ cohort, courses, companies, defaultCompanyId, lockCompany, redirectTo, selectedCourseIds }: Props) {
  const isEdit = !!cohort

  // Initialise selection: for edit mode use selectedCourseIds from DB (M2M);
  // fall back to the legacy cohort.course_id for old rows not yet backfilled.
  const initSelected = (): string[] => {
    if (selectedCourseIds && selectedCourseIds.length > 0) return selectedCourseIds
    if (cohort?.course_id) return [cohort.course_id]
    return []
  }

  const [pickedCourses, setPickedCourses] = useState<string[]>(initSelected)

  const action = isEdit ? updateCohortAction : createCohortAction
  const [state, formAction, isPending] = useActionState(action, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.success && !isEdit && state.id) {
      router.push(redirectTo ?? `/admin/cohorts/${state.id}`)
    }
  }, [state.success, state.id, isEdit, router, redirectTo])

  function toggleCourse(id: string) {
    setPickedCourses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="cohort_id" value={cohort.id} />}

      {/* Hidden inputs for selected courses (getAll in action) */}
      {pickedCourses.map((id) => (
        <input key={id} type="hidden" name="course_ids" value={id} />
      ))}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="title">Title *</label>
        <input
          id="title" name="title" required
          defaultValue={cohort?.title ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="May 2026 Cohort"
        />
      </div>

      {/* Courses multiselect */}
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium">
          Courses
          {pickedCourses.length > 0 && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              {pickedCourses.length} selected
            </span>
          )}
        </label>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published courses available.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {courses.map((course) => {
              const selected = pickedCourses.includes(course.id)
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => toggleCourse(course.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all',
                    selected
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
                  )}
                >
                  <span className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded border text-[9px]',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}>
                    {selected && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="font-medium">{course.title}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="company_id">Company</label>
        {lockCompany ? (
          <>
            <input type="hidden" name="company_id" value={defaultCompanyId ?? ''} />
            <div className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
              {companies.find(c => c.id === defaultCompanyId)?.name ?? defaultCompanyId}
            </div>
          </>
        ) : (
          <select
            id="company_id" name="company_id"
            defaultValue={cohort?.company_id ?? defaultCompanyId ?? ''}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          >
            <option value="">No company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
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
