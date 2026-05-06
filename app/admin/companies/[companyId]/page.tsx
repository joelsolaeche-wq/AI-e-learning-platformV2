import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CompanyForm } from '@/components/admin/CompanyForm'
import { CompanyArchiveButton } from '@/components/admin/CompanyArchiveButton'
import { UsersRound, BookOpen, Users, FlaskConical } from 'lucide-react'

export default async function CompanyOverviewPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const admin = createAdminClient()

  const [companyRes, cohortsRes, coursesRes, membersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('*').eq('id', companyId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('cohorts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).neq('status', 'cancelled'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('course_companies').select('course_id', { count: 'exact', head: true }).eq('company_id', companyId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', companyId),
  ])

  if (!companyRes.data) notFound()

  const isArchived = !!companyRes.data.deleted_at

  const stats = [
    { label: 'Cohorts', value: cohortsRes.count ?? 0, href: `cohorts`, icon: UsersRound },
    { label: 'Courses assigned', value: coursesRes.count ?? 0, href: `courses`, icon: BookOpen },
    { label: 'Members', value: membersRes.count ?? 0, href: `members`, icon: Users },
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

      {/* Quick stats */}
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
        <CompanyForm company={companyRes.data} />
      </section>
    </div>
  )
}
