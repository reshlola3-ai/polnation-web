import * as React from 'react'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Bevel size — sm for compact tiles, lg for hero/feature panels. */
  size?: 'sm' | 'lg'
  /** Stroke color. Defaults to subtle white at 18%. */
  strokeColor?: string
  /** Background fill. Defaults to a subtle white panel. */
  bg?: string
  /** Inner padding (px). Default 18. */
  pad?: number
}

/**
 * Staking.polygon.technology-style bevel card. Single chamfered corner
 * (bottom-right only). Uses an SVG <path> that explicitly draws all five sides
 * including the diagonal, so the bevel edge always has a visible stroke line —
 * unlike clip-path which clips the border and leaves the corner open.
 *
 * viewBox aspect ratios are tuned to typical use sizes:
 *   sm (100×60)  — Quick Action tiles, compact chips
 *   lg (400×200) — Feature panels, Withdraw card
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
  const { viewBox, d } = size === 'sm'
    ? { viewBox: '0 0 100 60',  d: 'M0.5,0.5 H99.5 V50 L90,59.5 H0.5 Z' }
    : { viewBox: '0 0 400 200', d: 'M0.5,0.5 H399.5 V178 L378,199.5 H0.5 Z' }

  return (
    <div
      {...rest}
      className={`relative ${className}`}
      style={{ padding: pad, ...style }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d={d}
          fill={bg}
          stroke={strokeColor}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative">{children}</div>
    </div>
  )
}
