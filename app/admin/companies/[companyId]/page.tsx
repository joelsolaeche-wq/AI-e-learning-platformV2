import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { CompanyForm } from '@/components/admin/CompanyForm'
import { CompanyArchiveButton } from '@/components/admin/CompanyArchiveButton'
import { UsersRound, BookOpen, Users } from 'lucide-react'
import { getCompanyOverview } from '@/lib/queries/admin/companies.queries'

export default async function CompanyOverviewPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params

  const overview = await getCompanyOverview(companyId)
  if (overview === null) redirect('/admin')
  if (!overview.company) notFound()
  const { company, cohortCount, courseCount, memberCount } = overview

  const isArchived = !!company.deleted_at
  const stats = [
    { label: 'Cohorts', value: cohortCount, href: `cohorts`, icon: UsersRound },
    { label: 'Courses assigned', value: courseCount, href: `courses`, icon: BookOpen },
    { label: 'Members', value: memberCount, href: `members`, icon: Users },
  ]

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {isArchived && (
            <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs text-slate-400">
              Archived
            </span>
          )}
        </div>
        <CompanyArchiveButton companyId={companyId} isArchived={isArchived} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <Icon size={16} className="mb-2 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.6} />
            <div className="text-2xl font-bold tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Details</h2>
        <CompanyForm company={company} />
      </section>
    </div>
  )
}
