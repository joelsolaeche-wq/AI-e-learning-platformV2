'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard, Building2, Users, BookOpen, UsersRound,
  Home, Trophy, PanelLeftOpen, X, LogOut, User as UserIcon,
  Flame, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOutAction } from '@/lib/actions/auth.actions'

interface SidebarUser {
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
}

interface Props {
  user: SidebarUser
  role: string
}

const LEARNER_NAV = [
  { href: '/dashboard', label: 'My Dashboard', icon: Home },
  { href: '/catalog', label: 'Catalog', icon: BookOpen },
  { href: '/dashboard/achievements', label: 'Achievements', icon: Trophy },
  { href: '/dashboard/team', label: 'My Cohort', icon: UsersRound },
]

export function AdminSidebar({ user, role }: Props) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const fullNav = role === 'admin' || role === 'instructor'
  const ADMIN_NAV = [
    ...(fullNav ? [{ href: '/admin/users', label: 'Users', Icon: Users }] : []),
    { href: '/admin/companies', label: 'Companies', Icon: Building2 },
    ...(fullNav ? [
      { href: '/admin/courses', label: 'Courses', Icon: BookOpen },
      { href: '/admin/cohorts', label: 'Cohorts', Icon: UsersRound },
    ] : []),
  ]

  // Close user menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const initials = (user.full_name || user.email).slice(0, 2).toUpperCase()

  return (
    <>
      {/* Learner nav drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-50 flex h-full w-[248px] flex-col border-r border-border bg-[#0B0B14] px-3.5 py-5 shadow-[4px_0_32px_rgba(0,0,0,0.5)]">
            {/* Drawer header */}
            <div className="mb-4 flex items-center justify-between px-2">
              <div>
                <div className="text-[15px] font-bold tracking-tight">Synapse</div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Learner view</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Learner nav */}
            <nav className="flex flex-col gap-0.5">
              {LEARNER_NAV.map((item) => {
                const Icon = item.icon
                const active = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-all',
                      active
                        ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-foreground ring-1 ring-primary/25'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    )}
                  >
                    <Icon size={17} strokeWidth={1.6} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="mt-auto">
              <Link
                href="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <LayoutDashboard size={15} strokeWidth={1.6} />
                Go to dashboard
                <ChevronRight size={13} className="ml-auto" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Admin sidebar */}
      <aside className="sticky top-0 h-screen w-52 shrink-0 flex flex-col border-r border-border bg-card px-3 py-5">
        {/* Header */}
        <div className="flex items-center justify-between px-2 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Admin panel
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            title="Switch to learner view"
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <PanelLeftOpen size={14} />
          </button>
        </div>

        {/* Admin nav */}
        <nav className="flex flex-col gap-0.5">
          {ADMIN_NAV.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                  active
                    ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-foreground ring-1 ring-primary/25'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                )}
              >
                <Icon size={15} strokeWidth={1.6} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <LayoutDashboard size={15} strokeWidth={1.6} />
            Back to dashboard
          </Link>

          {/* User profile menu */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[10px] border bg-card px-2.5 py-2 text-left transition-colors',
                menuOpen ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border hover:border-white/15',
              )}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-[12px] font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">
                  {user.full_name || user.email.split('@')[0]}
                </div>
                <div className="truncate text-[10.5px] text-muted-foreground">{user.email}</div>
              </div>
              <Flame size={13} className="shrink-0 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-border bg-card/95 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl animate-[fadeUp_.14s_ease]"
              >
                <div className="border-b border-border px-3 pb-2 pt-1.5 text-[12px] leading-tight">
                  <div className="truncate font-semibold">{user.full_name || user.email.split('@')[0]}</div>
                  <div className="truncate text-[10.5px] text-muted-foreground">{user.email}</div>
                </div>
                <Link
                  href="/settings/profile"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  role="menuitem"
                >
                  <UserIcon size={13} /> Profile & settings
                </Link>
                <div className="my-1 h-px bg-border/60" />
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); signOutAction() }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-rose-300 hover:bg-rose-400/10 transition-colors"
                  role="menuitem"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
