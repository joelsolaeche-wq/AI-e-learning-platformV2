import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CompanyWorkspaceTabs } from '@/components/admin/CompanyWorkspaceTabs'
import { getCompanyForWorkspace } from '@/lib/queries/admin/companies.queries'

export default async function CompanyWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const result = await getCompanyForWorkspace(companyId)
  if (result === null) redirect('/auth/login')
  if (result === 'notfound') notFound()
  const company = result

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/companies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Companies
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{company.name}</h1>
      </div>

      <CompanyWorkspaceTabs companyId={companyId} />

      <div>{children}</div>
    </div>
  )
}
