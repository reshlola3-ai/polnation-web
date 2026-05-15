'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { NotchedCard } from '@/components/ui/poly/NotchedCard'
import { EyebrowTag }  from '@/components/ui/poly/EyebrowTag'
import { ExternalLink, ArrowUpRight } from 'lucide-react'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'
import { buildMonitorText } from '@/lib/alpha-tracker/interpret'
import { chainLabel, usdCompact, arkhamEntityUrl, arkhamTxUrl } from '@/lib/alpha-tracker/format'
import type { AlphaSignal, ConfidenceBreakdown, PatternMatch } from '@/lib/alpha-tracker/types'

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

type T = ReturnType<typeof useTranslations<'alpha'>>

/** Pattern-specific 3rd-row stat tiles. Mostly direction + window context. */
function thirdRow(signal: AlphaSignal, t: T): { label: string; value: string; sub: string } {
  switch (signal.pattern_id) {
    case 'net_accumulation':
      return { label: t('signals.window'),  value: '24h',   sub: 'rolling' }
    case 'bridge_buy':
      return { label: t('signals.latency'), value: '<30m',  sub: 'bridge → buy' }
    case 'stable_rotation':
      return { label: t('signals.window'),  value: '6h',    sub: 'rotation' }
    case 'pre_gov':
      return { label: t('signals.window'),  value: '48h',   sub: 'accumulation' }
    case 'dca_dump':
      return { label: t('signals.window'),  value: '24h',   sub: 'price down ≥10%' }
    case 'convergence':
      return { label: t('signals.window'),  value: '24h',   sub: 'cross-entity' }
    default:
      return { label: t('signals.window'),  value: '24h',   sub: 'observation' }
  }
}

function flowLabel(patternId: string, t: T): { label: string; sub: string } {
  switch (patternId) {
    case 'net_accumulation': return { label: t('signals.netFlow'),       sub: 'inflows − outflows' }
    case 'lp_position':      return { label: t('signals.lpSize'),        sub: 'liquidity added' }
    case 'stable_rotation':  return { label: t('signals.rotationSize'),  sub: 'into token' }
    case 'bridge_buy':       return { label: t('signals.buySize'),       sub: 'post-bridge' }
    case 'dca_dump':         return { label: t('signals.dcaSize'),       sub: 'into weakness' }
    case 'pre_gov':          return { label: t('signals.accumulated'),   sub: '48h total' }
    case 'pre_cex':          return { label: t('signals.inbound'),       sub: 'pre-listing' }
    case 'convergence':      return { label: t('signals.combinedSize'),  sub: 'all entities' }
    default:                 return { label: t('signals.amount'),        sub: '' }
  }
}

interface Props {
  signal: AlphaSignal
}

export function SignalCard({ signal }: Props) {
  const t = useTranslations('alpha')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const meta      = PATTERN_META[signal.pattern_id]
  const color     = PATTERN_COLORS[signal.pattern_id] ?? 'rgba(255,255,255,0.18)'
  const breakdown = signal.confidence_breakdown as ConfidenceBreakdown
  const strokeColor = `${color}66`

  // Reconstruct a PatternMatch-ish shape so buildMonitorText can be reused
  const monitorText = buildMonitorText({
    patternId:   signal.pattern_id,
    tokenSymbol: signal.token_symbol ?? '',
    chain:       signal.chain ?? '',
    amountUsd:   signal.amount_usd ?? 0,
    entityName:  signal.entity_name,
    entityType:  '',
    pnl30d:      0,
    txHashes:    signal.tx_hashes,
    context:     {},
  } as PatternMatch)

  const flow = flowLabel(signal.pattern_id, t)
  const third = thirdRow(signal, t)
  const validHashes = signal.tx_hashes.filter(h => h && h !== 'null')

  return (
    <NotchedCard strokeColor={strokeColor} pad={16}>
      {/* Header: pattern badge + time */}
      <div className="flex items-start justify-between mb-3">
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
        <EyebrowTag className="shrink-0 ml-2">
          {relativeTime(signal.observed_at)}
        </EyebrowTag>
      </div>

      {/* Confidence bar (clickable for breakdown) */}
      <div
        className="flex items-center gap-2 mb-4 cursor-pointer group"
        onClick={() => setShowBreakdown(v => !v)}
      >
        <EyebrowTag>{t('signals.confidence')}</EyebrowTag>
        <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${signal.confidence}%`, background: color }}
          />
        </div>
        <span
          className="text-[11px] text-white/60 group-hover:text-white/80 transition-colors tabular-nums"
          style={{ fontFamily: 'var(--poly-font-mono)' }}
        >
          {signal.confidence} / 100
        </span>
        <EyebrowTag className="group-hover:text-white/50 transition-colors">
          {showBreakdown ? '▲' : '▼'}
        </EyebrowTag>
      </div>

      {/* Confidence breakdown */}
      {showBreakdown && breakdown && (
        <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
          <EyebrowTag>{t('signals.scoreBreakdown')}</EyebrowTag>
          <div className="mt-2 space-y-1">
            {([
              [t('signals.entityTrackRecord'), breakdown.entity_track_record, 30],
              [t('signals.patternStrength'),   breakdown.pattern_strength,    25],
              [t('signals.tokenLiquidityFit'), breakdown.token_liquidity_fit, 15],
              [t('signals.recencyContext'),    breakdown.recency_context,     15],
              [t('signals.convergenceBonus'),  breakdown.convergence_bonus,   15],
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

      {/* 6-tile data grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatTile label={t('signals.entity')} value={signal.entity_name}            sub={signal.entity_id ? `@${signal.entity_id}` : ''} />
        <StatTile label={t('signals.token')}  value={signal.token_symbol ?? '—'}    sub={signal.token_address ? `${signal.token_address.slice(0,6)}…${signal.token_address.slice(-4)}` : 'native'} />
        <StatTile label={t('signals.chain')}  value={chainLabel(signal.chain)}      sub={signal.chain ?? ''} />
        <StatTile
          label={flow.label}
          value={signal.amount_usd != null ? usdCompact(signal.amount_usd) : '—'}
          sub={flow.sub}
          highlight
          color={color}
        />
        <StatTile
          label={t('signals.transfers')}
          value={String(signal.tx_hashes.length)}
          sub={validHashes.length === signal.tx_hashes.length ? t('signals.allLinked') : `${validHashes.length} ${t('signals.linked')}`}
        />
        <StatTile label={third.label} value={third.value} sub={third.sub} />
      </div>

      {/* Signal reading */}
      <div className="mb-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
        <EyebrowTag className="mb-1.5">{t('signals.signalReading')}</EyebrowTag>
        <p className="text-[12px] text-white/65 leading-relaxed">
          {signal.meaning_text}
        </p>
      </div>

      {/* Monitor / action */}
      <div
        className="mb-4 p-3 rounded-lg flex items-start gap-2"
        style={{
          background: `${color}10`,
          border: `1px solid ${color}30`,
        }}
      >
        <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <p
            className="text-[9px] uppercase tracking-[0.12em] mb-1"
            style={{ fontFamily: 'var(--poly-font-mono)', color }}
          >
            {t('signals.monitor')}
          </p>
          <p className="text-[12px] text-white/70 leading-relaxed">
            {monitorText}
          </p>
        </div>
      </div>

      {/* Footer CTAs */}
      <div
        className="pt-3 flex items-center gap-3 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <a
          href={arkhamEntityUrl(signal.entity_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[var(--poly-purple)] hover:text-purple-300 transition-colors"
          style={{ fontFamily: 'var(--poly-font-mono)' }}
        >
          {signal.entity_name} {t('signals.viewOnArkham')} <ExternalLink className="w-3 h-3" />
        </a>
        {validHashes.length > 0 && (
          <a
            href={arkhamTxUrl(validHashes[0], signal.chain)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            View {validHashes.length === 1 ? 'tx' : `${validHashes.length} txs`} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </NotchedCard>
  )
}

function StatTile({
  label, value, sub, highlight, color,
}: { label: string; value: string; sub: string; highlight?: boolean; color?: string }) {
  return (
    <div
      className="rounded-lg p-2.5 min-w-0"
      style={{
        background: highlight ? `${color}10` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${highlight ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <p
        className="text-[9px] uppercase tracking-[0.12em] text-white/40 mb-1 truncate"
        style={{ fontFamily: 'var(--poly-font-mono)' }}
      >
        {label}
      </p>
      <p
        className="text-[14px] font-semibold tabular-nums tracking-tight truncate"
        style={{
          fontFamily: 'var(--poly-font-mono)',
          color: highlight ? color : 'rgba(255,255,255,0.92)',
        }}
        title={value}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-white/35 truncate mt-0.5" title={sub}>
          {sub}
        </p>
      )}
    </div>
  )
}
