'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { BevelCard } from './BevelCard'

interface Props {
  /** Mono caps title shown in the header. */
  title: string
  /** Optional small icon before the title. */
  icon?: React.ReactNode
  /** Optional preview value (right side) shown when collapsed/expanded — gives users a glance without opening. */
  preview?: React.ReactNode
  /** Default state — defaults to collapsed. */
  defaultOpen?: boolean
  /** Padding for content area when expanded (px). Default 20. */
  contentPad?: number
  children: React.ReactNode
}

/**
 * Polygon-style collapsible panel. Wraps content in a BevelCard (single-corner
 * bottom-right bevel) with a clickable mono-caps header. Default collapsed.
 *
 * Animation: uses CSS grid-template-rows 0fr → 1fr trick for smooth
 * height transitions without measuring.
 */
export function Collapsible({
  title,
  icon,
  preview,
  defaultOpen = false,
  contentPad = 20,
  children,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <BevelCard size="lg" pad={0}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center w-full gap-3 px-5 py-4 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
      >
        {icon && (
          <div className="w-7 h-7 flex items-center justify-center shrink-0 text-white/70 border border-white/15">
            {icon}
          </div>
        )}
        <span
          className="flex-1 text-left text-[11px] uppercase text-white/85"
          style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.12em' }}
        >
          {title}
        </span>
        {preview != null && (
          <span
            className="text-[13px] text-white/55 tabular-nums shrink-0"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            {preview}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-white/45 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            className="border-t border-white/[0.06]"
            style={{ paddingLeft: contentPad, paddingRight: contentPad, paddingTop: contentPad, paddingBottom: contentPad }}
          >
            {children}
          </div>
        </div>
      </div>
    </BevelCard>
  )
}
