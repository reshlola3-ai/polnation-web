'use client'

import { useState, lazy, Suspense } from 'react'
import { BevelCard } from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat }   from '@/components/ui/poly/MonoStat'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'
import type { AlphaSignal } from '@/lib/alpha-tracker/types'

const TrackedWalletsModal = lazy(() =>
  import('./TrackedWalletsModal').then(m => ({ default: m.TrackedWalletsModal }))
)

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
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <BevelCard size="lg" pad={20}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Wallets tracked — clickable */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setModalOpen(true)}
              className="group flex items-baseline gap-1 w-fit"
            >
              <MonoStat value={String(walletCount)} size="tile" />
              <span className="text-[10px] text-purple-400/60 group-hover:text-purple-400 transition-colors font-mono">↗</span>
            </button>
            <EyebrowTag>Wallets tracked</EyebrowTag>
          </div>

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

      {modalOpen && (
        <Suspense fallback={null}>
          <TrackedWalletsModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </Suspense>
      )}
    </>
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
