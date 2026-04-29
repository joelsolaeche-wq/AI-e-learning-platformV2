// components/CurriculumTree.tsx
// Shared curriculum view used by both the lesson page sidebar and the catalog
// course-detail page. Two visual variants: 'compact' (320–360px sidebar) and
// 'full' (catalog body width). Same data shape both ways.
'use client'

import Link from 'next/link'
import { Check, PlayCircle, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type CurriculumLesson = {
  id: string
  title: string
  position: number
  duration_seconds: number | null
  completed: boolean
}

export type CurriculumModule = {
  id: string
  title: string
  position: number
  lessons: CurriculumLesson[]
}

interface CurriculumTreeProps {
  modules: CurriculumModule[]
  currentLessonId?: string
  variant?: 'compact' | 'full'
  /** When set, lesson rows link to /dashboard/lesson/{id}. Defaults true. */
  linksToLessons?: boolean
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (variant_isShort(seconds)) return `${m}:${String(s).padStart(2, '0')}`
  return `${m} min`
}
function variant_isShort(s: number) { return s < 600 } // under 10min → mm:ss feel

export function CurriculumTree({
  modules,
  currentLessonId,
  variant = 'full',
  linksToLessons = true,
}: CurriculumTreeProps) {
  // Auto-expand only the module containing the current lesson; others collapsed in compact mode
  const moduleWithCurrent = currentLessonId
    ? modules.find((m) => m.lessons.some((l) => l.id === currentLessonId))?.id
    : undefined

  const isCompact = variant === 'compact'

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Compact: only current module expanded by default. Full: all expanded.
    if (isCompact) {
      return new Set(moduleWithCurrent ? [moduleWithCurrent] : [modules[0]?.id].filter(Boolean) as string[])
    }
    return new Set(modules.map((m) => m.id))
  })

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={cn('flex flex-col', isCompact ? 'gap-2' : 'gap-3')}>
      {modules.map((mod, i) => {
        const isOpen = expanded.has(mod.id)
        const moduleLessons = [...mod.lessons].sort((a, b) => a.position - b.position)
        const completedInModule = moduleLessons.filter((l) => l.completed).length
        const totalInModule = moduleLessons.length
        const containsCurrent = moduleLessons.some((l) => l.id === currentLessonId)
        const moduleSeconds = moduleLessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0)
        const moduleMinutes = Math.round(moduleSeconds / 60)

        return (
          <div
            key={mod.id}
            className={cn(
              'overflow-hidden rounded-2xl border bg-card transition-colors',
              containsCurrent ? 'border-primary/30 ring-1 ring-primary/15' : 'border-border',
            )}
          >
            {/* Module header — clickable to expand/collapse */}
            <button
              type="button"
              onClick={() => toggle(mod.id)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-border bg-secondary/20 transition-colors hover:bg-secondary/40',
                isCompact ? 'px-3 py-2.5' : 'px-5 py-3.5',
                !isOpen && 'border-b-0',
              )}
            >
              <div
                className={cn(
                  'grid flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-primary/20 to-accent/15 font-mono font-bold text-primary ring-1 ring-primary/30',
                  isCompact ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-[12px]',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </div>

              <div className="min-w-0 flex-1 text-left">
                <div
                  className={cn(
                    'font-semibold uppercase tracking-[0.08em] text-muted-foreground',
                    isCompact ? 'text-[9.5px]' : 'text-[10px]',
                  )}
                >
                  Module {i + 1}
                </div>
                <div
                  className={cn(
                    'truncate font-bold tracking-tight',
                    isCompact ? 'text-[12.5px]' : 'text-[14.5px]',
                  )}
                >
                  {mod.title}
                </div>
              </div>

              {/* Progress + chevron */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {totalInModule > 0 && (
                  <div className="text-right">
                    <div
                      className={cn(
                        'font-mono tabular-nums',
                        isCompact ? 'text-[11px]' : 'text-[12px]',
                        completedInModule === totalInModule
                          ? 'text-emerald-400'
                          : completedInModule > 0
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                      )}
                    >
                      {completedInModule}/{totalInModule}
                    </div>
                    {!isCompact && moduleMinutes > 0 && (
                      <div className="text-[10.5px] text-muted-foreground">{moduleMinutes} min</div>
                    )}
                  </div>
                )}
                {isOpen ? (
                  <ChevronDown size={isCompact ? 13 : 14} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={isCompact ? 13 : 14} className="text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Lessons */}
            {isOpen && (
              <div className="flex flex-col">
                {moduleLessons.map((lesson, li) => {
                  const isCurrent = lesson.id === currentLessonId
                  const Wrap: React.ElementType = linksToLessons ? Link : 'div'
                  const wrapProps = linksToLessons
                    ? { href: `/dashboard/lesson/${lesson.id}` }
                    : {}

                  return (
                    <Wrap
                      key={lesson.id}
                      {...wrapProps}
                      className={cn(
                        'group flex items-center border-t border-border/40 transition-colors first:border-t-0',
                        isCompact ? 'gap-2.5 px-3 py-2' : 'gap-3 px-5 py-2.5',
                        isCurrent
                          ? 'bg-primary/[0.10] text-foreground'
                          : linksToLessons
                            ? 'hover:bg-secondary/30'
                            : '',
                      )}
                    >
                      {/* Status indicator */}
                      <div
                        className={cn(
                          'grid flex-shrink-0 place-items-center rounded-full font-mono font-bold transition-colors',
                          isCompact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-[10.5px]',
                          lesson.completed
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isCurrent
                              ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                              : 'bg-white/[0.06] text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary',
                        )}
                      >
                        {lesson.completed ? (
                          <Check size={isCompact ? 10 : 11} strokeWidth={3} />
                        ) : isCurrent ? (
                          <PlayCircle size={isCompact ? 10 : 12} fill="currentColor" />
                        ) : (
                          li + 1
                        )}
                      </div>

                      {/* Title */}
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate',
                          isCompact ? 'text-[12px]' : 'text-[13px]',
                          isCurrent
                            ? 'font-semibold text-foreground'
                            : lesson.completed
                              ? 'text-foreground/70'
                              : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      >
                        {lesson.title}
                      </span>

                      {/* Duration */}
                      {lesson.duration_seconds && (
                        <span
                          className={cn(
                            'shrink-0 font-mono tabular-nums',
                            isCompact ? 'text-[10.5px]' : 'text-[11px]',
                            'text-muted-foreground/60',
                          )}
                        >
                          {fmtDuration(lesson.duration_seconds)}
                        </span>
                      )}

                      {/* Lock for non-link-mode locked items */}
                      {!linksToLessons && !lesson.completed && !isCurrent && (
                        <Lock size={11} className="shrink-0 text-muted-foreground/40" />
                      )}
                    </Wrap>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
