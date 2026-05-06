import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CohortForm } from '@/components/admin/CohortForm'
import { CohortEnrollmentPanel } from '@/components/admin/CohortEnrollmentPanel'
import { CohortInvitationPanel } from '@/components/admin/CohortInvitationPanel'
import { CohortActionsBar } from '@/components/admin/CohortActionsBar'
import { CohortTabs } from '@/components/admin/CohortTabs'

export default async function CompanyCohortEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; cohortId: string }>
  searchParams: Promise<{ tab?: string; step?: string }>
}) {
  const { companyId, cohortId } = await params
  const { tab, step } = await searchParams
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

  const enrollments = enrollmentsRes.data ?? []
  const isStep2 = step === '2'

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
        <CohortActionsBar
          cohortId={cohortId}
          status={cohortRes.data.status}
          backPath={`/admin/companies/${companyId}/cohorts`}
        />
      </div>

      <CohortTabs
        defaultTab={tab ?? 'details'}
        tabs={[
          {
            id: 'details',
            label: 'Details',
            content: (
              <CohortForm
                cohort={cohortRes.data}
                courses={coursesRes.data ?? []}
                companies={companiesRes.data ?? []}
                selectedCourseIds={selectedCourseIds}
              />
            ),
          },
          {
            id: 'members',
            label: `Members (${enrollments.length})`,
            content: (
              <div className="space-y-5">
                {isStep2 && (
                  <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <div className="flex items-center gap-2 opacity-40">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium">
                        1
                      </span>
                      <span className="text-sm line-through">Cohort details</span>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        2
                      </span>
                      <span className="text-sm font-medium">Add members</span>
                    </div>
                    <span className="ml-auto text-xs text-emerald-400">Cohort created ✓</span>
                  </div>
                )}
                <CohortEnrollmentPanel cohortId={cohortId} enrollments={enrollments} />
              </div>
            ),
          },
          {
            id: 'invitations',
            label: 'Invitation codes',
            content: <CohortInvitationPanel cohortId={cohortId} invitations={invitationsRes.data ?? []} />,
          },
        ]}
      />
    </div>
  )
}
