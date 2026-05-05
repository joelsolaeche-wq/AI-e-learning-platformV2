'use client'

import { useTransition } from 'react'
import { assignCourseToCompanyAction, unassignCourseFromCompanyAction } from '@/lib/actions/companies.actions'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Course = { id: string; title: string; slug: string }

interface Props {
  companyId: string
  allCourses: Course[]
  assignedCourseIds: string[]
}

export function CompanyCourseAssignment({ companyId, allCourses, assignedCourseIds }: Props) {
  const [isPending, startTransition] = useTransition()

  function toggle(courseId: string, isCurrentlyAssigned: boolean) {
    startTransition(async () => {
      if (isCurrentlyAssigned) {
        await unassignCourseFromCompanyAction(courseId, companyId)
      } else {
        await assignCourseToCompanyAction(courseId, companyId)
      }
    })
  }

  if (allCourses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No published courses available. Publish a course first.</p>
    )
  }

  return (
    <div className="space-y-1.5">
      {allCourses.map((course) => {
        const assigned = assignedCourseIds.includes(course.id)
        return (
          <button
            key={course.id}
            onClick={() => toggle(course.id, assigned)}
            disabled={isPending}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:opacity-60',
              assigned
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
            )}
          >
            <span className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px]',
              assigned ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
            )}>
              {assigned && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="font-medium">{course.title}</span>
          </button>
        )
      })}
      <p className="pt-1 text-xs text-muted-foreground">
        Toggle which courses are visible to members of this company.
      </p>
    </div>
  )
}
