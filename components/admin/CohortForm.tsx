'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createCohortAction, updateCohortAction, type CohortActionResult } from '@/lib/actions/cohorts.actions'
import { Check, Search, X, BookOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Course = { id: string; title: string }
type Company = { id: string; name: string }
type Cohort = {
  id: string; title: string; course_id: string | null; company_id: string | null;
  starts_at: string; ends_at: string | null; max_seats: number;
  modality: string | null; notes: string | null; status: string;
  image_url?: string | null;
}

const initialState: CohortActionResult = { error: null }

const MODALITIES = ['virtual', 'in-person', 'hybrid']
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CARD_HUES = [
  { from: '#7C3AED', to: '#22D3EE' },
  { from: '#06B6D4', to: '#10B981' },
  { from: '#F472B6', to: '#FB923C' },
  { from: '#FB7185', to: '#A78BFA' },
  { from: '#34D399', to: '#60A5FA' },
  { from: '#FBBF24', to: '#F472B6' },
]
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_HUES[h % CARD_HUES.length]
}

function toDateInput(iso: string | null) {
  if (!iso) return ''
  return iso.split('T')[0]
}

// ---------------------------------------------------------------------------
// Course picker modal
// ---------------------------------------------------------------------------

function CoursePickerModal({
  courses,
  picked,
  onToggle,
  onClose,
}: {
  courses: Course[]
  picked: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = query.trim()
    ? courses.filter(c => c.title.toLowerCase().includes(query.toLowerCase()))
    : courses

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-[#0E0E1B] shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold">Select courses</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary px-3 py-2.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Course grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BookOpen size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No courses found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map(course => {
                const selected = picked.includes(course.id)
                const hue = hueFor(course.id)
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => onToggle(course.id)}
                    className={cn(
                      'group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all',
                      selected
                        ? 'border-primary/60 ring-1 ring-primary/30'
                        : 'border-border hover:border-white/20',
                    )}
                  >
                    {/* Gradient banner */}
                    <div
                      className="relative grid aspect-[16/7] place-items-center"
                      style={{ background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_60%)]" />
                      <BookOpen size={22} className="text-white/80 drop-shadow" />
                      {selected && (
                        <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.7)]">
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </span>
                      )}
                    </div>
                    {/* Title */}
                    <div className="bg-card px-3 py-2.5">
                      <p className={cn(
                        'text-[12.5px] font-medium leading-snug line-clamp-2',
                        selected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                      )}>
                        {course.title}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-[13px] text-muted-foreground">
            {picked.length > 0 ? `${picked.length} selected` : 'No courses selected'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

interface Props {
  cohort?: Cohort
  courses: Course[]
  companies: Company[]
  defaultCompanyId?: string
  lockCompany?: boolean
  redirectBase?: string
  selectedCourseIds?: string[]
}

export function CohortForm({ cohort, courses, companies, defaultCompanyId, lockCompany, redirectBase, selectedCourseIds }: Props) {
  const isEdit = !!cohort

  const initSelected = (): string[] => {
    if (selectedCourseIds && selectedCourseIds.length > 0) return selectedCourseIds
    if (cohort?.course_id) return [cohort.course_id]
    return []
  }

  const [pickedCourses, setPickedCourses] = useState<string[]>(initSelected)
  const [modalOpen, setModalOpen] = useState(false)

  const action = isEdit ? updateCohortAction : createCohortAction
  const [state, formAction, isPending] = useActionState(action, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.success && !isEdit && state.id) {
      router.push(`${redirectBase ?? '/admin/cohorts'}/${state.id}?tab=members&step=2`)
    }
  }, [state.success, state.id, isEdit, router, redirectBase])

  function toggleCourse(id: string) {
    setPickedCourses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <>
      {modalOpen && (
        <CoursePickerModal
          courses={courses}
          picked={pickedCourses}
          onToggle={toggleCourse}
          onClose={() => setModalOpen(false)}
        />
      )}

      <form action={formAction} className="space-y-4">
        {isEdit && <input type="hidden" name="cohort_id" value={cohort.id} />}

        {/* Hidden inputs for selected courses */}
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

        {/* Course picker */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium">Courses</label>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published courses available.</p>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
              >
                <Plus size={14} />
                {pickedCourses.length === 0 ? 'Add courses' : 'Edit selection'}
              </button>

              {/* Selected chips */}
              {pickedCourses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pickedCourses.map(id => {
                    const course = courses.find(c => c.id === id)
                    if (!course) return null
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-foreground"
                      >
                        {course.title}
                        <button
                          type="button"
                          onClick={() => toggleCourse(id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Remove ${course.title}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
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
          <label className="text-[13px] font-medium" htmlFor="image_url">Cover image URL</label>
          <input
            id="image_url" name="image_url" type="url"
            defaultValue={cohort?.image_url ?? ''}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            placeholder="https://example.com/cohort-banner.jpg (optional)"
          />
          <p className="text-[11.5px] text-muted-foreground">
            Optional — appears on the cohort card. Falls back to a gradient when blank.
          </p>
        </div>

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
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save & continue →'}
        </button>
      </form>
    </>
  )
}
