import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CompanyWorkspaceTabs } from '@/components/admin/CompanyWorkspaceTabs'

export default async function CompanyWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  // company_owner can only access their own company's workspace
  if (profile?.role === 'company_owner' && profile?.org_id !== companyId) {
    notFound()
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('organizations')
    .select('id, name')
    .eq('id', companyId)
    .single()

  if (!company) notFound()

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
