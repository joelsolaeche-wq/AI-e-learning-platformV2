'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  Eye, EyeOff, Mail, Lock, User, Loader2, AlertCircle,
  ArrowRight, Check, X,
} from 'lucide-react'
import { signUpAction } from '@/lib/actions/auth.actions'
import { AuthShell } from '@/components/auth/AuthShell'

const initialState = { error: null }

// Password strength heuristics — purely client-side feedback. Server still
// enforces the 8-char minimum in lib/actions/auth.actions.ts.
function passwordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  color: string
  hits: { label: string; ok: boolean }[]
} {
  const hits = [
    { label: '8+ characters',         ok: pw.length >= 8 },
    { label: 'A number',              ok: /\d/.test(pw) },
    { label: 'Upper- and lower-case', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: 'A symbol',              ok: /[^A-Za-z0-9]/.test(pw) },
  ]
  const score = hits.filter((h) => h.ok).length as 0 | 1 | 2 | 3 | 4
  const label = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score]
  const color = ['#52525b', '#fb7185', '#f59e0b', '#22d3ee', '#a78bfa'][score]
  return { score, label, color, hits }
}

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const strength = passwordStrength(password)

  return (
    <AuthShell
      headline={<>Start your <span className="grad-text">AI cohort</span>.</>}
      subcopy="One account gets you cohort access, hands-on labs, the AI tutor, and a 1:1 instructor review on your capstone."
    >
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[28px] font-bold tracking-[-0.02em] leading-tight">Create your account</h2>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Already have one?{' '}
            <Link
              href="/auth/login"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3.5 py-3 text-[13px] text-rose-300"
          >
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          {/* Full name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="full_name" className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Full name
            </label>
            <div className="group relative">
              <User
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Jane Smith"
                autoComplete="name"
                disabled={isPending}
                className="w-full rounded-[10px] border border-border bg-card px-10 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Work email
            </label>
            <div className="group relative">
              <Mail
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                disabled={isPending}
                className="w-full rounded-[10px] border border-border bg-card px-10 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Password
            </label>
            <div className="group relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className="w-full rounded-[10px] border border-border bg-card px-10 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Strength meter — only when user has typed something */}
            {password.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-1 flex-1 gap-1 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-full flex-1 rounded-full transition-all duration-300"
                        style={{
                          background:
                            i < strength.score ? strength.color : 'rgba(255,255,255,0.06)',
                          boxShadow:
                            i < strength.score ? `0 0 6px ${strength.color}77` : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[10.5px] font-semibold tabular-nums"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                </div>

                {/* Checklist */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {strength.hits.map((h) => (
                    <div
                      key={h.label}
                      className={`flex items-center gap-1.5 text-[10.5px] ${h.ok ? 'text-emerald-400' : 'text-muted-foreground/60'}`}
                    >
                      {h.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                      <span>{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="group mt-2 inline-flex items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-3 text-[14px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[12px] text-muted-foreground">
          By creating an account you agree to Synapse&apos;s{' '}
          <span className="text-foreground/70">Terms</span> and{' '}
          <span className="text-foreground/70">Privacy Policy</span>.
        </p>
      </div>
    </AuthShell>
  )
}
