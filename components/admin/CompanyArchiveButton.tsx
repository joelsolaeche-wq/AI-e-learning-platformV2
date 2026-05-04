'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore } from 'lucide-react'
import { archiveCompanyAction, restoreCompanyAction } from '@/lib/actions/companies.actions'

export function CompanyArchiveButton({ companyId, isArchived }: { companyId: string; isArchived: boolean }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    const msg = isArchived
      ? 'Restore this company? It will be visible again.'
      : 'Archive this company? It will be hidden from the catalog and users.'
    if (!confirm(msg)) return
    startTransition(async () => {
      if (isArchived) {
        await restoreCompanyAction(companyId)
      } else {
        await archiveCompanyAction(companyId)
      }
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50 transition-colors ${
        isArchived
          ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
          : 'border-border text-muted-foreground hover:border-rose-500/30 hover:text-rose-400'
      }`}
    >
      {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
      {isPending ? '…' : isArchived ? 'Restore' : 'Archive'}
    </button>
  )
}
