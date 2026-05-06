'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, UsersRound, BookOpen, Users, FlaskConical, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { segment: '', label: 'Overview', icon: LayoutGrid },
  { segment: 'cohorts', label: 'Cohorts', icon: UsersRound },
  { segment: 'courses', label: 'Courses', icon: BookOpen },
  { segment: 'members', label: 'Members', icon: Users },
  { segment: 'labs', label: 'Labs', icon: FlaskConical },
  { segment: 'progress', label: 'Progress', icon: BarChart3 },
]

export function CompanyWorkspaceTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname()
  const base = `/admin/companies/${companyId}`

  function isActive(segment: string) {
    const href = segment === '' ? base : `${base}/${segment}`
    if (segment === '') return pathname === base || pathname === base + '/'
    return pathname.startsWith(`${base}/${segment}`)
  }

  return (
    <nav className="flex gap-0.5 border-b border-border">
      {TABS.map(({ segment, label, icon: Icon }) => {
        const href = segment === '' ? base : `${base}/${segment}`
        const active = isActive(segment)
        return (
          <Link
            key={segment}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30',
            )}
          >
            <Icon size={14} strokeWidth={1.6} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
