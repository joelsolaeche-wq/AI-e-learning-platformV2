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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (admin as any)
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', userId)
    .single()

  if (!user) notFound()

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
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <AdminUserForm user={user} />
    </div>
  )
}
