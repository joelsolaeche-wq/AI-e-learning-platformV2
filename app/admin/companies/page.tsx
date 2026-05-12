import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { CompanyCard } from '@/components/companies/CompanyCard'
import { listAllCompaniesForAdmin } from '@/lib/queries/admin/companies.queries'

export default async function AdminCompaniesPage() {
  const result = await listAllCompaniesForAdmin()
  if (result === null) redirect('/auth/login')
  if (result.kind === 'redirect') redirect(`/admin/companies/${result.orgId}`)

  const { active: rows, archived: archivedRows, cohortCount, learnerCount } = result.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} active{archivedRows.length > 0 ? `, ${archivedRows.length} archived` : ''}
          </p>
        </div>
        <Link
          href="/admin/companies/new"
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          New company
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No companies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first company to assign users and courses.
          </p>
          <Link
            href="/admin/companies/new"
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> New company
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((company) => (
            <CompanyCard
              key={company.id}
              company={{ id: company.id, name: company.name, logo_url: company.logo_url }}
              cohortCount={cohortCount.get(company.id) ?? 0}
              learnerCount={learnerCount.get(company.id) ?? 0}
              href={`/admin/companies/${company.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
