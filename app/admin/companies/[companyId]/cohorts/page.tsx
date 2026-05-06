import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Plus, UsersRound } from 'lucide-react'

type CohortRow = {
  id: string
  title: string
  status: string
  starts_at: string
  ends_at: string | null
  max_seats: number
  modality: string | null
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  completed: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

export default async function CompanyCohortListPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cohorts } = await (admin as any)
    .from('cohorts')
    .select('id, title, status, starts_at, ends_at, max_seats, modality')
    .eq('company_id', companyId)
    .order('starts_at', { ascending: false })

  const rows = (cohorts ?? []) as CohortRow[]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} cohort{rows.length !== 1 ? 's' : ''}</p>
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
          <p className="mt-1 text-sm text-muted-foreground">Create a cohort to schedule a course run for this company.</p>
          <Link
            href="cohorts/new"
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> New cohort
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Title</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Starts</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Seats</th>
                <th className="w-16 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((cohort) => (
                <tr key={cohort.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium">{cohort.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[cohort.status] ?? ''}`}>
                      {cohort.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {new Date(cohort.starts_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cohort.max_seats === 0 ? '∞' : cohort.max_seats}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`cohorts/${cohort.id}`}
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
