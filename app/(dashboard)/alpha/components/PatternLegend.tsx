'use client'

import { BevelCard }  from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'
import type { PatternId } from '@/lib/alpha-tracker/types'

const PATTERN_COLORS: Record<string, string> = {
  pre_cex:         '#fee211',
  bridge_buy:      '#e271d7',
  lp_position:     '#00cc06',
  stable_rotation: '#670de5',
  convergence:     '#ff7421',
  dca_dump:        '#e271d7',
  pre_gov:         '#ddcff2',
}

interface Props {
  counts: Record<string, number>
  active: string | null
  onFilter: (id: string | null) => void
}

export function PatternLegend({ counts, active, onFilter }: Props) {
  return (
    <BevelCard size="lg" pad={16}>
      <EyebrowTag className="mb-3">Pattern Legend</EyebrowTag>
      <div className="space-y-1">
        {(Object.entries(PATTERN_META) as [PatternId, typeof PATTERN_META[PatternId]][]).map(
          ([id, meta]) => {
            const count = counts[id] ?? 0
            const isActive = active === id
            const color = PATTERN_COLORS[id]
            return (
              <button
                key={id}
                onClick={() => onFilter(isActive ? null : id)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/[0.04]"
                style={isActive ? { background: `${color}12` } : {}}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-[11px] text-white/60 text-left">
                    {meta.emoji} {meta.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {id === 'convergence' && count > 0 && (
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: '#ff7421' }}
                    />
                  )}
                  <span
                    className="text-[11px] tabular-nums"
                    style={{
                      color: count > 0 ? color : 'var(--poly-grey-200)',
                      fontFamily: 'var(--poly-font-mono)',
                    }}
                  >
                    {count}
                  </span>
                </div>
              </button>
            )
          }
        )}
      </div>
      {active && (
        <button
          onClick={() => onFilter(null)}
          className="mt-2 w-full text-[10px] text-white/30 hover:text-white/50 transition-colors text-center"
          style={{ fontFamily: 'var(--poly-font-mono)' }}
        >
          Clear filter
        </button>
      )}
    </BevelCard>
  )
}
