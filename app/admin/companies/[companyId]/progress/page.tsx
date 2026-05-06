import { createAdminClient } from '@/lib/supabase/admin'
import { BarChart3 } from 'lucide-react'

type ProgressRow = {
  cohort_id: string
  user_id: string
  course_id: string
  total_lessons: number
  completed_lessons: number
  pct: number
}

type CohortMeta = { id: string; title: string }
type UserMeta = { id: string; full_name: string | null; email: string }
type CourseMeta = { id: string; title: string }

export default async function CompanyProgressPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const admin = createAdminClient()

  // Get cohorts for this company
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cohorts } = await (admin as any)
    .from('cohorts')
    .select('id, title')
    .eq('company_id', companyId)
    .order('starts_at', { ascending: false })

  const cohortList = (cohorts ?? []) as CohortMeta[]
  const cohortIds = cohortList.map((c) => c.id)

  if (cohortIds.length === 0) {
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

  // Read progress from the view (service-role bypasses RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: progress } = await (admin as any)
    .from('v_cohort_progress')
    .select('cohort_id, user_id, course_id, total_lessons, completed_lessons, pct')
    .in('cohort_id', cohortIds)

  const progressRows = (progress ?? []) as ProgressRow[]

  // Collect user ids and course ids from the result to fetch metadata
  const userIds = [...new Set(progressRows.map((r) => r.user_id))]
  const courseIds = [...new Set(progressRows.map((r) => r.course_id))]

  const [usersRes, coursesRes] = await Promise.all([
    userIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin as any).from('profiles').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin as any).from('courses').select('id, title').in('id', courseIds)
      : Promise.resolve({ data: [] }),
  ])

  const userMap = new Map<string, UserMeta>(
    (usersRes.data ?? []).map((u: UserMeta) => [u.id, u]),
  )
  const courseMap = new Map<string, CourseMeta>(
    (coursesRes.data ?? []).map((c: CourseMeta) => [c.id, c]),
  )

  // Group progress by cohort
  const byCohort = new Map<string, ProgressRow[]>()
  for (const row of progressRows) {
    if (!byCohort.has(row.cohort_id)) byCohort.set(row.cohort_id, [])
    byCohort.get(row.cohort_id)!.push(row)
  }

  return (
    <div className="space-y-8">
      {cohortList.map((cohort) => {
        const rows = byCohort.get(cohort.id) ?? []
        const userGroups = new Map<string, ProgressRow[]>()
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
