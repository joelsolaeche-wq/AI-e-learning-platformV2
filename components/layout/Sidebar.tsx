// components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  Home, BookOpen, PlayCircle, Trophy, Users, Flame, MoreHorizontal,
  LogOut, Settings, User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOutAction } from '@/lib/actions/auth.actions'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  activePrefix?: string
}

interface SidebarProps {
  user: { email: string; full_name?: string | null }
  streakDays?: number
  lastLessonHref?: string
}

export function Sidebar({ user, streakDays = 7, lastLessonHref }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = (user.full_name || user.email).slice(0, 2).toUpperCase()

  // User menu (Sign out lives here — POSTs to /auth/logout, the existing route)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleDocClick(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleDocClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [menuOpen])

  const NAV: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/catalog', label: 'Catalog', icon: BookOpen },
    {
      href: lastLessonHref ?? '/catalog',
      label: 'Lesson',
      icon: PlayCircle,
      activePrefix: '/dashboard/lesson',
    },
    { href: '/dashboard/achievements', label: 'Achievements', icon: Trophy },
    { href: '/dashboard/team', label: 'Team', icon: Users },
  ]

  return (
    <aside className="sticky top-0 h-screen w-[248px] flex flex-col gap-5 border-r border-border bg-gradient-to-b from-white/[0.02] to-transparent px-3.5 py-5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 pb-1">
        <div className="drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
            <path d="M12 2 L22 8 V16 L12 22 L2 16 V8 Z" fill="url(#logo-grad)" />
            <path d="M12 6 L17 9 V14 L12 17 L7 14 V9 Z" fill="#0B0B14" opacity="0.55" />
            <circle cx="12" cy="11.5" r="1.6" fill="white" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight">Synapse</div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">AI Academy</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.activePrefix
            ? pathname.startsWith(item.activePrefix)
            : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'relative flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-all',
                active
                  ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-foreground ring-1 ring-primary/25'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
              )}
            >
              {active && (
                <span className="absolute -left-[14px] top-2 bottom-2 w-[3px] rounded bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
              )}
              <Icon size={17} strokeWidth={1.6} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-2.5">
        {streakDays > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-orange-400/25 bg-gradient-to-br from-orange-400/[0.18] to-rose-400/[0.10] px-3 py-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-orange-400 to-pink-400 text-white shadow-[0_0_16px_rgba(251,146,60,0.5)]">
              <Flame size={18} />
            </div>
            <div>
              <div className="text-[13px] font-bold">{streakDays} days</div>
              <div className="text-[11px] text-muted-foreground">Don&apos;t break it</div>
            </div>
          </div>
        )}
        <div ref={menuWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[10px] border bg-card px-2.5 py-2 text-left transition-colors',
              menuOpen ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border hover:border-white/15',
            )}
          >
            <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-[12px] font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">{user.full_name || user.email.split('@')[0]}</div>
              <div className="truncate text-[10.5px] text-muted-foreground">{user.email}</div>
            </div>
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground">
              <MoreHorizontal size={16} />
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-border bg-card/95 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl animate-[fadeUp_.14s_ease]"
            >
              <div className="flex items-center gap-2 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Signed in as
              </div>
              <div className="border-b border-border px-3 pb-2 text-[12px] leading-tight">
                <div className="truncate font-semibold">{user.full_name || user.email.split('@')[0]}</div>
                <div className="truncate text-[10.5px] text-muted-foreground">{user.email}</div>
              </div>

              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                role="menuitem"
              >
                <UserIcon size={13} /> Profile
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                role="menuitem"
              >
                <Settings size={13} /> Settings
              </Link>

              <div className="my-1 h-px bg-border/60" />

              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-rose-300 transition-colors hover:bg-rose-400/10"
                  role="menuitem"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
