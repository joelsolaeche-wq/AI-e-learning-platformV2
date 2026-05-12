import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, UsersRound } from 'lucide-react'
import { CohortCard } from '@/components/cohorts/CohortCard'
import { listCompanyCohorts } from '@/lib/queries/admin/companies.queries'

export default async function CompanyCohortListPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const result = await listCompanyCohorts(companyId)
  if (result === null) redirect('/admin')
  const { cohorts: rows, memberCount } = result

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} cohort{rows.length !== 1 ? 's' : ''}
        </p>
        <Link
          href="cohorts/new"
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> New cohort
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <UsersRound size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No cohorts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a cohort to schedule a course run for this company.
          </p>
          <Link
            href="cohorts/new"
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> New cohort
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((cohort) => (
            <CohortCard
              key={cohort.id}
              variant="admin"
              cohort={{
                id: cohort.id,
                title: cohort.title,
                status: cohort.status,
                starts_at: cohort.starts_at,
                ends_at: cohort.ends_at,
                image_url: cohort.image_url,
              }}
              subtitle={cohort.modality ? cohort.modality.charAt(0).toUpperCase() + cohort.modality.slice(1) : null}
              memberCount={memberCount.get(cohort.id) ?? 0}
              primaryHref={`cohorts/${cohort.id}/stats`}
              secondaryAction={{ label: 'Edit', href: `cohorts/${cohort.id}` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
