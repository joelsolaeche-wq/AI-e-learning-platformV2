import { createAdminClient } from '@/lib/supabase/admin'
import { CohortForm } from '@/components/admin/CohortForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewCompanyCohortPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const admin = createAdminClient()

  const [coursesRes, companyRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('courses').select('id, title').eq('is_published', true).order('title'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('organizations').select('id, name').eq('id', companyId).single(),
  ])

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="../cohorts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Cohorts
        </Link>
        <h2 className="mt-3 text-xl font-bold">New cohort</h2>
      </div>
      <CohortForm
        courses={coursesRes.data ?? []}
        companies={companyRes.data ? [companyRes.data] : []}
        defaultCompanyId={companyId}
        lockCompany
        redirectTo={`/admin/companies/${companyId}/cohorts`}
      />
    </div>
  )
}
