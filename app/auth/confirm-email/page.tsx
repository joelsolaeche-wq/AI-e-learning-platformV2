import Link from 'next/link'
import { Mail, ArrowLeft, Sparkles } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ConfirmEmailPage() {
  return (
    <AuthShell
      headline={<>Almost there. <span className="grad-text">Check your inbox.</span></>}
      subcopy="We sent a confirmation link to your email. Click it to activate your account and unlock the cohort."
    >
      <div className="flex flex-col gap-6 text-center">
        {/* Big mail icon with violet glow */}
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_28px_rgba(139,92,246,0.5)]">
          <Mail size={28} className="text-white" />
        </div>

        <div>
          <h2 className="text-[26px] font-bold tracking-[-0.02em] leading-tight">Check your email</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            We just sent a confirmation link to your inbox. Click it to verify your account and head to your dashboard.
          </p>
        </div>

        {/* What's next */}
        <div className="rounded-2xl border border-border bg-card p-4 text-left">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Sparkles size={11} className="text-primary" /> What&apos;s next
          </div>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              Open the email from <span className="text-foreground/80">Synapse</span> and click the link.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
              We&apos;ll redirect you to the dashboard automatically.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-pink-400" />
              Browse the catalog and join your team&apos;s cohort.
            </li>
          </ul>
        </div>

        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft size={13} /> Back to sign in
        </Link>

        <p className="text-[11.5px] text-muted-foreground/70">
          Didn&apos;t get it? Check spam, or try registering again with the same email.
        </p>
      </div>
    </AuthShell>
  )
}
