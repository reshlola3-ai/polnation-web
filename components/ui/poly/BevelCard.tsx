import * as React from 'react'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Bevel size — sm (10px) for compact tiles, lg (18px) for hero/feature cards. */
  size?: 'sm' | 'lg'
  /** Stroke color. Defaults to subtle white at 18%. */
  strokeColor?: string
  /** Background fill color. Defaults to a subtle white panel. */
  bg?: string
  /** Inner padding (px). Default 18. */
  pad?: number
}

/**
 * Staking.polygon.technology-style bevel card. Single chamfered corner
 * (bottom-right only) — distinct from <NotchedCard>'s two-corner marketing
 * variant. Uses clip-path matching staking's --clip-bevel-sm/lg tokens. The
 * stroke is painted by an inner absolute div clipped to the same shape, which
 * (like staking itself) loses 1px at the bevel corner — that "engineered"
 * rough edge is part of the look.
 */
export function BevelCard({
  size = 'lg',
  strokeColor = 'rgba(255,255,255,0.18)',
  bg = 'rgba(255,255,255,0.04)',
  pad = 18,
  className = '',
  style,
  children,
  ...rest
}: Props) {
  const clipPath = `var(--clip-bevel-${size})`
  return (
    <div
      {...rest}
      className={`relative ${className}`}
      style={{
        padding: pad,
        clipPath,
        WebkitClipPath: clipPath,
        background: bg,
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath,
          WebkitClipPath: clipPath,
          border: `1px solid ${strokeColor}`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
