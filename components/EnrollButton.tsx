'use client'

import { useActionState } from 'react'
import { enrollInCohortAction } from '@/lib/actions/enrollment.actions'
import { Button } from '@/components/ui/button'

interface EnrollButtonProps {
  cohortId: string
}

/**
 * Client component that wires enrollInCohortAction through useActionState
 * so error strings returned by the action are surfaced to the user.
 *
 * Must be a client component because useActionState is a React hook.
 */
export function EnrollButton({ cohortId }: EnrollButtonProps) {
  const [state, formAction] = useActionState(enrollInCohortAction, { error: null })

  return (
    <form action={formAction}>
      <input type="hidden" name="cohort_id" value={cohortId} />
      {state.error && (
        <p className="text-xs text-destructive mb-1">{state.error}</p>
      )}
      <Button size="sm" type="submit">
        Join Cohort
      </Button>
    </form>
  )
}
