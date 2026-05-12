import { BevelCard } from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat }   from '@/components/ui/poly/MonoStat'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'
import type { AlphaSignal } from '@/lib/alpha-tracker/types'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

interface Props {
  walletCount: number
  todaySignals: number
  activeEntities: number
  lastSignal: AlphaSignal | null
}

export function StatsBar({ walletCount, todaySignals, activeEntities, lastSignal }: Props) {
  return (
    <BevelCard size="lg" pad={20}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat value={String(walletCount)}  label="Wallets tracked" />
        <Stat value={String(todaySignals)} label="Signals today" />
        <Stat value={String(activeEntities)} label="Entities active" />
        <div className="flex flex-col gap-1">
          <MonoStat
            value={lastSignal ? relativeTime(lastSignal.observed_at) : '—'}
            size="tile"
          />
          <EyebrowTag>Last signal</EyebrowTag>
          {lastSignal && (
            <span className="text-[10px] text-white/40 mt-0.5"
                  style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {PATTERN_META[lastSignal.pattern_id]?.emoji}{' '}
              {PATTERN_META[lastSignal.pattern_id]?.name}
            </span>
          )}
        </div>
      </div>
    </BevelCard>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <MonoStat value={value} size="tile" />
      <EyebrowTag>{label}</EyebrowTag>
    </div>
  )
}
