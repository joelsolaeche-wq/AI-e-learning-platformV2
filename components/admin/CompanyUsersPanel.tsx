'use client'

import Link from 'next/link'

type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  avatar_url: string | null
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  instructor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  learner: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

export function CompanyUsersPanel({ users, companyId: _ }: { users: UserRow[]; companyId: string }) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No users assigned to this company yet. Assign users from the{' '}
        <Link href="/admin/users" className="text-primary hover:underline">Users panel</Link>.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-white/[0.02]">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">User</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Role</th>
            <th className="w-16 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium">{user.full_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[user.role] ?? ''}`}>
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
