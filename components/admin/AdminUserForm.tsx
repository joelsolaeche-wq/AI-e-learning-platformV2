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
}

const ROLES = ['learner', 'instructor', 'admin'] as const
const ROLE_LABELS: Record<string, string> = { learner: 'Learner', instructor: 'Instructor', admin: 'Admin' }

const initialState = { error: null }

export function AdminUserForm({ user }: { user: UserData }) {
  const [state, formAction, isPending] = useActionState(adminUpdateUserAction, initialState)
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [role, setRole] = useState(user.role)
  const [isActive, setIsActive] = useState(user.is_active)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="user_id" value={user.id} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="is_active" value={String(isActive)} />

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
        <Label>Rol</Label>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                role === r
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

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
