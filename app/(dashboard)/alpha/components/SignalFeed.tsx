'use client'

import { SignalCard } from './SignalCard'
import type { AlphaSignal } from '@/lib/alpha-tracker/types'

interface Props {
  signals: AlphaSignal[]
}

export function SignalFeed({ signals }: Props) {
  if (!signals.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-white/30 text-sm"
           style={{ fontFamily: 'var(--poly-font-mono)' }}>
          No signals yet — engine is monitoring…
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {signals.map(signal => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  )
}
