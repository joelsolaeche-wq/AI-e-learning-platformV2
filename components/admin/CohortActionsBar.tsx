'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Copy } from 'lucide-react'
import { archiveCohortAction, cloneCohortAction } from '@/lib/actions/cohorts.actions'

export function CohortActionsBar({ cohortId, status }: { cohortId: string; status: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClone() {
    startTransition(async () => {
      const res = await cloneCohortAction(cohortId)
      if (res.id) router.push(`/admin/cohorts/${res.id}`)
    })
  }

  function handleArchive() {
    if (!confirm('Archive this cohort? It will be marked as completed.')) return
    startTransition(async () => {
      await archiveCohortAction(cohortId)
      router.refresh()
    })
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleClone}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-50 transition-colors"
      >
        <Copy size={13} /> Clone
      </button>
      {status !== 'completed' && (
        <button
          onClick={handleArchive}
          disabled={isPending}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <Archive size={13} /> Archive
        </button>
      )}
    </div>
  )
}
