'use client'
import { X } from 'lucide-react'
import { TIERS, TIER_ICONS, type Tier } from '../_constants'

type Props = {
  onClose: () => void
  currentTier: Tier
}

export default function TierModal({ onClose, currentTier }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            🏛️ Personal Tier Levels
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-2">
          {TIERS.map((tier, index) => {
            const isCurrentTier = currentTier.name === tier.name
            const isPastTier = currentTier.index > index

            return (
              <div
                key={tier.name}
                className={`rounded-xl p-4 border transition-all ${
                  isCurrentTier
                    ? 'bg-purple-500/20 border-purple-500/50'
                    : isPastTier
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-zinc-800/50 border-zinc-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TIER_ICONS[tier.name] || '⭐'}</span>
                    <div>
                      <p className="font-semibold text-white">{tier.name}</p>
                      <p className="text-xs text-zinc-400">
                        ${tier.min.toLocaleString()} - {tier.max === Infinity ? '∞' : '$' + tier.max.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white/65">{(tier.rate * 100).toFixed(2)}%</p>
                    <p className="text-xs text-zinc-500">daily</p>
                  </div>
                </div>
                {isCurrentTier && (
                  <div className="mt-2 pt-2 border-t border-purple-500/30">
                    <p className="text-xs text-purple-300">✨ You are here</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
