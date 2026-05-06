import { createAdminClient } from '@/lib/supabase/admin'
import { AdminUserForm } from '@/components/admin/AdminUserForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const admin = createAdminClient()

  const [userRes, companiesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('profiles')
      .select('id, email, full_name, role, is_active, org_id')
      .eq('id', userId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('organizations')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  if (!userRes.data) notFound()

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Edit user</h1>
          <p className="text-sm text-muted-foreground">{userRes.data.email}</p>
        </div>
      </div>
      <AdminUserForm user={userRes.data} companies={companiesRes.data ?? []} />
    </div>
  )
}
