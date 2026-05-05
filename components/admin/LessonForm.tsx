'use client'

import { useActionState, useState } from 'react'
import { updateLessonAction, type CourseActionResult } from '@/lib/actions/courses.actions'
import { Video, FileText, PresentationIcon, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

type Lesson = {
  id: string
  title: string
  mux_playback_id: string | null
  duration_seconds: number | null
  transcript: string | null
  content_type?: string | null
  document_url?: string | null
  slides_url?: string | null
  notebook_url?: string | null
}

const initialState: CourseActionResult = { error: null }

const CONTENT_TYPES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'document', label: 'Document / PDF', icon: FileText },
  { value: 'slides', label: 'Slides', icon: PresentationIcon },
  { value: 'notebook', label: 'Jupyter Notebook', icon: BookOpen },
  { value: 'mixed', label: 'Mixed (video + docs)', icon: null },
]

export function LessonForm({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [state, formAction, isPending] = useActionState(updateLessonAction, initialState)
  const [contentType, setContentType] = useState(lesson.content_type ?? 'video')

  const showVideo = contentType === 'video' || contentType === 'mixed'
  const showDocument = contentType === 'document' || contentType === 'mixed'
  const showSlides = contentType === 'slides' || contentType === 'mixed'
  const showNotebook = contentType === 'notebook' || contentType === 'mixed'

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lesson_id" value={lesson.id} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="content_type" value={contentType} />

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="title">Title *</label>
        <input
          id="title" name="title" required
          defaultValue={lesson.title}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Content type selector */}
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium">Content type</label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setContentType(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                contentType === value
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
              )}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Video */}
      {showVideo && (
        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Video</legend>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="mux_playback_id">Mux Playback ID</label>
            <input
              id="mux_playback_id" name="mux_playback_id"
              defaultValue={lesson.mux_playback_id ?? ''}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
            />
            <p className="text-[11px] text-muted-foreground">Mux Dashboard → Assets → Playback IDs</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="duration_seconds">Duration (seconds)</label>
            <input
              id="duration_seconds" name="duration_seconds" type="number" min="1"
              defaultValue={lesson.duration_seconds ?? ''}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="600"
            />
          </div>
        </fieldset>
      )}

      {/* Document / PDF */}
      {showDocument && (
        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Document / PDF</legend>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="document_url">Document URL</label>
            <input
              id="document_url" name="document_url" type="url"
              defaultValue={lesson.document_url ?? ''}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="https://… (PDF, Google Doc, Notion, etc.)"
            />
            <p className="text-[11px] text-muted-foreground">Link to a PDF, Google Doc, Notion page, or any readable URL.</p>
          </div>
        </fieldset>
      )}

      {/* Slides */}
      {showSlides && (
        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Slides</legend>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="slides_url">Slides URL</label>
            <input
              id="slides_url" name="slides_url" type="url"
              defaultValue={lesson.slides_url ?? ''}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="https://… (Google Slides, Canva, Figma, etc.)"
            />
            <p className="text-[11px] text-muted-foreground">Google Slides, Canva, Figma, PowerPoint online link.</p>
          </div>
        </fieldset>
      )}

      {/* Jupyter Notebook */}
      {showNotebook && (
        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Jupyter Notebook</legend>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium" htmlFor="notebook_url">Notebook URL</label>
            <input
              id="notebook_url" name="notebook_url" type="url"
              defaultValue={lesson.notebook_url ?? ''}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="https://… (GitHub, Colab, nbviewer, etc.)"
            />
            <p className="text-[11px] text-muted-foreground">GitHub .ipynb link, Google Colab, or nbviewer URL.</p>
          </div>
        </fieldset>
      )}

      {/* Transcript (always shown — used by AI tutor) */}
      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">AI Tutor context</legend>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="transcript">Transcript / Notes</label>
          <textarea
            id="transcript" name="transcript" rows={7}
            defaultValue={lesson.transcript ?? ''}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-y"
            placeholder="Paste the lesson transcript, notes, or key concepts here. The AI tutor uses this as context to answer learner questions."
          />
          <p className="text-[11px] text-muted-foreground">The AI tutor reads this to answer questions during the lesson.</p>
        </div>
      </fieldset>

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
        type="submit" disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save lesson'}
      </button>
    </form>
  )
}
