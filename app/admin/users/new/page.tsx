import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { NewUserForm } from '@/components/admin/NewUserForm'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function NewUserPage() {
  // Admin-only: middleware lets company_owner reach /admin/* too, but this
  // global new-user form exposes every role. Company owners create members
  // via /admin/companies/[companyId]/members/new (locked to role=learner).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (supabase as any)
    .from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') redirect('/admin')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (admin as any)
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

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
      <NewUserForm companies={companies ?? []} />
    </div>
  )
}
