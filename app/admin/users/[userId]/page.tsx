import { AdminUserForm } from '@/components/admin/AdminUserForm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUserById } from '@/lib/queries/admin/users.queries'

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ preset_role?: string }>
}) {
  const [{ userId }, { preset_role }] = await Promise.all([params, searchParams])

  const result = await getUserById(userId)
  if (result === null) redirect('/admin')
  const { user, companies } = result
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
      <AdminUserForm user={user} companies={companies} presetRole={preset_role} />
    </div>
  )
}
