'use client'

import { useActionState } from 'react'
import { enrollInCohortAction } from '@/lib/actions/enrollment.actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface EnrollButtonProps {
  cohortId: string
}

/**
 * Client component that wires enrollInCohortAction through useActionState.
 * On success (state.enrolled === true), renders an "Enrolled" badge in-place
 * instead of navigating away — satisfying ROADMAP SC-1.
 * Error strings returned by the action are surfaced below the form.
 */
export function EnrollButton({ cohortId }: EnrollButtonProps) {
  const [state, formAction] = useActionState(enrollInCohortAction, {
    error: null,
    enrolled: false,
  })

  if (state.enrolled) {
    return (
      <Badge variant="secondary" className="cursor-default">
        Enrolled
      </Badge>
    )
  }

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
