'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  createLessonAction,
  deleteLessonAction,
} from '@/lib/actions/courses.actions'
import Link from 'next/link'

type Lesson = {
  id: string
  title: string
  position: number
  mux_playback_id: string | null
  duration_seconds: number | null
}

type Module = {
  id: string
  title: string
  position: number
  lessons: Lesson[]
}

interface Props {
  courseId: string
  modules: Module[]
}

function LessonRow({ lesson, courseId, moduleId, onDeleted }: {
  lesson: Lesson
  courseId: string
  moduleId: string
  onDeleted: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return
    startTransition(async () => {
      await deleteLessonAction(lesson.id, courseId)
      onDeleted(lesson.id)
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
      <span className="w-5 text-center text-[11px] text-muted-foreground">{lesson.position}</span>
      <span className="flex-1 font-medium">{lesson.title}</span>
      {lesson.mux_playback_id && (
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">video</span>
      )}
      <Link
        href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
        className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
      >
        <Pencil size={12} />
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50 transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function ModuleBlock({ mod, courseId, onModuleDeleted }: {
  mod: Module
  courseId: string
  onModuleDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [lessons, setLessons] = useState<Lesson[]>(mod.lessons)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(mod.title)
  const [addingLesson, setAddingLesson] = useState(false)
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSaveTitle() {
    if (!titleValue.trim()) return
    startTransition(async () => {
      await updateModuleAction(mod.id, courseId, titleValue.trim())
      setEditingTitle(false)
    })
  }

  function handleDeleteModule() {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return
    startTransition(async () => {
      await deleteModuleAction(mod.id, courseId)
      onModuleDeleted(mod.id)
    })
  }

  function handleAddLesson() {
    if (!newLessonTitle.trim()) return
    const position = lessons.length + 1
    startTransition(async () => {
      const res = await createLessonAction(mod.id, courseId, newLessonTitle.trim(), position)
      if (res.id) {
        setLessons(prev => [...prev, { id: res.id!, title: newLessonTitle.trim(), position, mux_playback_id: null, duration_seconds: null }])
        setNewLessonTitle('')
        setAddingLesson(false)
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-white/[0.02] px-3 py-2.5">
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {editingTitle ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              className="flex-1 rounded-md border border-primary/40 bg-secondary px-2 py-1 text-sm outline-none"
              autoFocus
            />
            <button onClick={handleSaveTitle} disabled={isPending} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={() => { setEditingTitle(false); setTitleValue(mod.title) }} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold">{mod.title}</span>
            <button onClick={() => setEditingTitle(true)} className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
              <Pencil size={12} />
            </button>
          </>
        )}
        <button
          onClick={handleDeleteModule}
          disabled={isPending}
          className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-1.5 p-3">
          {lessons.length === 0 && !addingLesson && (
            <p className="text-xs text-muted-foreground px-1">No lessons yet.</p>
          )}
          {lessons.map(lesson => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              moduleId={mod.id}
              onDeleted={id => setLessons(prev => prev.filter(l => l.id !== id))}
            />
          ))}

          {addingLesson ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-secondary px-3 py-2">
              <input
                value={newLessonTitle}
                onChange={e => setNewLessonTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLesson(); if (e.key === 'Escape') setAddingLesson(false) }}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Lesson title…"
                autoFocus
              />
              <button onClick={handleAddLesson} disabled={isPending || !newLessonTitle.trim()} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                <Check size={14} />
              </button>
              <button onClick={() => setAddingLesson(false)} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingLesson(true)}
              className={cn('flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-colors', lessons.length > 0 && 'mt-1')}
            >
              <Plus size={12} /> Add lesson
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function CourseModuleEditor({ courseId, modules: initialModules }: Props) {
  const [modules, setModules] = useState<Module[]>(initialModules)
  const [addingModule, setAddingModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAddModule() {
    if (!newModuleTitle.trim()) return
    const position = modules.length + 1
    startTransition(async () => {
      const res = await createModuleAction(courseId, newModuleTitle.trim(), position)
      if (res.id) {
        setModules(prev => [...prev, { id: res.id!, title: newModuleTitle.trim(), position, lessons: [] }])
        setNewModuleTitle('')
        setAddingModule(false)
      }
    })
  }

  return (
    <div className="space-y-2">
      {modules.length === 0 && !addingModule && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No modules yet. Add one to start building the curriculum.</p>
        </div>
      )}

      {modules.map(mod => (
        <ModuleBlock
          key={mod.id}
          mod={mod}
          courseId={courseId}
          onModuleDeleted={id => setModules(prev => prev.filter(m => m.id !== id))}
        />
      ))}

      {addingModule ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card px-4 py-3">
          <input
            value={newModuleTitle}
            onChange={e => setNewModuleTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddModule(); if (e.key === 'Escape') setAddingModule(false) }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Module title…"
            autoFocus
          />
          <button onClick={handleAddModule} disabled={isPending || !newModuleTitle.trim()} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
            <Check size={14} />
          </button>
          <button onClick={() => setAddingModule(false)} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingModule(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
        >
          <Plus size={14} /> Add module
        </button>
      )}
    </div>
  )
}
