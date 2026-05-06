import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CohortForm } from '@/components/admin/CohortForm'
import { CohortEnrollmentPanel } from '@/components/admin/CohortEnrollmentPanel'
import { CohortInvitationPanel } from '@/components/admin/CohortInvitationPanel'
import { CohortActionsBar } from '@/components/admin/CohortActionsBar'

export default async function CompanyCohortEditPage({
  params,
}: {
  params: Promise<{ companyId: string; cohortId: string }>
}) {
  const { companyId, cohortId } = await params
  const admin = createAdminClient()

  const [cohortRes, coursesRes, companiesRes, cohortCoursesRes, enrollmentsRes, invitationsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('cohorts').select('*').eq('id', cohortId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title').eq('is_published', true).order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('id, name').order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('cohort_courses').select('course_id').eq('cohort_id', cohortId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('enrollments')
      .select('id, status, enrolled_at, profiles(id, email, full_name, role)')
      .eq('cohort_id', cohortId)
      .order('enrolled_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('cohort_invitations')
      .select('id, code, max_uses, uses_count, expires_at, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
  ])

  if (!cohortRes.data) notFound()

  // Guard: this cohort must belong to this company's workspace
  if (cohortRes.data.company_id !== companyId) notFound()

  const selectedCourseIds: string[] = (cohortCoursesRes.data ?? []).map(
    (r: { course_id: string }) => r.course_id,
  )

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="../cohorts"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} /> Cohorts
          </Link>
          <h2 className="mt-3 text-xl font-bold">{cohortRes.data.title}</h2>
        </div>
        <CohortActionsBar cohortId={cohortId} status={cohortRes.data.status} />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Details</h3>
        <CohortForm
          cohort={cohortRes.data}
          courses={coursesRes.data ?? []}
          companies={companiesRes.data ?? []}
          selectedCourseIds={selectedCourseIds}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Enrollments ({(enrollmentsRes.data ?? []).length})
        </h3>
        <CohortEnrollmentPanel cohortId={cohortId} enrollments={enrollmentsRes.data ?? []} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Invitation codes</h3>
        <CohortInvitationPanel cohortId={cohortId} invitations={invitationsRes.data ?? []} />
      </section>
    </div>
  )
}
