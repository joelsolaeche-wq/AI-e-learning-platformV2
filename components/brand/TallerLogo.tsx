// components/brand/TallerLogo.tsx
// Taller AI brand mark — coral arrow on dark rounded square.
// Path geometry matches the Taller Technologies icon: a horizontal foot at
// bottom-left, a 45° diagonal shaft, and an L-shaped arrowhead pointing NE.

interface TallerLogoProps {
  size?: number
  /** Adds an outer glow halo behind the mark */
  glow?: boolean
  /** Override the rounded-square background (default: near-black ink) */
  background?: string
  /** Use a flat coral fill instead of the gradient (matches the source icon exactly) */
  flat?: boolean
  className?: string
}

const ARROW_PATH =
  'M14 78 L40 78 L70 48 L86 48 L86 12 L50 12 L50 30 L70 30 L40 60 L14 60 Z'

export function TallerLogo({
  size = 28,
  glow = true,
  background = '#080808',
  flat = true,
  className,
}: TallerLogoProps) {
  return (
    <span
      className={[
        'inline-grid place-items-center',
        glow ? 'drop-shadow-[0_0_14px_rgba(255,68,68,0.55)]' : '',
        className ?? '',
      ].join(' ')}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          <linearGradient id="taller-arrow-grad" x1="20%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF3B3B" />
            <stop offset="100%" stopColor="#FF5252" />
          </linearGradient>
        </defs>

        {/* Rounded-square background — matches the source icon */}
        <rect width="100" height="100" rx="14" fill={background} />

        {/* Coral arrow */}
        <path d={ARROW_PATH} fill={flat ? '#FF4444' : 'url(#taller-arrow-grad)'} />
      </svg>
    </span>
  )
}

/**
 * Inline SVG variant (no wrapping span) — useful inside flex rows where you
 * already control sizing via the parent. Same path as <TallerLogo />.
 */
export function TallerLogoInline({
  size = 22,
  background = '#080808',
}: {
  size?: number
  background?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="100" height="100" rx="14" fill={background} />
      <path d={ARROW_PATH} fill="#FF4444" />
    </svg>
  )
}
