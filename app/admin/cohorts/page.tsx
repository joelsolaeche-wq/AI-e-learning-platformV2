import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, UsersRound } from 'lucide-react'
import { listAllCohortsForAdmin } from '@/lib/queries/admin/cohorts.queries'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  completed: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
}

export default async function AdminCohortsPage() {
  const rows = await listAllCohortsForAdmin()
  if (rows === null) redirect('/admin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cohorts</h1>
          <p className="text-sm text-muted-foreground">{rows.length} cohorts total</p>
        </div>
        <Link
          href="/admin/cohorts/new"
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          New cohort
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <UsersRound size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No cohorts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a cohort to start enrolling learners.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Cohort</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Course</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Dates</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((cohort) => (
                <tr key={cohort.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{cohort.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{cohort.modality ?? 'virtual'} · {cohort.max_seats > 0 ? `${cohort.max_seats} seats` : 'unlimited'}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{cohort.courses?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{cohort.organizations?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(cohort.starts_at).toLocaleDateString()}
                    {cohort.ends_at && ` → ${new Date(cohort.ends_at).toLocaleDateString()}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[cohort.status] ?? ''}`}>
                      {cohort.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/cohorts/${cohort.id}`}
                      className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    >
                      Manage
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
