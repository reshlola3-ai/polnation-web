import * as React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
}

/**
 * Polygon-style mono caps eyebrow label. Mirrors the visual of
 * `.u-mono-medium tc-g200 all-caps` from polygon.technology — small mono caps
 * in muted grey, used as section/card sub-labels.
 */
export function EyebrowTag({ children, className = '' }: Props) {
  return (
    <span
      className={`inline-block uppercase tracking-[0.12em] text-[10px] leading-none ${className}`}
      style={{
        fontFamily: 'var(--poly-font-mono)',
        color: 'var(--poly-grey-200)',
      }}
    >
      {children}
    </span>
  )
}
