// components/ui/Ring.tsx
'use client'

interface RingProps {
  pct: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
}

export function Ring({
  pct,
  size = 72,
  stroke = 6,
  color = 'hsl(var(--primary))',
  track = 'rgba(255,255,255,0.08)',
  children,
}: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * (Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)',
            filter: `drop-shadow(0 0 8px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-semibold">{children}</div>
    </div>
  )
}
