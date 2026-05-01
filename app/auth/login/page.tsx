'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { signInAction } from '@/lib/actions/auth.actions'
import { AuthShell } from '@/components/auth/AuthShell'

const initialState = { error: null }

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <AuthShell
      headline={<>Welcome back to <span className="grad-text">Synapse</span>.</>}
      subcopy="Pick up your cohort right where you left off — your videos, quizzes, and AI tutor are waiting."
    >
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h2 className="text-[28px] font-bold tracking-[-0.02em] leading-tight">Sign in</h2>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            New here?{' '}
            <Link
              href="/auth/register"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>

        {/* Error */}
        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3.5 py-3 text-[13px] text-rose-300"
          >
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Form */}
        <form action={formAction} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Email
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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-[11.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="group relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
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
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-[12px] text-muted-foreground">
          By continuing you agree to Synapse&apos;s{' '}
          <span className="text-foreground/70">Terms</span> and{' '}
          <span className="text-foreground/70">Privacy Policy</span>.
        </p>
      </div>
    </AuthShell>
  )
}
