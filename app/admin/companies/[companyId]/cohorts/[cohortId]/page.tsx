import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CohortForm } from '@/components/admin/CohortForm'
import { CohortEnrollmentPanel } from '@/components/admin/CohortEnrollmentPanel'
import { CohortInvitationPanel } from '@/components/admin/CohortInvitationPanel'
import { CohortActionsBar } from '@/components/admin/CohortActionsBar'
import { CohortTabs } from '@/components/admin/CohortTabs'
import { CohortChatPlaceholder } from '@/components/cohorts/CohortChatPlaceholder'
import { getCompanyCohortDetailForAdmin } from '@/lib/queries/admin/companies.queries'

export default async function CompanyCohortEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; cohortId: string }>
  searchParams: Promise<{ tab?: string; step?: string }>
}) {
  const { companyId, cohortId } = await params
  const { tab, step } = await searchParams

  const detail = await getCompanyCohortDetailForAdmin(companyId, cohortId)
  if (detail === null) notFound()

  const { cohort, formOptions, selectedCourseIds, enrollments, invitations } = detail
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
          <h2 className="mt-3 text-xl font-bold">{cohort.title}</h2>
        </div>
        <CohortActionsBar
          cohortId={cohortId}
          status={cohort.status}
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
                cohort={cohort}
                courses={formOptions.courses}
                companies={formOptions.companies}
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
            content: <CohortInvitationPanel cohortId={cohortId} invitations={invitations} />,
          },
          {
            id: 'chat',
            label: 'Chat',
            content: <CohortChatPlaceholder cohortTitle={cohort.title} />,
          },
        ]}
      />
    </div>
  )
}
