'use client'

import { useState } from 'react'
import { BevelCard }  from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function MethodologyPanel() {
  const [open, setOpen] = useState(false)

  return (
    <BevelCard size="lg" pad={18}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between"
      >
        <EyebrowTag>Methodology</EyebrowTag>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 text-[12px] text-white/55 leading-relaxed">
          <section>
            <p className="text-white/75 font-medium mb-1">Data Source</p>
            <p>All on-chain activity is sourced from Arkham Intelligence's licensed API. Wallet labels and entity attributions reflect Arkham's current classifications across 15 blockchains.</p>
          </section>
          <section>
            <p className="text-white/75 font-medium mb-1">Signal Detection</p>
            <p>Seven pattern detectors evaluate every transfer from monitored wallets. A pattern triggers a signal only when all rule conditions are met simultaneously — minimum thresholds on amount, entity type, and token context.</p>
          </section>
          <section>
            <p className="text-white/75 font-medium mb-1">Confidence Scoring</p>
            <p>Scores 0–100 are computed in real time from five components: entity track record (0–30), pattern strength (0–25), token liquidity fit (0–15), recency context (0–15), and convergence bonus (0–15). Click any confidence bar to see the breakdown.</p>
          </section>
          <section>
            <p className="text-white/75 font-medium mb-1">Refresh Cadence</p>
            <p>Signals are refreshed every 5 minutes. New signals are pushed live to this page via WebSocket — no manual refresh required. Signals expire after 24 hours.</p>
          </section>
          <section className="pt-2 border-t border-white/[0.06]">
            <p className="text-white/40">
              ⚠️ All content is observational analysis of public on-chain activity. Nothing on this page constitutes financial advice, investment recommendation, or solicitation. Past entity activity does not predict future returns.
            </p>
          </section>
        </div>
      )}
    </BevelCard>
  )
}
