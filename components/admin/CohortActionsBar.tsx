'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Copy, Trash2 } from 'lucide-react'
import { archiveCohortAction, cloneCohortAction, deleteCohortAction } from '@/lib/actions/cohorts.actions'

export function CohortActionsBar({
  cohortId,
  status,
  backPath = '/admin/cohorts',
}: {
  cohortId: string
  status: string
  backPath?: string
}) {
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

  function handleDelete() {
    if (!confirm('Delete this cohort permanently? This cannot be undone.')) return
    startTransition(async () => {
      const res = await deleteCohortAction(cohortId)
      if (res.error) { alert(res.error); return }
      router.push(backPath)
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
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
      >
        <Trash2 size={13} /> Delete
      </button>
    </div>
  )
}
