// components/auth/AuthShell.tsx
// Split-screen auth layout. Left = Synapse brand panel with gradient orbs.
// Right = the form (passed via children). Stacks on mobile.
import Link from 'next/link'
import {
  Sparkles, Users, Code2, BookOpen, ArrowLeft,
} from 'lucide-react'

interface AuthShellProps {
  /** Right-side form column */
  children: React.ReactNode
  /** Marketing headline shown on the brand panel */
  headline?: React.ReactNode
  /** Subcopy under the headline */
  subcopy?: string
}

const FEATURES = [
  { Icon: Users,    label: 'Cohort-based',  desc: 'Learn together on a shared schedule' },
  { Icon: Code2,    label: 'Hands-on labs', desc: 'Build real systems, not just watch' },
  { Icon: Sparkles, label: 'AI tutor',      desc: 'Ask Synapse anything in every lesson' },
]

export function AuthShell({
  children,
  headline = (
    <>
      Learn AI by{' '}
      <span className="grad-text">building it.</span>
    </>
  ),
  subcopy = 'Cohort-based courses on Generative AI, Agents, and LLMs — built for enterprise teams shipping AI in production.',
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">

      {/* ── Left: brand panel ──────────────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border px-12 py-10 lg:flex bg-[radial-gradient(800px_500px_at_15%_10%,rgba(139,92,246,0.30),transparent_60%),radial-gradient(700px_500px_at_90%_100%,rgba(34,211,238,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)]">

        {/* Decorative orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-20 h-[320px] w-[320px] rounded-full bg-primary/40 blur-[60px]" />
          <div className="absolute right-10 top-1/2 h-[280px] w-[280px] -translate-y-1/2 rounded-full bg-accent/30 blur-[60px]" />
          <div className="absolute -bottom-10 left-1/3 h-[240px] w-[240px] rounded-full bg-pink-400/25 blur-[60px]" />
        </div>

        {/* Top: logo + name */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="drop-shadow-[0_0_16px_rgba(139,92,246,0.55)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="auth-logo-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
              <path d="M12 2 L22 8 V16 L12 22 L2 16 V8 Z" fill="url(#auth-logo-grad)" />
              <path d="M12 6 L17 9 V14 L12 17 L7 14 V9 Z" fill="#0B0B14" opacity="0.55" />
              <circle cx="12" cy="11.5" r="1.6" fill="white" />
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-bold tracking-tight">Synapse</div>
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">AI Academy</div>
          </div>
        </div>

        {/* Middle: headline + subcopy */}
        <div className="relative z-10 max-w-[460px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">
            <Sparkles size={11} /> AI-native learning
          </div>
          <h1 className="mt-4 text-[44px] font-bold leading-[1.05] tracking-[-0.025em]">
            {headline}
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted-foreground">
            {subcopy}
          </p>
        </div>

        {/* Bottom: feature chips */}
        <div className="relative z-10 flex flex-col gap-3">
          {FEATURES.map(({ Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 backdrop-blur-md"
            >
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-primary/20 to-accent/15 ring-1 ring-primary/30">
                <Icon size={15} className="text-primary" />
              </div>
              <div>
                <div className="text-[13px] font-semibold">{label}</div>
                <div className="text-[11.5px] text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right: form panel ──────────────────────────────────────── */}
      <main className="relative flex items-center justify-center px-6 py-10 sm:px-10 bg-background">
        {/* Mobile-only logo at top */}
        <div className="absolute left-6 top-6 flex items-center gap-2.5 lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="auth-mobile-logo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
            <path d="M12 2 L22 8 V16 L12 22 L2 16 V8 Z" fill="url(#auth-mobile-logo)" />
            <circle cx="12" cy="11.5" r="1.6" fill="white" />
          </svg>
          <span className="text-[14px] font-bold tracking-tight">Synapse</span>
        </div>

        {/* Back-to-home link, top-right */}
        <Link
          href="/"
          className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft size={12} /> Home
        </Link>

        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </main>
    </div>
  )
}

// Tiny re-usable icon block for the brand panel of confirm-email page
export const AuthFeatureIcon = BookOpen
