import * as React from 'react'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Stroke color of the notched outline. Defaults to a subtle white at 18%. */
  strokeColor?: string
  /** Inner padding (px). Default 18. */
  pad?: number
}

/**
 * Polygon-style notched card. Renders an SVG outline behind children with two
 * chamfered corners (top-left, bottom-right) — same path polygon.technology uses
 * on .feature-card-bg mobile slides (viewBox 253×240), scaled non-uniformly to
 * fit the wrapper.
 */
export function NotchedCard({
  strokeColor = 'rgba(255,255,255,0.18)',
  pad = 18,
  className = '',
  style,
  children,
  ...rest
}: Props) {
  return (
    <div
      {...rest}
      className={`relative ${className}`}
      style={{ padding: pad, ...style }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 253 240"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M31.5195 0.5H248.98C250.913 0.500227 252.48 2.06666 252.48 3.99902L252.5 221.989L252.495 222.174C252.447 223.094 252.036 223.961 251.35 224.583L235.885 238.594C235.241 239.177 234.403 239.5 233.535 239.5H4C2.067 239.5 0.5 237.933 0.5 236V76.5H0.521484V76L0.500977 30.2119C0.50056 29.2536 0.893116 28.3367 1.58691 27.6758L29.1055 1.46582C29.7156 0.88476 30.5137 0.544148 31.3516 0.503906L31.5195 0.5Z"
          stroke={strokeColor}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative">{children}</div>
    </div>
  )
}
