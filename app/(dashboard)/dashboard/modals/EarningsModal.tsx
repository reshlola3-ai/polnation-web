'use client'
import { X } from 'lucide-react'
import type { ProfitData } from '../_constants'
import { TIER_ICONS } from '../_constants'

type Props = {
  onClose: () => void
  usdcBalance: number
  currentTierName: string
  currentTierRate: number
  dailyEarnings: number
  estDailyCommission: number
  profitData: ProfitData
}

export default function EarningsModal({
  onClose,
  usdcBalance,
  currentTierName,
  currentTierRate,
  dailyEarnings,
  estDailyCommission,
  profitData,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            📊 Earnings Calculation
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Wallet Balance</span>
              <span className="text-white font-medium">${usdcBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Current Tier</span>
              <span className="text-white font-medium">{TIER_ICONS[currentTierName]} {currentTierName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Daily Rate</span>
              <span className="text-white font-medium">{(currentTierRate * 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="border-t border-zinc-700 pt-4 space-y-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-zinc-400 text-xs mb-1">Staking Earnings</p>
              <p className="text-green-400 font-mono text-sm">
                ${usdcBalance.toFixed(2)} × {(currentTierRate * 100).toFixed(2)}% = <span className="font-bold">${dailyEarnings.toFixed(4)}</span>/day
              </p>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <p className="text-zinc-400 text-xs mb-1">Est. Team Commission</p>
              <p className="text-orange-400 font-bold text-lg">${estDailyCommission.toFixed(4)}/day</p>
              <p className="text-zinc-500 text-xs mt-1">Based on your downlines&apos; balances (L1: 10%, L2: 5%...)</p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-zinc-400 text-xs mb-1">Community Pool Revenue</p>
              {profitData.momentumMultiplier > 1.0 ? (
                <>
                  <p className="text-blue-400 font-mono text-sm">
                    ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% × <span className="text-white/75 font-bold">{profitData.momentumMultiplier.toFixed(1)}x</span> = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-white/65 font-medium">🔥 Momentum {profitData.momentumMultiplier.toFixed(1)}x</span>
                    {profitData.momentumDaysUntilDecay > 0 && (
                      <span className="text-xs text-zinc-500">⏱️ {profitData.momentumDaysUntilDecay}d until {profitData.momentumNextMultiplier.toFixed(1)}x</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-blue-400 font-mono text-sm">
                    ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">Recruit referrals to unlock up to 5x Momentum!</p>
                </>
              )}
              <p className="text-zinc-500 text-xs mt-1">From {profitData.currentLevelName} community pool</p>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-purple-300 font-medium">Est. Daily Total</span>
              <span className="text-white font-bold text-xl">${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}/day</span>
            </div>
            <p className="text-zinc-500 text-xs mt-1">
              Staking: ${dailyEarnings.toFixed(4)} + Commission: ${estDailyCommission.toFixed(4)} + Community: ${profitData.communityDailyEarnings.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
