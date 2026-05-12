import { BevelCard }  from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat }   from '@/components/ui/poly/MonoStat'
import { ExternalLink } from 'lucide-react'
import type { AlphaSignal } from '@/lib/alpha-tracker/types'

export function ConvergenceAlert({ signal }: { signal: AlphaSignal }) {
  const entities = (signal.confidence_breakdown as { entities?: string[] } | null)
    ?.entities ?? signal.entity_name.split(' + ')

  return (
    <BevelCard
      size="lg"
      pad={20}
      strokeColor="rgba(255,116,33,0.5)"
      bg="rgba(255,116,33,0.05)"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <EyebrowTag style={{ color: 'var(--poly-orange)' }}>
          ⚡ Convergence Detected
        </EyebrowTag>
        <div className="flex items-center gap-1.5">
          <EyebrowTag>Confidence</EyebrowTag>
          <MonoStat value={String(signal.confidence)} size="tile" />
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-white/80 mb-3 leading-relaxed">
        {signal.what_text}
      </p>

      {/* Entity list */}
      <div className="space-y-1 mb-3">
        {entities.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[var(--poly-orange)] opacity-60" />
            <span className="text-[12px] text-white/60"
                  style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {e}
            </span>
          </div>
        ))}
      </div>

      {/* Interpretation */}
      <p className="text-[12px] text-white/50 leading-relaxed mb-3">
        {signal.meaning_text}
      </p>

      {/* CTA */}
      {signal.tx_hashes[0] && (
        <a
          href={`https://intel.arkm.com/explorer/tx/${signal.tx_hashes[0]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-[var(--poly-orange)] hover:text-orange-300 transition-colors"
          style={{ fontFamily: 'var(--poly-font-mono)' }}
        >
          View on Arkham <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </BevelCard>
  )
}
