import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { CompanyCard } from '@/components/companies/CompanyCard'

type CompanyRow = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website: string | null
  deleted_at: string | null
}

export default async function AdminCompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  // company_owner goes directly to their workspace — no list needed
  if (profile?.role === 'company_owner' && profile?.org_id) {
    redirect(`/admin/companies/${profile.org_id}`)
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any
  const [companiesResult, cohortCountsResult, learnerCountsResult] = await Promise.all([
    adminAny
      .from('organizations')
      .select('id, name, slug, description, logo_url, website, deleted_at')
      .order('name', { ascending: true }),
    adminAny
      .from('cohorts')
      .select('company_id'),
    adminAny
      .from('profiles')
      .select('org_id')
      .not('org_id', 'is', null),
  ])

  const allRows = (companiesResult.data ?? []) as CompanyRow[]
  const rows = allRows.filter((c) => !c.deleted_at)
  const archivedRows = allRows.filter((c) => c.deleted_at)

  // Build counts maps
  const cohortCount = new Map<string, number>()
  for (const r of (cohortCountsResult.data ?? []) as { company_id: string | null }[]) {
    if (!r.company_id) continue
    cohortCount.set(r.company_id, (cohortCount.get(r.company_id) ?? 0) + 1)
  }
  const learnerCount = new Map<string, number>()
  for (const r of (learnerCountsResult.data ?? []) as { org_id: string | null }[]) {
    if (!r.org_id) continue
    learnerCount.set(r.org_id, (learnerCount.get(r.org_id) ?? 0) + 1)
  }

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
