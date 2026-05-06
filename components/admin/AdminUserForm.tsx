'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { adminUpdateUserAction } from '@/lib/actions/admin.actions'
import { cn } from '@/lib/utils'

type UserData = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  org_id: string | null
}

type Company = { id: string; name: string }

const ROLES = [
  { value: 'learner', label: 'Learner' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'admin', label: 'Admin' },
  { value: 'company_owner', label: 'Company Owner' },
] as const

const initialState = { error: null }

export function AdminUserForm({ user, companies = [] }: { user: UserData; companies?: Company[] }) {
  const [state, formAction, isPending] = useActionState(adminUpdateUserAction, initialState)
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [role, setRole] = useState(user.role)
  const [isActive, setIsActive] = useState(user.is_active)
  const [orgId, setOrgId] = useState(user.org_id ?? '')

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="user_id" value={user.id} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="is_active" value={String(isActive)} />
      <input type="hidden" name="org_id" value={orgId} />

      {state?.error && (
        <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
          User updated successfully.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="adm-email">Email</Label>
        <input
          id="adm-email"
          type="email"
          value={user.email}
          disabled
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm opacity-50 outline-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adm-full-name">Full name</Label>
        <input
          id="adm-full-name"
          name="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={100}
          placeholder="User's name"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRole(value)
                if (value !== 'company_owner') setOrgId('')
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                role === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {role === 'company_owner' && (
        <div className="space-y-2">
          <Label htmlFor="adm-org">Company</Label>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies available.</p>
          ) : (
            <select
              id="adm-org"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Account status</Label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'bg-emerald-500' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                isActive ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {isActive ? 'Account active' : 'Account disabled'}
          </span>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
