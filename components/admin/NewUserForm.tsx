'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createUserAction, type AdminActionResult } from '@/lib/actions/admin.actions'
import { cn } from '@/lib/utils'

const initialState: AdminActionResult = { error: null }

const ROLES = [
  { value: 'learner', label: 'Learner' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'admin', label: 'Admin' },
  { value: 'company_owner', label: 'Company Owner' },
]

type Company = { id: string; name: string }

interface Props {
  companies?: Company[]
  redirectTo?: string
  defaultOrgId?: string
}

export function NewUserForm({ companies = [], redirectTo, defaultOrgId }: Props) {
  const [state, formAction, isPending] = useActionState(createUserAction, initialState)
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState('learner')

  useEffect(() => {
    if (state.success) router.push(redirectTo ?? '/admin/users')
  }, [state.success, router, redirectTo])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role" value={selectedRole} />
      {defaultOrgId && <input type="hidden" name="org_id" value={defaultOrgId} />}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="full_name">Full name</label>
        <input
          id="full_name" name="full_name" maxLength={100}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="Jane Doe"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="email">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="jane@acme.com"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="password">Password *</label>
        <input
          id="password" name="password" type="password" required minLength={8}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="Min 8 characters"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium">Role</label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedRole(value)}
              className={cn(
                'rounded-xl border px-3 py-2 text-[13px] font-medium transition-all',
                selectedRole === value
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {selectedRole === 'company_owner' && !defaultOrgId && (
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium" htmlFor="org_id">Company *</label>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies available. Create one first.</p>
          ) : (
            <select
              id="org_id" name="org_id" required
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            >
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      {state.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit" disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Creating…' : 'Create user'}
      </button>
    </form>
  )
}
