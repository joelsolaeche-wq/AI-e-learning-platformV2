// components/cohorts/CohortCard.tsx
//
// Reusable cohort card. Used by:
//   - Learner home (/dashboard) — passes progress + resume href
//   - Admin cohort list — passes memberCount + stats/edit hrefs
//
// When `imageUrl` is null, falls back to a deterministic gradient with a
// glyph symbol — preserves the existing learner-home aesthetic.

import Link from 'next/link'
import { Users, ChevronRight, ArrowRight } from 'lucide-react'
import { Ring } from '@/components/ui/Ring'

const HUES: Array<{ from: string; to: string; symbol: string }> = [
  { from: '#7C3AED', to: '#22D3EE', symbol: '✦' },
  { from: '#06B6D4', to: '#10B981', symbol: '◐' },
  { from: '#F472B6', to: '#FB923C', symbol: '◇' },
  { from: '#FB7185', to: '#A78BFA', symbol: '◎' },
  { from: '#34D399', to: '#60A5FA', symbol: '△' },
  { from: '#FBBF24', to: '#F472B6', symbol: '◈' },
]
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

function statusBadge(input: { pct?: number; status?: string | null }): { label: string; cls: string } {
  // Progress-driven badge for learner view
  if (typeof input.pct === 'number') {
    const pct = input.pct
    if (pct === 0) return { label: 'Just started', cls: 'bg-blue-400/20 text-blue-300 border-blue-400/40' }
    if (pct < 80) return { label: 'On track', cls: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40' }
    if (pct < 100) return { label: 'Almost done', cls: 'bg-orange-400/20 text-orange-300 border-orange-400/40' }
    return { label: 'Completed', cls: 'bg-primary/20 text-primary border-primary/40' }
  }
  // Status-driven badge for admin view
  switch (input.status) {
    case 'active':
      return { label: 'Active', cls: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40' }
    case 'completed':
      return { label: 'Completed', cls: 'bg-primary/20 text-primary border-primary/40' }
    case 'cancelled':
      return { label: 'Cancelled', cls: 'bg-rose-400/20 text-rose-300 border-rose-400/40' }
    default:
      return { label: 'Draft', cls: 'bg-secondary/40 text-muted-foreground border-border' }
  }
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000))
}

function formatStartDate(startsAt: string): string {
  const d = new Date(startsAt)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface CohortCardProps {
  cohort: {
    id: string
    title: string
    status: string | null
    starts_at: string
    ends_at: string | null
    image_url: string | null
  }
  /** Course/headline title to show under the cohort title (e.g. course name). */
  subtitle?: string | null
  /** Learner-side progress. Omit in admin view. */
  progress?: { completed: number; total: number } | null
  /** Member count badge (admin view). */
  memberCount?: number | null
  /** Show a "New" badge on the banner (e.g. recently enrolled). */
  isNew?: boolean
  /** Primary CTA — usually the link to the lesson, stats, or detail page. */
  primaryHref: string
  /** Optional secondary action label + href (e.g. "Edit"). */
  secondaryAction?: { label: string; href: string } | null
  /** Variant tweaks layout: 'learner' shows a play button + ring; 'admin' shows member count + dates. */
  variant?: 'learner' | 'admin'
}

export function CohortCard({
  cohort,
  subtitle,
  progress,
  memberCount,
  isNew,
  primaryHref,
  secondaryAction,
  variant = 'learner',
}: CohortCardProps) {
  const hue = hueFor(cohort.id)
  const pct = progress && progress.total > 0
    ? Math.floor((progress.completed / progress.total) * 100)
    : undefined
  const badge = statusBadge(
    variant === 'learner' ? { pct: pct ?? 0 } : { status: cohort.status },
  )
  const days = daysLeft(cohort.ends_at)

  // Learner variant: the entire card is a single clickable link to the
  // primary destination (e.g. the cohort detail page in the dashboard
  // drilldown). Nested links would be invalid HTML, so admin gets the
  // multi-button layout and learner gets a wrapping Link.
  const cardClasses =
    'group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]'

  const banner = (
    <div
      className="relative grid aspect-[16/7] place-items-center overflow-hidden"
      style={
        cohort.image_url
          ? undefined
          : { background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }
      }
    >
      {cohort.image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cohort.image_url}
            alt={cohort.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.30),transparent_55%)]" />
          <span className="font-mono text-[52px] font-semibold text-white/90 drop-shadow-[0_0_24px_rgba(0,0,0,0.4)]">
            {hue.symbol}
          </span>
        </>
      )}
      {isNew && (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-bold text-primary-foreground shadow-[0_0_12px_rgba(139,92,246,0.7)]">
          New
        </span>
      )}
      <span className={`absolute right-2.5 top-2.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-md ${badge.cls}`}>
        {badge.label}
      </span>
    </div>
  )

  if (variant === 'learner') {
    return (
      <Link href={primaryHref} className={cardClasses} aria-label={`Open ${cohort.title}`}>
        {banner}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <div className="text-[14.5px] font-bold tracking-tight leading-snug">
              {cohort.title}
            </div>
            {subtitle && (
              <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{subtitle}</div>
            )}
          </div>

          {progress ? (
            <div className="flex items-center gap-3">
              <Ring pct={pct ?? 0} size={52} stroke={5}>
                <span className="text-[11px] font-bold">{pct ?? 0}%</span>
              </Ring>
              <div className="flex-1">
                <div className="text-[13px] font-semibold">
                  {progress.completed}/{progress.total} lessons
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {days !== null ? `${days} days left` : 'No deadline'}
                </div>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-primary/30 bg-primary/15 text-primary transition-all group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                <ArrowRight size={14} />
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
              <span className="font-mono text-[11.5px] tabular-nums">
                starts {formatStartDate(cohort.starts_at)}
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors group-hover:text-primary">
                <ArrowRight size={14} />
              </span>
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Admin variant: stats + member count + Stats/Edit buttons (multi-action,
  // so no wrapping link).
  return (
    <div className={cardClasses}>
      {banner}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="text-[14.5px] font-bold tracking-tight leading-snug">
            {cohort.title}
          </div>
          {subtitle && (
            <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{subtitle}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users size={13} />
            {memberCount ?? 0} member{memberCount === 1 ? '' : 's'}
          </span>
          <span className="font-mono text-[11.5px] tabular-nums">
            starts {formatStartDate(cohort.starts_at)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Link
            href={primaryHref}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Stats <ChevronRight size={12} />
          </Link>
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex h-8 items-center rounded-lg border border-border bg-secondary/40 px-3 text-[12.5px] text-foreground hover:bg-secondary transition-colors"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
