import { UsersTable } from '@/components/admin/UsersTable'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listUsers } from '@/lib/queries/admin/users.queries'

type SearchParams = Promise<{
  q?: string
  role?: string
  active?: string
  page?: string
}>

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  // Strip PostgREST metacharacters from the search term before it reaches the
  // `.or()` filter inside listUsers. Comma, parens, and asterisk delimit
  // filter clauses; un-sanitized they let a caller break out of the ilike
  // wildcard and inject extra predicates (e.g. `?q=,role.eq.admin` would
  // become `email.ilike.%,role.eq.admin%` — an OR with a forged predicate).
  const q = (params.q?.trim() ?? '').replace(/[,()*]/g, '')
  const roleFilter = params.role ?? ''
  const activeFilter = params.active ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  // listUsers gates on assertAdmin internally and returns null if the caller
  // isn't an admin. Middleware admits company_owner into /admin/* too, so
  // this redirect catches them.
  const result = await listUsers({ page, q, roleFilter, activeFilter })
  if (!result) redirect('/admin')

  const { users, count, totalPages } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{count} users total</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/users/new"
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + New user
          </Link>
          <Link
            href="/admin/users/import"
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            Import CSV
          </Link>
        </div>
      </div>

      <UsersTable
        users={users}
        q={q}
        roleFilter={roleFilter}
        activeFilter={activeFilter}
        page={page}
        totalPages={totalPages}
      />
    </div>
  )
}
