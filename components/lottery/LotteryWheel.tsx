'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { LuckyWheel } from '@lucky-canvas/react'
import { Gift, History, Sparkles, X, RefreshCw } from 'lucide-react'

interface LotteryTranslations {
  title: string
  subtitle: string
  spin: string
  spinning: string
  congratulations: string
  youWon: string
  tryAgain: string
  noSpins: string
  noSpinsDesc: string
  loginRequired: string
  history: string
  noHistory: string
  prizes: Record<string, string>
  todaySpins: string
  available: string
  used: string
  close: string
  spinNow: string
  remainingSpins?: string
  unlimitedSpins?: string
  bonusNote?: string
  usdcNote?: string
  checkSpins?: string
}

interface SpinRecord {
  id: string
  prize_type: string
  prize_label: string
  prize_amount: number
  reward_credited?: boolean
  created_at: string
}

interface LotteryWheelProps {
  t: LotteryTranslations
}

const PRIZE_CONFIGS = [
  { type: 'bonus_1', color: '#7c3aed', amount: 1 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'usdc_05', color: '#059669', amount: 0.5 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'bonus_2', color: '#7c3aed', amount: 2 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'usdc_1', color: '#0891b2', amount: 1 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'bonus_3', color: '#7c3aed', amount: 3 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'usdc_5', color: '#d97706', amount: 5 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
]

export function LotteryWheel({ t }: LotteryWheelProps) {
  const wheelRef = useRef<any>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [canSpin, setCanSpin] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState<{ type: string; label: string; amount: number } | null>(null)
  const [history, setHistory] = useState<SpinRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)
  const [remainingSpins, setRemainingSpins] = useState(0)
  const [isInfluencer, setIsInfluencer] = useState(false)
  const [checking, setChecking] = useState(false)

  // Check lottery status on mount
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/lottery')
      if (res.ok) {
        const data = await res.json()
        setCanSpin(data.canSpin)
        setRemainingSpins(data.remainingSpins)
        setIsInfluencer(data.isInfluencer || false)
        setHistory(data.history || [])
      }
    } catch {
      // silent
    }
  }, [])

  // Check & grant new spins
  const checkAndGrantSpins = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/lottery/check-spins', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCanSpin(data.canSpin)
        setRemainingSpins(data.remainingSpins)
        setIsInfluencer(data.isInfluencer || false)
      }
    } catch {
      // silent
    }
    setChecking(false)
  }, [])

  // Load status on mount
  useEffect(() => {
    checkStatus()
    // Also check for new spin grants
    checkAndGrantSpins()
  }, [checkStatus, checkAndGrantSpins])

  const prizes = PRIZE_CONFIGS.map((p) => ({
    fonts: [{ 
      text: t.prizes[p.type] || p.type, 
      top: '12%',
      fontSize: '12px',
      fontColor: '#fff',
      fontWeight: '600',
    }],
    background: p.color,
    range: undefined,
  }))

  const blocks = [
    { padding: '12px', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' },
    { padding: '6px', background: '#1e1b4b' },
  ]

  const buttons = [
    { 
      radius: '35%', 
      background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
      pointer: true,
      fonts: [{ 
        text: isSpinning ? '...' : '🎯', 
        top: '-12px',
        fontSize: '24px',
      }],
    },
    {
      radius: '30%',
      background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
      fonts: [{ 
        text: isSpinning ? t.spinning : t.spin, 
        top: '-8px',
        fontSize: '13px',
        fontColor: '#fff',
        fontWeight: '700',
      }],
    },
  ]

  const handleStart = async () => {
    if (isSpinning || !canSpin) return

    setIsSpinning(true)
    setLoading(true)

    try {
      const res = await fetch('/api/lottery/spin', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setIsSpinning(false)
        setLoading(false)
        if (data.error === 'no_spins') {
          setCanSpin(false)
          setRemainingSpins(0)
        }
        return
      }

      // Find the prize index
      const prizeIndex = PRIZE_CONFIGS.findIndex(p => p.type === data.prize_type)
      setResult({ type: data.prize_type, label: data.prize_label, amount: data.prize_amount })
      setLoading(false)

      // Start spinning to the correct prize
      wheelRef.current?.play()
      setTimeout(() => {
        wheelRef.current?.stop(prizeIndex >= 0 ? prizeIndex : 1)
      }, 300)

    } catch {
      setIsSpinning(false)
      setLoading(false)
    }
  }

  const handleEnd = () => {
    setIsSpinning(false)
    setShowResult(true)
    // Update remaining spins（所有人都扣次数）
    setRemainingSpins(prev => Math.max(0, prev - 1))
    if (remainingSpins <= 1) {
      setCanSpin(false)
    }
    // Refresh history
    checkStatus()
  }

  const isWin = result && result.type !== 'thanks'
  const isUsdcWin = result && result.type.startsWith('usdc_')
  const isBonusWin = result && result.type.startsWith('bonus_')

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Title */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">
            {`${t.remainingSpins || 'Spins'}: ${remainingSpins}`}
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t.title}</h2>
        <p className="text-zinc-400 text-sm max-w-md">{t.subtitle}</p>
      </div>

      {/* Wheel */}
      <div className="relative">
        {/* Outer glow */}
        <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-xl" />
        
        {/* Decorative dots around wheel */}
        <div className="relative">
          <LuckyWheel
            ref={wheelRef}
            width="320px"
            height="320px"
            blocks={blocks}
            prizes={prizes}
            buttons={buttons}
            defaultConfig={{
              speed: 20,
              accelerationTime: 2500,
              decelerationTime: 4500,
            }}
            onStart={handleStart}
            onEnd={handleEnd}
          />
        </div>

        {/* Disabled overlay */}
        {!canSpin && !isSpinning && (
          <div className="absolute inset-0 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center px-6">
              <p className="text-white font-semibold text-lg">{t.noSpins}</p>
              <p className="text-zinc-400 text-xs mt-1">{t.noSpinsDesc}</p>
            </div>
          </div>
        )}
      </div>

      {/* Spin button (mobile friendly) */}
      {canSpin && !isSpinning && (
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-8 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-purple-500/25 text-lg"
        >
          {loading ? t.spinning : t.spinNow}
        </button>
      )}

      {/* Refresh spins button */}
      <button
        onClick={checkAndGrantSpins}
        disabled={checking}
        className="flex items-center gap-2 text-zinc-500 hover:text-purple-400 transition-colors text-xs"
      >
        <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
        {t.checkSpins || 'Check for new spins'}
      </button>

      {/* History button */}
      <button
        onClick={() => { setShowHistory(true); checkStatus() }}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
      >
        <History className="w-4 h-4" />
        {t.history}
      </button>

      {/* Result Modal */}
      {showResult && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowResult(false)}>
          <div className="bg-[#1a1735] border border-purple-500/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {isWin ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <Gift className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t.congratulations}</h3>
                <p className="text-lg text-purple-300 mb-1">{t.youWon}</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-3">
                  {t.prizes[result.type] || result.label}
                </p>
                {/* 奖励去向说明 */}
                <p className="text-xs text-zinc-400 mb-6">
                  {isUsdcWin 
                    ? (t.usdcNote || '💰 USDC has been added to your withdrawable balance')
                    : isBonusWin 
                    ? (t.bonusNote || '⭐ Bonus has been added to your unlock progress')
                    : ''
                  }
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center text-4xl">
                  😊
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{t.prizes.thanks}</h3>
                <p className="text-zinc-400 mb-6">{t.tryAgain}</p>
              </>
            )}
            <button
              onClick={() => setShowResult(false)}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-[#1a1735] border border-purple-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                {t.history}
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">{t.noHistory}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {t.prizes[record.prize_type] || record.prize_label}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {new Date(record.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${record.prize_type === 'thanks' ? 'text-zinc-500' : record.prize_type.startsWith('usdc_') ? 'text-green-400' : 'text-purple-400'}`}>
                        {record.prize_amount > 0 ? `+$${record.prize_amount}` : '-'}
                      </span>
                      {record.prize_type !== 'thanks' && (
                        <p className="text-[10px] text-zinc-600">
                          {record.prize_type.startsWith('usdc_') ? 'Withdrawable' : 'Unlock Progress'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
