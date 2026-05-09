// components/companies/CompanyCard.tsx
//
// Reusable company card for the squares dashboard. Used by:
//   - Admin landing (/admin/companies)
//   - Learner home (/dashboard) — only when learner belongs to multiple companies
//
// Logo-driven: uses organizations.logo_url when present; falls back to a
// deterministic gradient + initial.

import Link from 'next/link'
import { Building2, Users, GraduationCap, ChevronRight } from 'lucide-react'

const HUES: Array<{ from: string; to: string }> = [
  { from: '#7C3AED', to: '#22D3EE' },
  { from: '#06B6D4', to: '#10B981' },
  { from: '#F472B6', to: '#FB923C' },
  { from: '#FB7185', to: '#A78BFA' },
  { from: '#34D399', to: '#60A5FA' },
  { from: '#FBBF24', to: '#F472B6' },
]
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

function initialOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export interface CompanyCardProps {
  company: {
    id: string
    name: string
    logo_url?: string | null
  }
  cohortCount: number
  /** Optional learner count badge — omit when not visible (RLS) or not relevant. */
  learnerCount?: number | null
  href: string
}

export function CompanyCard({ company, cohortCount, learnerCount, href }: CompanyCardProps) {
  const hue = hueFor(company.id)
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
    >
      <div
        className="relative flex aspect-[16/7] items-center justify-center overflow-hidden"
        style={
          company.logo_url
            ? undefined
            : { background: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }
        }
      >
        {company.logo_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={company.logo_url}
              alt={company.name}
              className="absolute inset-0 h-full w-full object-contain p-6"
              loading="lazy"
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_55%)]" />
            <span className="font-mono text-[44px] font-semibold text-white/90 drop-shadow-[0_0_18px_rgba(0,0,0,0.35)]">
              {initialOf(company.name)}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[14.5px] font-bold tracking-tight">
              <Building2 size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{company.name}</span>
            </div>
          </div>
          <ChevronRight size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>

        <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap size={13} />
            {cohortCount} cohort{cohortCount === 1 ? '' : 's'}
          </span>
          {typeof learnerCount === 'number' && (
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} />
              {learnerCount} learner{learnerCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
