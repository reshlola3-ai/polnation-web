'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { AlphaSignal, AlphaWallet } from '@/lib/alpha-tracker/types'
import { LiveTicker }         from './components/LiveTicker'
import { StatsBar }           from './components/StatsBar'
import { ConvergenceAlert }   from './components/ConvergenceAlert'
import { SignalFeed }         from './components/SignalFeed'
import { PatternLegend }      from './components/PatternLegend'
import { TopWalletsTable }    from './components/TopWalletsTable'
import { MethodologyPanel }   from './components/MethodologyPanel'

interface Props {
  initialSignals: AlphaSignal[]
  wallets: AlphaWallet[]
}

export function AlphaClient({ initialSignals, wallets }: Props) {
  const [signals, setSignals] = useState<AlphaSignal[]>(initialSignals)
  const [filterPattern, setFilterPattern] = useState<string | null>(null)
  const newIds = useRef<Set<string>>(new Set())

  // Supabase Realtime — push new signals without full reload
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('alpha_signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alpha_signals' },
        (payload) => {
          const sig = payload.new as AlphaSignal
          newIds.current.add(sig.id)
          setSignals(prev => [sig, ...prev].slice(0, 100))
          setTimeout(() => newIds.current.delete(sig.id), 60_000)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todaySignals = signals.filter(s => new Date(s.observed_at) >= today)
  const activeEntities = new Set(todaySignals.map(s => s.entity_name)).size
  const lastSignal = signals[0] ?? null

  const convergence = signals.find(s => s.pattern_id === 'convergence'
    && new Date(s.observed_at).getTime() > Date.now() - 4 * 60 * 60 * 1000)

  const filtered = filterPattern
    ? signals.filter(s => s.pattern_id === filterPattern)
    : signals

  const patternCounts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.pattern_id] = (acc[s.pattern_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <LiveTicker signals={signals.slice(0, 12)} />

      {/* Header */}
      <div className="px-1 pt-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/40"
           style={{ fontFamily: 'var(--poly-font-mono)' }}>
          Powered by Arkham Intelligence
        </p>
        <h1 className="text-2xl font-semibold text-white tracking-tight mt-0.5">
          Alpha Lead Tracker
        </h1>
        <p className="text-sm text-white/50 mt-1">Smart-money signal engine</p>
      </div>

      <StatsBar
        walletCount={wallets.length}
        todaySignals={todaySignals.length}
        activeEntities={activeEntities}
        lastSignal={lastSignal}
      />

      {convergence && <ConvergenceAlert signal={convergence} />}

      {/* Two-column layout on desktop */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          <SignalFeed signals={filtered} newIds={newIds.current} />
        </div>

        {/* Sidebar */}
        <div className="lg:w-64 shrink-0 space-y-3">
          <PatternLegend
            counts={patternCounts}
            active={filterPattern}
            onFilter={setFilterPattern}
          />
          <TopWalletsTable wallets={wallets} />
        </div>
      </div>

      <MethodologyPanel />
    </div>
  )
}
