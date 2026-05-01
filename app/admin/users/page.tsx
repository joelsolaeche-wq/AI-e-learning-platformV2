import { createAdminClient } from '@/lib/supabase/admin'
import { UsersTable } from '@/components/admin/UsersTable'
import Link from 'next/link'

const PAGE_SIZE = 20

type SearchParams = Promise<{
  q?: string
  role?: string
  active?: string
  page?: string
}>

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const roleFilter = params.role ?? ''
  const activeFilter = params.active ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('profiles')
    .select('id, email, full_name, role, is_active, avatar_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
  if (roleFilter && ['learner', 'instructor', 'admin'].includes(roleFilter)) query = query.eq('role', roleFilter)
  if (activeFilter === 'true') query = query.eq('is_active', true)
  else if (activeFilter === 'false') query = query.eq('is_active', false)

  const { data: users, count } = await query
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{count ?? 0} users total</p>
        </div>
        <Link
          href="/admin/users/import"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          Import CSV
        </Link>
      </div>

      <UsersTable
        users={users ?? []}
        q={q}
        roleFilter={roleFilter}
        activeFilter={activeFilter}
        page={page}
        totalPages={totalPages}
      />
    </div>
  )
}
