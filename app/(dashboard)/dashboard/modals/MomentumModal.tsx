'use client'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ProfitData } from '../_constants'

type Props = {
  onClose: () => void
  profitData: ProfitData
}

export default function MomentumModal({ onClose, profitData }: Props) {
  const tTeam = useTranslations('team')

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            🔥 {tTeam('momentumTitle')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Current multiplier */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60 font-medium">Current Multiplier</span>
            <span className="text-3xl font-bold text-white/85">{profitData.momentumMultiplier.toFixed(1)}x</span>
          </div>
          {profitData.momentumMultiplier > 0.2 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-400">
                {tTeam('momentumActive', { multiplier: profitData.momentumMultiplier.toFixed(1) })}
              </p>
              {profitData.momentumDaysUntilDecay > 0 && (
                <p className="text-xs text-zinc-500">
                  ⏱️ {tTeam('momentumDecayCountdown', { days: profitData.momentumDaysUntilDecay, next: profitData.momentumNextMultiplier.toFixed(1) })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">{tTeam('momentumInactive')}</p>
          )}
        </div>

        {/* Decay steps */}
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 leading-relaxed mb-3">
            {tTeam('momentumDecayExplain')}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: '0–2d: 1.0×', active: profitData.momentumMultiplier >= 1.0 },
              { label: '3–5d: 0.8×', active: profitData.momentumMultiplier >= 0.8 && profitData.momentumMultiplier < 1.0 },
              { label: '6–8d: 0.6×', active: profitData.momentumMultiplier >= 0.6 && profitData.momentumMultiplier < 0.8 },
              { label: '9–11d: 0.4×', active: profitData.momentumMultiplier >= 0.4 && profitData.momentumMultiplier < 0.6 },
              { label: '12+d: 0.2×', active: profitData.momentumMultiplier < 0.4 },
            ].map(({ label, active }) => (
              <span key={label} className={`text-xs px-2 py-1 rounded-lg font-medium ${active ? 'bg-white/[0.08] text-white/70 border border-white/[0.12]' : 'bg-white/[0.04] text-white/30'}`}>
                {label}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-600">{tTeam('momentumDecayRate')}</p>
        </div>
      </div>
    </div>
  )
}
