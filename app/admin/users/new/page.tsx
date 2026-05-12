import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { NewUserForm } from '@/components/admin/NewUserForm'
import { listCompaniesForForm } from '@/lib/queries/admin/users.queries'

export default async function NewUserPage() {
  // Admin-only. Middleware lets company_owner reach /admin/* too, but this
  // global new-user form exposes every role; company_owner has a scoped
  // alternative at /admin/companies/[companyId]/members/new (locked to learner).
  const companies = await listCompaniesForForm()
  if (companies === null) redirect('/admin')

  return (
    <div className="max-w-md space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Users
        </Link>
        <h1 className="mt-3 text-2xl font-bold">New user</h1>
      </div>
      <NewUserForm companies={companies} />
    </div>
  )
}
