'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createCourseAction, updateCourseAction, type CourseActionResult } from '@/lib/actions/courses.actions'

type Course = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string | null
}

const initialState: CourseActionResult = { error: null }

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', desc: 'Not visible to learners' },
  { value: 'published', label: 'Published', desc: 'Visible to enrolled learners' },
  { value: 'archived', label: 'Archived', desc: 'Hidden, read-only' },
]

const STATUS_ACTIVE: Record<string, string> = {
  draft: 'border-amber-500/60 bg-amber-500/10 text-amber-300',
  published: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
  archived: 'border-slate-500/60 bg-slate-500/10 text-slate-300',
}

export function CourseForm({ course }: { course?: Course }) {
  const isEdit = !!course
  const action = isEdit ? updateCourseAction : createCourseAction
  const [state, formAction, isPending] = useActionState(action, initialState)
  const [selectedStatus, setSelectedStatus] = useState(course?.status ?? 'draft')
  const router = useRouter()

  useEffect(() => {
    if (state.success && !isEdit && state.id) {
      router.push(`/admin/courses/${state.id}`)
    }
  }, [state.success, state.id, isEdit, router])

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="course_id" value={course.id} />}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="title">Title *</label>
        <input
          id="title"
          name="title"
          required
          defaultValue={course?.title ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="Generative AI Fundamentals"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={course?.description ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-none"
          placeholder="What will learners achieve in this course?"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="thumbnail_url">Thumbnail URL</label>
        <input
          id="thumbnail_url"
          name="thumbnail_url"
          type="url"
          defaultValue={course?.thumbnail_url ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="https://example.com/thumbnail.jpg"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium">Status</label>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = selectedStatus === opt.value
            return (
              <label key={opt.value} className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelectedStatus(opt.value)}
                  className="sr-only"
                />
                <div className={`rounded-xl border px-3 py-2.5 text-center transition-all ${
                  isSelected
                    ? STATUS_ACTIVE[opt.value]
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-white/[0.03]'
                }`}>
                  <div className="text-[13px] font-medium">{opt.label}</div>
                  <div className="mt-0.5 text-[11px] opacity-70">{opt.desc}</div>
                </div>
              </label>
            )
          })}
        </div>
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
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create course'}
      </button>
    </form>
  )
}
