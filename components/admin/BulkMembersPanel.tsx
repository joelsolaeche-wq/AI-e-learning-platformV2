'use client'

import { useState, useTransition } from 'react'
import { Upload } from 'lucide-react'
import { bulkAssignMembersAction } from '@/lib/actions/admin.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function BulkMembersPanel({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [emails, setEmails] = useState('')
  const [result, setResult] = useState<{ assigned: number; skipped: number; errors: string[] } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    const list = emails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
    if (!list.length) return
    startTransition(async () => {
      const res = await bulkAssignMembersAction(companyId, list)
      setResult(res)
      if (res.assigned > 0) {
        toast.success(`${res.assigned} member${res.assigned !== 1 ? 's' : ''} added`)
        router.refresh()
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setEmails('')
    setResult(null)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
      >
        <Upload size={13} /> Bulk add
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        One email per line or comma-separated. Users must already have an account on the platform.
      </p>
      <textarea
        value={emails}
        onChange={e => setEmails(e.target.value)}
        rows={5}
        placeholder={'alice@acme.com\nbob@acme.com\ncarol@acme.com'}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 transition-all resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || !emails.trim()}
          className="h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add all'}
        </button>
        <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
      {result && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm space-y-1">
          {result.assigned > 0 && <p className="text-emerald-400">✓ {result.assigned} added to company</p>}
          {result.skipped > 0 && <p className="text-muted-foreground">↻ {result.skipped} already in company</p>}
          {result.errors.map((e, i) => <p key={i} className="text-rose-400">✗ {e}</p>)}
        </div>
      )}
    </div>
  )
}
