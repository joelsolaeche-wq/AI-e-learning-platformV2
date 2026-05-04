'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Upload, X } from 'lucide-react'
import { enrollUserAction, bulkEnrollAction } from '@/lib/actions/cohorts.actions'
import { useRouter } from 'next/navigation'

type Enrollment = {
  id: string
  status: string
  enrolled_at: string
  profiles: { id: string; email: string; full_name: string | null; role: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  dropped: 'bg-rose-500/15 text-rose-400',
  completed: 'bg-slate-500/15 text-slate-400',
}

export function CohortEnrollmentPanel({ cohortId, enrollments }: { cohortId: string; enrollments: Enrollment[] }) {
  const [isPending, startTransition] = useTransition()
  const [showManual, setShowManual] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [bulkEmails, setBulkEmails] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<{ enrolled: number; skipped: number; errors: string[] } | null>(null)
  const router = useRouter()

  async function handleManualEnroll() {
    if (!manualEmail.trim()) return
    setManualError(null)
    startTransition(async () => {
      // Need to find user by email first — we do that in the action
      // For manual enroll we need the userId; fetch it client-side via a dedicated path
      const res = await fetch(`/api/admin/user-by-email?email=${encodeURIComponent(manualEmail.trim())}`)
      const json = await res.json()
      if (!json.id) { setManualError('User not found.'); return }
      const result = await enrollUserAction(cohortId, json.id)
      if (result.error) { setManualError(result.error); return }
      setManualEmail('')
      setShowManual(false)
      router.refresh()
    })
  }

  async function handleBulkEnroll() {
    const emails = bulkEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
    if (!emails.length) return
    startTransition(async () => {
      const result = await bulkEnrollAction(cohortId, emails)
      setBulkResult(result)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => { setShowManual(m => !m); setShowBulk(false) }}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <UserPlus size={13} /> Add user
        </button>
        <button
          onClick={() => { setShowBulk(b => !b); setShowManual(false) }}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <Upload size={13} /> Bulk enroll
        </button>
      </div>

      {showManual && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={manualEmail}
              onChange={e => setManualEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualEnroll()}
              placeholder="user@company.com"
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 transition-all"
            />
            <button
              onClick={handleManualEnroll}
              disabled={isPending || !manualEmail.trim()}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Enroll
            </button>
            <button onClick={() => setShowManual(false)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {manualError && <p className="text-sm text-destructive">{manualError}</p>}
        </div>
      )}

      {showBulk && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground">One email per line or comma-separated. Users must already exist in the platform.</p>
          <textarea
            value={bulkEmails}
            onChange={e => setBulkEmails(e.target.value)}
            rows={5}
            placeholder="alice@acme.com&#10;bob@acme.com&#10;carol@acme.com"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 transition-all resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkEnroll}
              disabled={isPending || !bulkEmails.trim()}
              className="h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Enrolling…' : 'Enroll all'}
            </button>
            <button onClick={() => { setShowBulk(false); setBulkResult(null) }} className="text-muted-foreground hover:text-foreground text-sm">
              Cancel
            </button>
          </div>
          {bulkResult && (
            <div className="rounded-lg border border-border bg-secondary p-3 text-sm space-y-1">
              <p className="text-emerald-400">✓ {bulkResult.enrolled} enrolled</p>
              {bulkResult.skipped > 0 && <p className="text-muted-foreground">↻ {bulkResult.skipped} already enrolled</p>}
              {bulkResult.errors.map((e, i) => <p key={i} className="text-rose-400">✗ {e}</p>)}
            </div>
          )}
        </div>
      )}

      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No enrollments yet.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">User</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.map(e => (
                <tr key={e.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.profiles?.full_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{e.profiles?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[e.status] ?? ''}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(e.enrolled_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
