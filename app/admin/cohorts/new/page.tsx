import { redirect } from 'next/navigation'
import { CohortForm } from '@/components/admin/CohortForm'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { listCohortFormOptions } from '@/lib/queries/admin/cohorts.queries'

export default async function NewCohortPage() {
  const options = await listCohortFormOptions()
  if (options === null) redirect('/admin')

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/cohorts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Cohorts
        </Link>
        <h1 className="mt-3 text-2xl font-bold">New cohort</h1>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            1
          </span>
          <span className="text-sm font-medium">Cohort details</span>
        </div>
        <ChevronRight size={14} className="text-muted-foreground" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium">
            2
          </span>
          <span className="text-sm">Add members</span>
        </div>
      </div>

      <CohortForm courses={options.courses} companies={options.companies} />
    </div>
  )
}
