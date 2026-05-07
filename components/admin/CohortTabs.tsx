'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

export function CohortTabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)

  return (
    <div>
      <div className="flex border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              active === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} className={active === tab.id ? 'block' : 'hidden'}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
