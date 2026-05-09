'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Upload, X, UserMinus } from 'lucide-react'
import { enrollUserAction, bulkEnrollAction, unenrollUserAction } from '@/lib/actions/cohorts.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  const [userResults, setUserResults] = useState<{ id: string; email: string; full_name: string | null }[]>([])
  const [bulkEmails, setBulkEmails] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<{ enrolled: number; skipped: number; errors: string[] } | null>(null)
  const router = useRouter()

  async function searchUsers(query: string) {
    if (query.length < 2) { setUserResults([]); return }
    const res = await fetch(`/api/admin/user-by-email?email=${encodeURIComponent(query)}`)
    const json = await res.json()
    if (json.results) setUserResults(json.results)
    else if (json.id) setUserResults([{ id: json.id, email: manualEmail, full_name: null }])
    else setUserResults([])
  }

  async function handleManualEnroll(userId: string) {
    setManualError(null)
    const userName = userResults.find(u => u.id === userId)?.full_name
      ?? userResults.find(u => u.id === userId)?.email
      ?? 'User'
    startTransition(async () => {
      const result = await enrollUserAction(cohortId, userId)
      if (result.error) { setManualError(result.error); return }
      setManualEmail('')
      setUserResults([])
      setShowManual(false)
      toast.success(`${userName} enrolled successfully`)
      router.refresh()
    })
  }

  async function handleUnenroll(enrollmentId: string, name: string) {
    if (!confirm(`Remove ${name} from this cohort?`)) return
    startTransition(async () => {
      const result = await unenrollUserAction(enrollmentId, cohortId)
      if (result.error) { toast.error(result.error); return }
      toast.success(`${name} removed from cohort`)
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
              onChange={e => { setManualEmail(e.target.value); searchUsers(e.target.value) }}
              placeholder="Search by name or email…"
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/60 transition-all"
              autoFocus
            />
            <button onClick={() => { setShowManual(false); setManualEmail(''); setUserResults([]) }} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {userResults.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary overflow-hidden">
              {userResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleManualEnroll(u.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-white/[0.05] disabled:opacity-50 transition-colors border-b border-border last:border-0"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {(u.full_name || u.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{u.full_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <span className="ml-auto text-xs text-primary">+ Enroll</span>
                </button>
              ))}
            </div>
          )}
          {manualEmail.length >= 2 && userResults.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">No users found for &quot;{manualEmail}&quot;</p>
          )}
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
                <th className="px-4 py-2.5" />
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleUnenroll(e.id, e.profiles?.full_name ?? e.profiles?.email ?? 'User')}
                      disabled={isPending}
                      title="Remove from cohort"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors"
                    >
                      <UserMinus size={12} /> Remove
                    </button>
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
