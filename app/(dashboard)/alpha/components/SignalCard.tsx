'use client'

import { useState } from 'react'
import { NotchedCard } from '@/components/ui/poly/NotchedCard'
import { EyebrowTag }  from '@/components/ui/poly/EyebrowTag'
import { MonoStat }    from '@/components/ui/poly/MonoStat'
import { ExternalLink } from 'lucide-react'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'
import type { AlphaSignal, ConfidenceBreakdown } from '@/lib/alpha-tracker/types'

const PATTERN_COLORS: Record<string, string> = {
  pre_cex:          '#fee211',
  bridge_buy:       '#e271d7',
  lp_position:      '#00cc06',
  stable_rotation:  '#670de5',
  convergence:      '#ff7421',
  dca_dump:         '#e271d7',
  pre_gov:          '#ddcff2',
  net_accumulation: '#3b82f6',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

interface Props {
  signal: AlphaSignal
}

export function SignalCard({ signal }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const meta    = PATTERN_META[signal.pattern_id]
  const color   = PATTERN_COLORS[signal.pattern_id] ?? 'rgba(255,255,255,0.18)'
  const breakdown = signal.confidence_breakdown as ConfidenceBreakdown

  const strokeColor = `${color}66`   // ~40% alpha

  return (
    <div>
      <NotchedCard strokeColor={strokeColor} pad={18}>
        {/* Card header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
              style={{
                background: `${color}18`,
                color,
                fontFamily: 'var(--poly-font-mono)',
              }}
            >
              {meta?.emoji} {meta?.name ?? signal.pattern_id}
            </span>
          </div>
          <EyebrowTag className="shrink-0 ml-2">
            {relativeTime(signal.observed_at)}
          </EyebrowTag>
        </div>

        {/* Confidence bar */}
        <div
          className="flex items-center gap-2 mb-4 cursor-pointer group"
          onClick={() => setShowBreakdown(v => !v)}
        >
          <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${signal.confidence}%`, background: color }}
            />
          </div>
          <span
            className="text-[11px] text-white/50 group-hover:text-white/70 transition-colors tabular-nums"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            {signal.confidence}
          </span>
          <EyebrowTag className="group-hover:text-white/50 transition-colors">
            {showBreakdown ? '▲' : '▼'}
          </EyebrowTag>
        </div>

        {/* Confidence breakdown tooltip */}
        {showBreakdown && breakdown && (
          <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
            <EyebrowTag>Confidence Breakdown</EyebrowTag>
            <div className="mt-2 space-y-1">
              {([
                ['Entity track record', breakdown.entity_track_record, 30],
                ['Pattern strength',    breakdown.pattern_strength,    25],
                ['Token liquidity fit', breakdown.token_liquidity_fit, 15],
                ['Recency context',     breakdown.recency_context,     15],
                ['Convergence bonus',   breakdown.convergence_bonus,   15],
              ] as [string, number, number][]).map(([label, val, max]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-white/50">{label}</span>
                  <span
                    className="text-[11px] text-white/70 tabular-nums"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {val} / {max}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WHAT */}
        <div className="mb-3">
          <EyebrowTag className="mb-1.5">What</EyebrowTag>
          <p className="text-[13px] text-white/80 leading-relaxed">
            {signal.what_text}
          </p>
          {signal.amount_usd != null && (
            <div className="mt-2">
              <MonoStat
                prefix="$"
                value={(signal.amount_usd / 1000).toFixed(0)}
                suffix="K"
                size="tile"
              />
            </div>
          )}
        </div>

        {/* WHAT IT MEANS */}
        <div className="mb-4">
          <EyebrowTag className="mb-1.5">What It Means</EyebrowTag>
          <p className="text-[12px] text-white/55 leading-relaxed">
            {signal.meaning_text}
          </p>
        </div>

        {/* Divider + CTAs */}
        <div
          className="pt-3 flex items-center gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {signal.tx_hashes[0] && (
            <a
              href={`https://intel.arkm.com/explorer/entity/${signal.entity_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[var(--poly-purple)] hover:text-purple-300 transition-colors"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              View on Arkham <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {signal.tx_hashes.length > 0 && (
            <a
              href={`https://intel.arkm.com/explorer/tx/${signal.tx_hashes[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              {signal.tx_hashes.length} tx{signal.tx_hashes.length > 1 ? 's' : ''} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </NotchedCard>
    </div>
  )
}
