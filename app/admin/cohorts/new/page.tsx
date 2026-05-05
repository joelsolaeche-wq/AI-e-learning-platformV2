import { createAdminClient } from '@/lib/supabase/admin'
import { CohortForm } from '@/components/admin/CohortForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewCohortPage() {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [coursesRes, companiesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title').eq('is_published', true).order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('id, name').order('name'),
  ])

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
      <CohortForm courses={coursesRes.data ?? []} companies={companiesRes.data ?? []} />
    </div>
  )
}
