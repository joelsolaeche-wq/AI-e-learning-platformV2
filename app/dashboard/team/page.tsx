// app/dashboard/team/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Users, MessageSquare, Zap, ChevronRight,
  Briefcase, Activity, Clock, Building2, Sparkles, Flame, Trophy,
} from 'lucide-react'
import Link from 'next/link'

type Member = {
  id: string
  name: string
  role: string
  initials: string
  color: string
  course: string
  pct: number
  streak: number
  isYou?: boolean
  lastSeen: string
  status: 'online' | 'away' | 'offline'
}

// Mock cohort peers — RLS typically restricts cross-user reads on profiles +
// lesson_progress. Replace with an org-scoped DB view or RPC in production.
const MOCK_PEERS: Omit<Member, 'isYou'>[] = [
  { id: '1', name: 'Devon Cole', role: 'Senior ML Engineer', initials: 'DC', color: '#7C3AED', course: 'RAG Systems from Scratch', pct: 82, streak: 12, lastSeen: '2 min ago', status: 'online' },
  { id: '2', name: 'Riya Shah', role: 'Product Manager', initials: 'RS', color: '#22D3EE', course: 'Prompt Engineering', pct: 64, streak: 8, lastSeen: '12 min ago', status: 'online' },
  { id: '3', name: 'Marcus Lee', role: 'Frontend Lead', initials: 'ML', color: '#F472B6', course: 'Evaluating LLM Apps', pct: 51, streak: 5, lastSeen: '1 hour ago', status: 'away' },
  { id: '4', name: 'Aiko Nakamura', role: 'Data Scientist', initials: 'AN', color: '#34D399', course: 'AI Foundations', pct: 47, streak: 4, lastSeen: '2 hours ago', status: 'away' },
  { id: '5', name: 'Theo Bauer', role: 'Backend Engineer', initials: 'TB', color: '#FBBF24', course: 'Agentic Workflows', pct: 31, streak: 2, lastSeen: 'Yesterday', status: 'offline' },
  { id: '6', name: 'Priya Chand', role: 'Director of Engineering', initials: 'PC', color: '#FB7185', course: 'AI for Leaders', pct: 91, streak: 22, lastSeen: '5 min ago', status: 'online' },
]

// Mock activity feed
const ACTIVITY = [
  { who: 'Devon Cole', what: 'finished RAG retrieval lesson', when: '2 min ago', Icon: Sparkles, color: 'text-primary' },
  { who: 'Priya Chand', what: 'earned the Cohort Champion badge', when: '12 min ago', Icon: Trophy, color: 'text-yellow-400' },
  { who: 'Riya Shah', what: 'aced the structured-output quiz', when: '34 min ago', Icon: Zap, color: 'text-cyan-400' },
  { who: 'Marcus Lee', what: 'asked a question in #ai-cohort', when: '1 hour ago', Icon: MessageSquare, color: 'text-pink-400' },
  { who: 'Aiko Nakamura', what: 'started Evaluating LLM Apps', when: '2 hours ago', Icon: Activity, color: 'text-emerald-400' },
]

// Upcoming live sessions
const SESSIONS = [
  { day: 'TUE', date: 4, title: 'Office hours: RAG architecture', host: 'Dr. Maya Reyes', time: '6:00 PM EST', kind: 'Live workshop' },
  { day: 'THU', date: 6, title: 'Code review: Lab 03', host: 'Adesua Okafor', time: '5:00 PM EST', kind: 'Code review' },
  { day: 'FRI', date: 7, title: 'Cohort Q&A — Eval rubrics', host: 'Priya Chand', time: '4:00 PM EST', kind: 'Q&A' },
]

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Real org info (if accessible)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, email, org_id, role, organizations(name, slug)')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as unknown as {
    full_name: string | null
    email: string
    org_id: string | null
    role: string
    organizations: { name: string; slug: string } | null
  } | null

  const orgName = profile?.organizations?.name ?? 'Synapse Cohort'
  const userInitials = (profile?.full_name ?? user.email ?? 'YO').slice(0, 2).toUpperCase()

  // Compose member list with current user inserted
  const members: Member[] = [
    {
      id: user.id,
      name: profile?.full_name ?? (user.email ?? '').split('@')[0] ?? 'You',
      role: profile?.role === 'admin' ? 'Admin · You' : 'Cohort Member · You',
      initials: userInitials,
      color: '#A78BFA',
      course: 'AI Foundations · Prompt Engineering',
      pct: 62,
      streak: 7,
      isYou: true,
      lastSeen: 'Now',
      status: 'online',
    },
    ...MOCK_PEERS,
  ]

  const onlineCount = members.filter((m) => m.status === 'online').length
  const totalMembers = members.length
  const avgPct = Math.round(members.reduce((s, m) => s + m.pct, 0) / members.length)
  const totalStreakDays = members.reduce((s, m) => s + m.streak, 0)

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[22px] border border-border bg-[radial-gradient(700px_320px_at_15%_0%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(500px_280px_at_92%_100%,rgba(139,92,246,0.22),transparent_60%),linear-gradient(180deg,#14142A,#0E0E1B)] px-11 py-9">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_rgba(139,92,246,0.45)]">
              <Building2 size={26} className="text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
                <Users size={12} /> Enterprise Cohort
              </div>
              <h1 className="my-2 text-[34px] font-bold leading-[1.08] tracking-[-0.02em]">
                {orgName}
              </h1>
              <p className="text-[14px] text-muted-foreground">
                {totalMembers} learners · {onlineCount} online · shared cohort schedule
              </p>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Members', value: totalMembers, Icon: Users, hue: 'text-cyan-400' },
              { label: 'Active streak', value: `${totalStreakDays}d`, Icon: Flame, hue: 'text-orange-400' },
              { label: 'Avg progress', value: `${avgPct}%`, Icon: Activity, hue: 'text-primary' },
              { label: 'Online now', value: onlineCount, Icon: Sparkles, hue: 'text-emerald-400' },
            ].map(({ label, value, Icon, hue }) => (
              <div key={label} className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-md">
                <Icon size={14} className={hue} />
                <div className="mt-1 font-mono text-[20px] font-bold tabular-nums">{value}</div>
                <div className="text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-10 -right-10 -top-10 w-[420px]">
          <div className="absolute right-0 top-5 h-[280px] w-[280px] rounded-full bg-accent/35 blur-[40px]" />
          <div className="absolute right-[100px] top-[200px] h-[220px] w-[220px] rounded-full bg-primary/40 blur-[40px]" />
        </div>
      </section>

      {/* ── Two-col: Members + Schedule ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* Team members */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold tracking-tight">Team members</h2>
            <button className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <MessageSquare size={12} /> Open #ai-cohort
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {members.map((m) => (
              <div
                key={m.id}
                className={[
                  'flex flex-col gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5',
                  m.isYou
                    ? 'border-primary/30 bg-gradient-to-br from-primary/[0.10] to-accent/[0.04] ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-white/15',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-full text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                      style={{ background: m.color }}
                    >
                      {m.initials}
                    </div>
                    <span
                      className={[
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card',
                        m.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]' :
                        m.status === 'away' ? 'bg-yellow-400' : 'bg-muted',
                      ].join(' ')}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{m.name}</span>
                      {m.isYou && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">YOU</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">{m.role}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-orange-400">
                      <Flame size={10} /> {m.streak}d
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">{m.lastSeen}</span>
                  </div>
                </div>

                {/* Currently learning */}
                <div className="rounded-[10px] border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Currently learning</div>
                  <div className="mt-0.5 truncate text-[12.5px] font-medium">{m.course}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${m.pct}%`, background: m.color, boxShadow: `0 0 6px ${m.color}77` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{m.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Schedule + Activity */}
        <div className="flex flex-col gap-6">

          {/* Cohort schedule */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold tracking-tight">Upcoming sessions</h2>
              <Link href="/catalog" className="text-[11.5px] text-muted-foreground hover:text-foreground">
                Calendar
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              {SESSIONS.map((s, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-secondary/20 p-3 transition-all hover:border-primary/30 hover:bg-secondary/40"
                >
                  <div className="flex w-12 flex-shrink-0 flex-col items-center rounded-lg border border-border bg-card py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-primary">{s.day}</div>
                    <div className="font-mono text-[16px] font-bold tabular-nums">{s.date}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{s.kind}</div>
                    <div className="text-[13px] font-semibold leading-snug">{s.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Briefcase size={10} /> {s.host}
                      <span>·</span>
                      <Clock size={10} /> {s.time}
                    </div>
                  </div>
                  <ChevronRight size={14} className="mt-1 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                </div>
              ))}
            </div>
          </section>

          {/* Activity feed */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold tracking-tight">Cohort activity</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
                Live
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {ACTIVITY.map((a, i) => {
                const Icon = a.Icon
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-secondary/60 ${a.color}`}>
                      <Icon size={12} />
                    </div>
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="text-[12.5px]">
                        <span className="font-semibold">{a.who}</span>{' '}
                        <span className="text-muted-foreground">{a.what}</span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground/70">{a.when}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer CTA: Instructor feedback ─────────────────────── */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/[0.08] to-accent/[0.05] p-6">
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[0_0_20px_rgba(139,92,246,0.4)]">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <div className="text-[16px] font-bold">Instructor feedback open</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                Submit your latest lab project for a 1:1 review with{' '}
                <span className="font-medium text-foreground">Dr. Maya Reyes</span>.
                Average turnaround: 24 hours.
              </div>
            </div>
          </div>
          <button className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-b from-primary to-primary/75 px-5 py-2.5 text-[13px] font-semibold text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5">
            Request review <ChevronRight size={14} />
          </button>
        </div>
      </section>
    </main>
  )
}
