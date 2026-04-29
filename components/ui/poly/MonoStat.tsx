import * as React from 'react'

type Props = {
  /** The numeric value to render (already formatted, e.g. "31.45"). */
  value: string
  /** Optional currency / unit prefix (e.g. "$"). Rendered smaller and muted. */
  prefix?: string
  /** Optional unit suffix (e.g. "POL"). */
  suffix?: string
  /** Visual size: tile (small card stat), main (hero stat). */
  size?: 'tile' | 'main'
  className?: string
}

/**
 * Polygon-style mono stat. Uses PolySansMono so digits sit on a grid like
 * polygon.technology's feature cards. Prefix/suffix render at a smaller mono
 * size and muted color.
 */
export function MonoStat({
  value,
  prefix,
  suffix,
  size = 'tile',
  className = '',
}: Props) {
  const valueSize = size === 'main' ? 'text-[44px] sm:text-[52px]' : 'text-[20px]'
  const fixSize = size === 'main' ? 'text-[20px] sm:text-[24px]' : 'text-[12px]'
  return (
    <span
      className={`inline-flex items-baseline gap-1 leading-none tabular-nums text-white ${className}`}
      style={{ fontFamily: 'var(--poly-font-mono)' }}
    >
      {prefix && (
        <span className={`${fixSize} text-white/55`}>{prefix}</span>
      )}
      <span className={`${valueSize} font-semibold tracking-tight`}>{value}</span>
      {suffix && (
        <span
          className={`${fixSize} uppercase`}
          style={{ color: 'var(--poly-grey-200)' }}
        >
          {suffix}
        </span>
      )}
    </span>
  )
}
