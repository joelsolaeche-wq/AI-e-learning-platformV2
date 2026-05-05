import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Beaker, ChevronRight } from 'lucide-react'

type LessonRow = {
  id: string
  title: string
  position: number
  module_id: string
  modules: {
    title: string
    position: number
    course_id: string
    courses: { title: string } | null
  } | null
}

type LabRow = { lesson_id: string }

export default async function AdminLabsPage() {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lessonsResult = await (admin as any)
    .from('lessons')
    .select(
      'id, title, position, module_id, modules(title, position, course_id, courses(title))',
    )
    .order('title', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labsResult = await (admin as any).from('labs').select('lesson_id')

  const lessons = (lessonsResult.data ?? []) as LessonRow[]
  const labs = (labsResult.data ?? []) as LabRow[]
  const labLessonIds = new Set(labs.map((l) => l.lesson_id))

  // Group by course → module for display.
  type Group = {
    courseTitle: string
    modules: Map<string, { moduleTitle: string; modulePos: number; lessons: LessonRow[] }>
  }
  const grouped = new Map<string, Group>()
  for (const lesson of lessons) {
    const courseTitle = lesson.modules?.courses?.title ?? 'Unknown course'
    const moduleId = lesson.module_id
    const moduleTitle = lesson.modules?.title ?? 'Unknown module'
    const modulePos = lesson.modules?.position ?? 0

    if (!grouped.has(courseTitle)) grouped.set(courseTitle, { courseTitle, modules: new Map() })
    const g = grouped.get(courseTitle)!
    if (!g.modules.has(moduleId)) {
      g.modules.set(moduleId, { moduleTitle, modulePos, lessons: [] })
    }
    g.modules.get(moduleId)!.lessons.push(lesson)
  }

  const courseGroups = Array.from(grouped.values()).sort((a, b) =>
    a.courseTitle.localeCompare(b.courseTitle),
  )
  for (const g of courseGroups) {
    for (const m of g.modules.values()) {
      m.lessons.sort((a, b) => a.position - b.position)
    }
  }

  const labCount = labLessonIds.size

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Labs</h1>
        <p className="text-sm text-muted-foreground">
          {labCount} of {lessons.length} lessons have a lab. Click a lesson to author or edit its lab.
        </p>
      </div>

      <div className="space-y-6">
        {courseGroups.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No lessons yet. Create lessons first, then return to author labs.
          </div>
        )}

        {courseGroups.map((g) => {
          const moduleList = Array.from(g.modules.values()).sort(
            (a, b) => a.modulePos - b.modulePos,
          )
          return (
            <section key={g.courseTitle} className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {g.courseTitle}
              </h2>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {moduleList.map((m, mIdx) => (
                  <div key={m.moduleTitle + mIdx} className="border-b border-border last:border-b-0">
                    <div className="bg-secondary/30 px-4 py-2 text-[12px] font-semibold text-foreground/80">
                      Module {m.modulePos}: {m.moduleTitle}
                    </div>
                    <ul>
                      {m.lessons.map((lesson) => {
                        const hasLab = labLessonIds.has(lesson.id)
                        return (
                          <li key={lesson.id}>
                            <Link
                              href={`/admin/labs/${lesson.id}`}
                              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Beaker
                                  size={14}
                                  className={hasLab ? 'text-primary' : 'text-muted-foreground/50'}
                                />
                                <span className="truncate text-[13.5px]">{lesson.title}</span>
                                {hasLab && (
                                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    Has lab
                                  </span>
                                )}
                              </div>
                              <ChevronRight size={14} className="text-muted-foreground" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
