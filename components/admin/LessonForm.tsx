'use client'

import { useActionState } from 'react'
import { updateLessonAction, type CourseActionResult } from '@/lib/actions/courses.actions'

type Lesson = {
  id: string
  title: string
  mux_playback_id: string | null
  duration_seconds: number | null
  transcript: string | null
}

const initialState: CourseActionResult = { error: null }

export function LessonForm({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [state, formAction, isPending] = useActionState(updateLessonAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="lesson_id" value={lesson.id} />
      <input type="hidden" name="course_id" value={courseId} />

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="title">Title *</label>
        <input
          id="title"
          name="title"
          required
          defaultValue={lesson.title}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="mux_playback_id">Mux Playback ID</label>
        <input
          id="mux_playback_id"
          name="mux_playback_id"
          defaultValue={lesson.mux_playback_id ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
        />
        <p className="text-[11px] text-muted-foreground">Found in Mux Dashboard → Assets → Playback IDs</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="duration_seconds">Duration (seconds)</label>
        <input
          id="duration_seconds"
          name="duration_seconds"
          type="number"
          min="1"
          defaultValue={lesson.duration_seconds ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="600"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="transcript">Transcript</label>
        <textarea
          id="transcript"
          name="transcript"
          rows={8}
          defaultValue={lesson.transcript ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-y"
          placeholder="Paste the lesson transcript here. The AI tutor uses this as context."
        />
        <p className="text-[11px] text-muted-foreground">Used as context by the AI tutor during the lesson.</p>
      </div>

      {state.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Saved successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save lesson'}
      </button>
    </form>
  )
}
