import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { BulkMembersPanel } from '@/components/admin/BulkMembersPanel'
import { listCompanyMembers } from '@/lib/queries/admin/companies.queries'

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  instructor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  company_owner: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  learner: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

export default async function CompanyMembersPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const rows = await listCompanyMembers(companyId)
  if (rows === null) redirect('/admin')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} member{rows.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <BulkMembersPanel companyId={companyId} />
          <Link
            href="members/new"
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Add member
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Users size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No members yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add members to this company.</p>
          <Link
            href="members/new"
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Add member
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Member</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Role</th>
                <th className="w-16 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.full_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[user.role] ?? ''}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
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
