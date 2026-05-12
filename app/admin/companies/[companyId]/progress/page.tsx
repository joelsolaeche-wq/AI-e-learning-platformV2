import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { getCompanyProgressView } from '@/lib/queries/admin/companies.queries'

export default async function CompanyProgressPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const view = await getCompanyProgressView(companyId)
  if (view === null) redirect('/admin')
  const { cohorts: cohortList, progressRows, userMap, courseMap } = view

  if (cohortList.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <BarChart3 size={32} className="mx-auto mb-3 text-muted-foreground/40" />
        <p className="font-medium">No cohorts yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create cohorts and enroll learners to see progress here.
        </p>
      </div>
    )
  }

  // Group progress by cohort
  const byCohort = new Map<string, typeof progressRows>()
  for (const row of progressRows) {
    if (!byCohort.has(row.cohort_id)) byCohort.set(row.cohort_id, [])
    byCohort.get(row.cohort_id)!.push(row)
  }

  return (
    <div className="space-y-8">
      {cohortList.map((cohort) => {
        const rows = byCohort.get(cohort.id) ?? []
        const userGroups = new Map<string, typeof progressRows>()
        for (const r of rows) {
          if (!userGroups.has(r.user_id)) userGroups.set(r.user_id, [])
          userGroups.get(r.user_id)!.push(r)
        }
        const coursesInCohort = [...new Set(rows.map((r) => r.course_id))]

        return (
          <section key={cohort.id} className="space-y-3">
            <h3 className="text-sm font-semibold">{cohort.title}</h3>

            {userGroups.size === 0 ? (
              <p className="text-sm text-muted-foreground">No enrolled learners yet.</p>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-white/[0.02]">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Learner</th>
                      {coursesInCohort.map((cId) => (
                        <th key={cId} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                          {courseMap.get(cId)?.title ?? cId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Array.from(userGroups.entries()).map(([userId, userRows]) => {
                      const user = userMap.get(userId)
                      return (
                        <tr key={userId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium">{user?.full_name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">{user?.email ?? userId}</div>
                          </td>
                          {coursesInCohort.map((cId) => {
                            const prog = userRows.find((r) => r.course_id === cId)
                            if (!prog) return (
                              <td key={cId} className="px-4 py-3 text-muted-foreground text-xs">—</td>
                            )
                            return (
                              <td key={cId} className="px-4 py-3 min-w-[140px]">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all"
                                      style={{ width: `${prog.pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                    {prog.completed_lessons}/{prog.total_lessons} ({prog.pct}%)
                                  </span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
