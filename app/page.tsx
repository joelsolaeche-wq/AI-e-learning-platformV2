// app/page.tsx — public marketing landing
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ArrowRight, Sparkles, Users, Code2, Bot, Play,
  CheckCircle2, BookOpen, Zap, Shield,
} from 'lucide-react'

export default async function HomePage() {
  // If you're already signed in, send you straight to the dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  // Course count (real, public is_published filter)
  const { count: courseCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/65 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="home-logo-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                </defs>
                <path d="M12 2 L22 8 V16 L12 22 L2 16 V8 Z" fill="url(#home-logo-grad)" />
                <path d="M12 6 L17 9 V14 L12 17 L7 14 V9 Z" fill="#0B0B14" opacity="0.55" />
                <circle cx="12" cy="11.5" r="1.6" fill="white" />
              </svg>
            </div>
            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-tight">Synapse</div>
              <div className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">AI Academy</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] text-muted-foreground md:flex">
            <Link href="/catalog" className="transition-colors hover:text-foreground">Catalog</Link>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          </nav>

          <div className="flex items-center gap-2">
            {isAuthed ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-4 py-2 text-[12.5px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
              >
                Go to dashboard <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-4 py-2 text-[12.5px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                >
                  Get started <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-20 h-[400px] w-[400px] rounded-full bg-primary/30 blur-[80px]" />
          <div className="absolute -right-20 top-40 h-[380px] w-[380px] rounded-full bg-accent/25 blur-[80px]" />
          <div className="absolute left-1/3 top-[420px] h-[300px] w-[300px] rounded-full bg-pink-400/20 blur-[80px]" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-28">
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
              <Sparkles size={12} /> AI-native learning for enterprise teams
            </div>

            <h1 className="text-[56px] font-bold leading-[1.02] tracking-[-0.025em] sm:text-[64px]">
              Learn AI by{' '}
              <span className="grad-text">building it.</span>
            </h1>

            <p className="max-w-[560px] text-[16px] leading-relaxed text-muted-foreground">
              Cohort-based courses on Generative AI, Agents, and LLMs.
              Video lessons, hands-on labs, instructor feedback, and an AI tutor in every lesson —
              built for teams shipping AI in production.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {isAuthed ? (
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-6 py-3 text-[14px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                >
                  Go to dashboard
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <Link
                  href="/auth/register"
                  className="group inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-6 py-3 text-[14px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                >
                  Start your first cohort
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.04] px-6 py-3 text-[14px] font-semibold text-foreground transition-all hover:bg-white/[0.08]"
              >
                <Play size={13} fill="currentColor" /> Browse catalog
              </Link>
            </div>

            {/* Stat row */}
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <BookOpen size={13} className="text-primary" />
                <span><span className="font-semibold text-foreground">{courseCount ?? 0}</span> course{courseCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-accent" />
                <span>Live cohorts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bot size={13} className="text-pink-400" />
                <span>AI tutor in every lesson</span>
              </div>
            </div>
          </div>

          {/* Right visual: floating cards composition */}
          <div className="relative hidden h-[500px] lg:block">
            {/* Course card */}
            <div className="absolute right-0 top-0 w-[360px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_48px_rgba(0,0,0,0.4)] animate-[fadeUp_.6s_ease]">
              <div
                className="relative grid aspect-[16/8] place-items-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #22D3EE)' }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.30),transparent_55%)]" />
                <span className="font-mono text-[52px] font-semibold text-white/90 drop-shadow-[0_0_24px_rgba(0,0,0,0.4)]">✦</span>
                <span className="absolute right-2.5 top-2.5 rounded-full border border-emerald-400/40 bg-emerald-400/20 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-300 backdrop-blur-md">
                  Active cohort
                </span>
              </div>
              <div className="flex flex-col gap-2.5 p-4">
                <div className="text-[14.5px] font-bold tracking-tight">Prompt Engineering for Production</div>
                <div className="text-[12px] text-muted-foreground">18 lessons · 4 weeks</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                </div>
              </div>
            </div>

            {/* Floating AI tutor card */}
            <div className="absolute -bottom-4 left-0 w-[300px] rounded-2xl border border-border bg-card/95 p-3.5 shadow-[0_24px_48px_rgba(0,0,0,0.4),0_0_32px_rgba(139,92,246,0.25)] backdrop-blur-xl animate-[fadeUp_.8s_ease]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-bold">Synapse · AI Tutor</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
                    Online · learns from this lesson
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-[12px]">
                <div className="self-end max-w-[80%] rounded-[10px] bg-gradient-to-br from-primary to-primary/80 px-3 py-1.5 text-primary-foreground">
                  Explain RAG retrieval simpler
                </div>
                <div className="self-start max-w-[88%] rounded-[10px] border border-border bg-secondary/60 px-3 py-1.5 text-foreground">
                  Sure! RAG = grab relevant docs first, then…
                </div>
              </div>
            </div>

            {/* XP pill */}
            <div className="absolute right-12 top-[260px] flex items-center gap-2 rounded-full border border-primary/25 bg-card/95 px-3 py-1.5 text-[11.5px] shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl animate-[fadeUp_1s_ease]">
              <Zap size={12} className="text-primary" />
              <span className="font-bold text-primary">Lv 7</span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">+50 XP</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="border-t border-border">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20">
          <div className="mb-12 max-w-[640px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
              <Sparkles size={12} /> What makes Synapse different
            </div>
            <h2 className="mt-4 text-[36px] font-bold tracking-[-0.02em] leading-tight">
              An end-to-end learning experience,{' '}
              <span className="grad-text">built around how AI is actually used.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                Icon: Users,
                title: 'Cohort-based',
                desc: 'Learn together on a shared schedule. Office hours, code reviews, and capstone projects with your team.',
                accent: 'text-cyan-400',
              },
              {
                Icon: Code2,
                title: 'Hands-on labs',
                desc: 'Build real systems — RAG pipelines, agentic workflows, fine-tuned models. Not just slides and theory.',
                accent: 'text-primary',
              },
              {
                Icon: Bot,
                title: 'AI tutor in every lesson',
                desc: 'Ask Synapse anything in the lesson context. Get an explanation, a code example, or a quick quiz instantly.',
                accent: 'text-pink-400',
              },
            ].map(({ Icon, title, desc, accent }) => (
              <div
                key={title}
                className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 ring-1 ring-primary/25 ${accent}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className="text-[16px] font-bold tracking-tight">{title}</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how" className="border-t border-border bg-gradient-to-b from-card/30 to-transparent">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20">
          <div className="mb-12 max-w-[640px]">
            <h2 className="text-[36px] font-bold tracking-[-0.02em] leading-tight">How it works</h2>
            <p className="mt-3 text-[15px] text-muted-foreground">
              From sign-up to shipping your first AI project — typically under 4 weeks.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '01', title: 'Join a cohort', desc: 'Pick a course and join a scheduled cohort.' },
              { step: '02', title: 'Watch + practice', desc: 'Video lessons paired with hands-on coding labs.' },
              { step: '03', title: 'Master with quizzes', desc: 'Knowledge checks unlock as you complete each lesson.' },
              { step: '04', title: 'Ship a capstone', desc: '1:1 instructor review on your final project.' },
            ].map((s) => (
              <div key={s.step} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
                <div className="font-mono text-[28px] font-bold leading-none grad-text">{s.step}</div>
                <div className="mt-2 text-[15px] font-bold">{s.title}</div>
                <div className="text-[12.5px] leading-relaxed text-muted-foreground">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-24">
          <div className="relative overflow-hidden rounded-[24px] border border-border px-8 py-16 text-center bg-[radial-gradient(700px_400px_at_15%_0%,rgba(139,92,246,0.30),transparent_60%),radial-gradient(600px_350px_at_90%_100%,rgba(34,211,238,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-10 h-[300px] w-[300px] rounded-full bg-primary/30 blur-[60px]" />
              <div className="absolute -right-20 bottom-0 h-[260px] w-[260px] rounded-full bg-accent/25 blur-[60px]" />
            </div>
            <div className="relative">
              <h2 className="text-[40px] font-bold leading-[1.05] tracking-[-0.025em]">
                Ready to <span className="grad-text">build with AI?</span>
              </h2>
              <p className="mx-auto mt-3 max-w-[480px] text-[14.5px] text-muted-foreground">
                Join a cohort today and ship your first AI project alongside your team.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {isAuthed ? (
                  <Link
                    href="/dashboard"
                    className="group inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-6 py-3 text-[14px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                  >
                    Open dashboard <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth/register"
                      className="group inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-6 py-3 text-[14px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
                    >
                      Create free account <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.06] px-6 py-3 text-[14px] font-semibold text-foreground transition-all hover:bg-white/[0.11]"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-400" /> No credit card required</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-400" /> Cancel anytime</span>
                <span className="inline-flex items-center gap-1.5"><Shield size={12} className="text-cyan-400" /> Enterprise SSO available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center justify-between gap-3 px-6 py-8 text-[12px] text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="footer-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
              <path d="M12 2 L22 8 V16 L12 22 L2 16 V8 Z" fill="url(#footer-grad)" />
            </svg>
            <span>Synapse · AI Academy</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/catalog" className="hover:text-foreground">Catalog</Link>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
