// components/ui/Breadcrumbs.tsx
//
// Tiny breadcrumb trail used by the dashboard drilldown
// (Dashboard › Company › Cohort). Last crumb renders as plain text.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
      {items.map((c, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {isLast || !c.href ? (
              <span className={isLast ? 'text-foreground font-medium' : ''}>{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="rounded-md px-1 py-0.5 transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
            {!isLast && <ChevronRight size={12} className="text-muted-foreground/50" />}
          </span>
        )
      })}
    </nav>
  )
}
