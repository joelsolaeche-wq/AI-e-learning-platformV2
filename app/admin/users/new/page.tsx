import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewUserForm } from '@/components/admin/NewUserForm'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function NewUserPage() {
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
