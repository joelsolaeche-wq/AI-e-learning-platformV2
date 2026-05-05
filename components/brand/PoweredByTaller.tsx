// components/brand/PoweredByTaller.tsx
// Compact "Powered by Taller AI" badge — used in sidebar footer, landing footer,
// and below auth forms. Variant prop controls density.

import { TallerLogoInline } from './TallerLogo'

interface PoweredByTallerProps {
  variant?: 'compact' | 'inline' | 'pill'
  className?: string
}

export function PoweredByTaller({ variant = 'compact', className }: PoweredByTallerProps) {
  if (variant === 'pill') {
    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/[0.10] px-2.5 py-1',
          'text-[10.5px] font-semibold uppercase tracking-[0.1em] text-rose-200',
          className ?? '',
        ].join(' ')}
      >
        <TallerLogoInline size={12} />
        Powered by Taller&nbsp;AI
      </span>
    )
  }

  if (variant === 'inline') {
    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 text-[11px] text-muted-foreground',
          className ?? '',
        ].join(' ')}
      >
        <TallerLogoInline size={12} />
        Powered by{' '}
        <span className="font-semibold text-foreground/85">Taller&nbsp;AI</span>
      </span>
    )
  }

  // compact (default) — vertical stacked block, suited to sidebar footer
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-xl border border-rose-400/20 bg-gradient-to-br from-rose-500/[0.08] via-orange-500/[0.05] to-transparent px-2.5 py-2 backdrop-blur-md',
        className ?? '',
      ].join(' ')}
    >
      <TallerLogoInline size={20} />
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Powered by
        </span>
        <span className="mt-0.5 text-[12px] font-bold tracking-tight">
          Taller&nbsp;<span className="grad-text-warm">AI</span>
        </span>
      </div>
    </div>
  )
}
