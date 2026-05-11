'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, use } from 'react'
import { createUserAction, type AdminActionResult } from '@/lib/actions/admin.actions'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const initialState: AdminActionResult = { error: null }

export default function NewCompanyMemberPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = use(params)
  const [state, formAction, isPending] = useActionState(createUserAction, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push(`/admin/companies/${companyId}/members`)
  }, [state.success, router, companyId])

  return (
    <div className="max-w-md space-y-6">
      <div>
        <Link
          href="../members"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Members
        </Link>
        <h2 className="mt-3 text-xl font-bold">Add member</h2>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="org_id" value={companyId} />
        <input type="hidden" name="role" value="learner" />

        <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[13px] text-muted-foreground">
          New members are added as <span className="font-medium text-foreground">learners</span>. Enroll them in a cohort to grant course access.
        </p>

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
            placeholder="jane@company.com"
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

        {state.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <button
          type="submit" disabled={isPending}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Creating…' : 'Create member'}
        </button>
      </form>
    </div>
  )
}
