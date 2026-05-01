// components/layout/TopBar.tsx
'use client'

import { Search, Bell, Sparkles } from 'lucide-react'

interface TopBarProps {
  level?: number
  xp?: number
  xpToNext?: number
  notificationCount?: number
}

export function TopBar({
  level = 7,
  xp = 2340,
  xpToNext = 3800,
  notificationCount = 0,
}: TopBarProps) {
  const pct = Math.min(100, Math.round((xp / xpToNext) * 100))

  return (
    <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/65 px-10 py-3.5 backdrop-blur-md">
      {/* Search */}
      <div className="flex max-w-[540px] flex-1 items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-2 text-muted-foreground transition-all focus-within:border-primary/50 focus-within:text-foreground focus-within:ring-4 focus-within:ring-primary/10">
        <Search size={15} strokeWidth={1.6} />
        <input
          placeholder="Search courses, lessons, concepts…"
          className="flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* XP chip */}
        <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-gradient-to-r from-primary/[0.14] to-accent/[0.10] px-3 py-1.5 text-[12px]">
          <Sparkles size={14} strokeWidth={1.6} className="text-primary" />
          <span className="font-bold text-primary">Lv {level}</span>
          <div className="h-[5px] w-20 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_8px_rgba(139,92,246,0.5)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{xp.toLocaleString('en-US')} XP</span>
        </div>

        {/* Bell */}
        <button className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Notifications">
          <Bell size={16} strokeWidth={1.6} />
          {notificationCount > 0 && (
            <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-rose-400 shadow-[0_0_6px_rgb(251,113,133)]" />
          )}
        </button>
      </div>
    </div>
  )
}
