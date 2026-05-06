import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { CompanyCourseAssignment } from '@/components/admin/CompanyCourseAssignment'
import { ExternalLink } from 'lucide-react'

type CourseRow = { id: string; title: string; slug: string }

export default async function CompanyCoursesPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const admin = createAdminClient()

  const [allCoursesRes, assignedRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title, slug').order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('course_companies').select('course_id').eq('company_id', companyId),
  ])

  const assignedCourseIds: string[] = (assignedRes.data ?? []).map((r: { course_id: string }) => r.course_id)
  const allCourses: CourseRow[] = allCoursesRes.data ?? []
  const assignedCourses = allCourses.filter((c) => assignedCourseIds.includes(c.id))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Toggle which courses are visible to members of this company. Use <strong>Open editor</strong> to edit the course content (changes affect all companies that share this course).
        </p>
      </div>

      <CompanyCourseAssignment
        companyId={companyId}
        allCourses={allCourses}
        assignedCourseIds={assignedCourseIds}
      />

      {assignedCourses.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Open editor (shared asset)</p>
          <div className="space-y-1">
            {assignedCourses.map((course) => (
              <Link
                key={course.id}
                href={`/admin/courses/${course.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors mr-2"
              >
                <ExternalLink size={12} />
                {course.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
