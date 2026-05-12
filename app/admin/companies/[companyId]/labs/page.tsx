import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, ChevronRight } from 'lucide-react'
import { getCompanyLabsView, type CompanyLessonForLabs } from '@/lib/queries/admin/companies.queries'

export default async function CompanyLabsPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const view = await getCompanyLabsView(companyId)
  if (view === null) redirect('/admin')
  const { assignedCourseIds, lessons, labByLesson } = view

  if (assignedCourseIds.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <FlaskConical size={32} className="mx-auto mb-3 text-muted-foreground/40" />
        <p className="font-medium">No labs yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign courses to this company first, then author labs from the lesson editor.
        </p>
      </div>
    )
  }

  // Group by course
  type Group = { courseTitle: string; courseId: string; lessons: CompanyLessonForLabs[] }
  const grouped = new Map<string, Group>()

  for (const lesson of lessons) {
    const mod = lesson.modules
    const courseId = mod?.courses?.id ?? mod?.course_id ?? ''
    const courseTitle = mod?.courses?.title ?? 'Unknown course'
    if (!grouped.has(courseId)) grouped.set(courseId, { courseTitle, courseId, lessons: [] })
    grouped.get(courseId)!.lessons.push(lesson)
  }

  const groups = Array.from(grouped.values()).sort((a, b) => a.courseTitle.localeCompare(b.courseTitle))
  const totalLessons = lessons.length
  const labCount = lessons.filter((l) => labByLesson.has(l.id)).length

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {labCount} of {totalLessons} lessons have a lab. Click a lesson to author or edit its lab.
      </p>

      {groups.map((group) => (
        <section key={group.courseId} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.courseTitle}
          </h3>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <ul>
              {group.lessons.map((lesson) => {
                const hasLab = labByLesson.has(lesson.id)
                return (
                  <li key={lesson.id} className="border-b border-border last:border-b-0">
                    <Link
                      href={`/admin/courses/${lesson.modules?.course_id ?? ''}/lessons/${lesson.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FlaskConical
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
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  )
}
