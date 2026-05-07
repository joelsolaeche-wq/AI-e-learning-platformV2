'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { joinByCodeFormAction } from '@/lib/actions/cohorts.actions'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'

type State = { error: string | null; success?: boolean; cohortTitle?: string }
const initialState: State = { error: null }

export function JoinByCodeForm() {
  const [state, formAction, isPending] = useActionState(joinByCodeFormAction, initialState)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      toast.success(state.cohortTitle ? `Joined "${state.cohortTitle}"` : 'You joined a new cohort!')
      router.refresh()
      setOpen(false)
    }
  }, [state.success, state.cohortTitle, router])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
      >
        <KeyRound size={14} />
        Have an invitation code?
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-2.5"
    >
      <KeyRound size={14} className="shrink-0 text-muted-foreground" />
      <input
        name="code"
        required
        maxLength={20}
        autoFocus
        placeholder="Enter code (e.g. A1B2)"
        className="flex-1 bg-transparent text-sm uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground"
        style={{ letterSpacing: '0.15em' }}
      />
      {state.error && (
        <span className="shrink-0 text-xs text-destructive">{state.error}</span>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Joining…' : 'Join'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </form>
  )
}
