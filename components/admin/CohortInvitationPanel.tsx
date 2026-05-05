'use client'

import { useState, useTransition } from 'react'
import { generateInvitationCodeAction } from '@/lib/actions/cohorts.actions'
import { Copy, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Invitation = {
  id: string
  code: string
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  created_at: string
}

export function CohortInvitationPanel({ cohortId, invitations }: { cohortId: string; invitations: Invitation[] }) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [maxUses, setMaxUses] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('')
  const [newCode, setNewCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const router = useRouter()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const res = await generateInvitationCodeAction(
        cohortId,
        maxUses ? parseInt(maxUses, 10) : undefined,
        expiresInDays ? parseInt(expiresInDays, 10) : undefined,
      )
      if (res.error) { setError(res.error); return }
      setNewCode(res.code!)
      setShowForm(false)
      setMaxUses('')
      setExpiresInDays('')
      router.refresh()
    })
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const allInvitations = newCode
    ? [{ id: 'new', code: newCode, max_uses: null, uses_count: 0, expires_at: null, created_at: new Date().toISOString() }, ...invitations]
    : invitations

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowForm(f => !f)}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
      >
        <Plus size={13} /> Generate code
      </button>

      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">Max uses (blank = unlimited)</label>
              <input
                type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 transition-all"
                placeholder="e.g. 25"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">Expires in days (blank = never)</label>
              <input
                type="number" min="1" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 transition-all"
                placeholder="e.g. 7"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      )}

      {allInvitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invitation codes yet.</p>
      ) : (
        <div className="space-y-2">
          {allInvitations.map(inv => {
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date()
            const exhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses
            const isActive = !expired && !exhausted
            return (
              <div
                key={inv.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className={`font-mono text-lg font-bold tracking-widest ${isActive ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {inv.code}
                </span>
                <button
                  onClick={() => handleCopy(inv.code)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy size={13} />
                </button>
                {copied === inv.code && <span className="text-xs text-emerald-400">Copied!</span>}
                <div className="ml-auto text-xs text-muted-foreground">
                  {inv.uses_count}{inv.max_uses !== null ? `/${inv.max_uses}` : ''} uses
                  {inv.expires_at && ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                </div>
                {!isActive && (
                  <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] text-slate-400">
                    {expired ? 'expired' : 'exhausted'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
