import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'

export default async function AdminCompaniesPage() {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (admin as any)
    .from('organizations')
    .select('id, name, slug, description, logo_url, website, deleted_at')
    .order('name', { ascending: true })

  const allRows = companies ?? []
  const rows = allRows.filter((c: { deleted_at: string | null }) => !c.deleted_at)
  const archivedRows = allRows.filter((c: { deleted_at: string | null }) => c.deleted_at)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">{rows.length} active{archivedRows.length > 0 ? `, ${archivedRows.length} archived` : ''}</p>
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
          <p className="mt-1 text-sm text-muted-foreground">Create your first company to assign users and courses.</p>
          <Link
            href="/admin/companies/new"
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> New company
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Website</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((company: { id: string; name: string; slug: string; description: string | null; logo_url: string | null; website: string | null }) => (
                <tr key={company.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="h-7 w-7 rounded-md object-cover" />
                      ) : (
                        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary text-xs font-bold">
                          {company.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{company.name}</div>
                        {company.description && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">{company.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{company.slug}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{company.website ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/companies/${company.id}`}
                      className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
