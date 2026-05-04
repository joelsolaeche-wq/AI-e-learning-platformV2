'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createCompanyAction, updateCompanyAction, type CompanyActionResult } from '@/lib/actions/companies.actions'

type Company = {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  website: string | null
}

const initialState: CompanyActionResult = { error: null }

export function CompanyForm({ company }: { company?: Company }) {
  const isEdit = !!company
  const action = isEdit ? updateCompanyAction : createCompanyAction
  const [state, formAction, isPending] = useActionState(action, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.success && !isEdit && state.id) {
      router.push(`/admin/companies/${state.id}`)
    }
  }, [state.success, state.id, isEdit, router])

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="company_id" value={company.id} />}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="name">Name *</label>
        <input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={company?.name ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="Acme Corp"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={company?.description ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all resize-none"
          placeholder="Brief description of the company"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="logo_url">Logo URL</label>
        <input
          id="logo_url"
          name="logo_url"
          type="url"
          defaultValue={company?.logo_url ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="https://example.com/logo.png"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium" htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="url"
          defaultValue={company?.website ?? ''}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          placeholder="https://acme.com"
        />
      </div>

      {state.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && isEdit && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Saved successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create company'}
      </button>
    </form>
  )
}
