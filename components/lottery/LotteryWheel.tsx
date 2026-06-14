'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { LuckyWheel } from '@lucky-canvas/react'
import { motion, AnimatePresence } from 'framer-motion'
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

const PRIZE_CONFIGS: Array<{ type: string; color: string; amount: number; icon?: string }> = [
  { type: 'bonus_1', color: '#7c3aed', amount: 1 },
  { type: 'usdc_005', color: '#10b981', amount: 0.05 },
  { type: 'usdc_05', color: '#059669', amount: 0.5 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'bonus_2', color: '#7c3aed', amount: 2 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'usdc_1', color: '#0891b2', amount: 1 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'bonus_3', color: '#7c3aed', amount: 3 },
  { type: 'thanks', color: '#1e1b4b', amount: 0 },
  { type: 'usdc_5', color: '#d97706', amount: 5 },
  { type: 'electronics', color: '#6b7280', amount: 0, icon: '📱' },
]

const WHEEL_FX_CSS = `
@keyframes lwSpinSlow { to { transform: rotate(360deg); } }
@keyframes lwOrbit { to { transform: rotate(360deg); } }
@keyframes lwOrbitRev { to { transform: rotate(-360deg); } }
@keyframes lwBreath { 0%,100% { transform: scale(1); opacity: .5; } 50% { transform: scale(1.06); opacity: .85; } }
@keyframes lwRay { to { transform: rotate(360deg); } }
@keyframes lwShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes lwTwinkle { 0%,100% { opacity:.25; transform: scale(.6);} 50% { opacity:1; transform: scale(1.25);} }
@keyframes lwPulseRing { 0% { transform: scale(.85); opacity:.7; } 100% { transform: scale(1.35); opacity:0; } }
`

const PALETTES: Record<string, string[]> = {
  usdc: ['#34d399', '#fbbf24', '#10b981', '#fde68a', '#a7f3d0'],
  bonus: ['#a855f7', '#c084fc', '#06b6d4', '#e9d5ff', '#67e8f9'],
  electronics: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a855f7'],
  default: ['#a855f7', '#06b6d4', '#fbbf24', '#f472b6'],
}

// 中心爆发式彩带粒子
function Confetti({ palette }: { palette: string[] }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2
        const dist = 140 + Math.random() * 260
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 40,
          rot: Math.random() * 900 - 450,
          color: palette[i % palette.length],
          size: 7 + Math.random() * 9,
          delay: Math.random() * 0.12,
          dur: 1.0 + Math.random() * 0.7,
          round: Math.random() > 0.5,
        }
      }),
    [palette],
  )
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.5, rotate: p.rot }}
          transition={{ duration: p.dur, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  )
}

// 环绕轮盘旋转的光点
function OrbitingLights({ active }: { active: boolean }) {
  const dots = Array.from({ length: 16 })
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ animation: `lwOrbit ${active ? 5 : 14}s linear infinite` }}
    >
      {dots.map((_, i) => {
        const angle = (i / dots.length) * 360
        const hue = i % 2 === 0 ? '#a855f7' : '#06b6d4'
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${angle}deg) translateY(-172px)` }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '9999px',
                background: hue,
                boxShadow: `0 0 10px 2px ${hue}`,
                animation: `lwTwinkle ${1.4 + (i % 4) * 0.25}s ease-in-out ${i * 0.08}s infinite`,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

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

  // 没有翻译时的兜底文案（如 $0.05 格子，未进 i18n 也能正确显示）
  const FALLBACK_LABELS: Record<string, string> = { usdc_005: '$0.05' }
  const wedgeLabel = (type: string) => t.prizes[type] || FALLBACK_LABELS[type] || type

  const prizes = PRIZE_CONFIGS.map((p) => ({
    fonts: p.icon
      ? [
          { text: p.icon, top: '10%', fontSize: '24px' },
          {
            text: wedgeLabel(p.type),
            top: '48%',
            fontSize: '10px',
            fontColor: '#fff',
            fontWeight: '700',
          },
        ]
      : [{
          text: wedgeLabel(p.type),
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
  const isElectronicsWin = result && result.type === 'electronics'

  const winPalette = isUsdcWin
    ? PALETTES.usdc
    : isBonusWin
    ? PALETTES.bonus
    : isElectronicsWin
    ? PALETTES.electronics
    : PALETTES.default

  return (
    <div className="flex flex-col items-center gap-6">
      <style dangerouslySetInnerHTML={{ __html: WHEEL_FX_CSS }} />

      {/* 中奖彩带爆发 */}
      <AnimatePresence>
        {showResult && isWin && <Confetti palette={winPalette} />}
      </AnimatePresence>

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

      {/* Wheel stage */}
      <div className="relative" style={{ width: 320, height: 320 }}>
        {/* 旋转能量光环 */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full blur-2xl pointer-events-none"
          style={{
            width: 384,
            height: 384,
            transform: 'translate(-50%,-50%)',
            background:
              'conic-gradient(from 0deg, #a855f7, #06b6d4, #d97706, #f472b6, #a855f7)',
            opacity: isSpinning ? 0.85 : 0.4,
            animation: `lwSpinSlow ${isSpinning ? 2.2 : 9}s linear infinite`,
            transition: 'opacity .4s ease',
          }}
        />
        {/* 呼吸光晕 */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
          style={{
            width: 360,
            height: 360,
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, rgba(168,85,247,.45), transparent 65%)',
            animation: `lwBreath ${isSpinning ? 1.1 : 3.2}s ease-in-out infinite`,
          }}
        />
        {/* 霓虹外环 */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
          style={{
            width: 344,
            height: 344,
            transform: 'translate(-50%,-50%)',
            border: '2px solid rgba(168,85,247,.5)',
            boxShadow: isSpinning
              ? '0 0 44px 6px rgba(6,182,212,.6), inset 0 0 32px rgba(168,85,247,.45)'
              : '0 0 22px 2px rgba(168,85,247,.35), inset 0 0 18px rgba(6,182,212,.2)',
            transition: 'box-shadow .4s ease',
          }}
        />
        {/* 环绕光点 */}
        <OrbitingLights active={isSpinning} />

        {/* 轮盘本体 */}
        <div className="relative z-10">
          <LuckyWheel
            ref={wheelRef}
            width="320px"
            height="320px"
            blocks={blocks}
            prizes={prizes}
            buttons={buttons}
            defaultConfig={{
              speed: 22,
              accelerationTime: 2600,
              decelerationTime: 5200,
            }}
            onStart={handleStart}
            onEnd={handleEnd}
          />
        </div>

        {/* Disabled overlay */}
        {!canSpin && !isSpinning && (
          <div className="absolute inset-0 z-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center px-6">
              <p className="text-white font-semibold text-lg">{t.noSpins}</p>
              <p className="text-zinc-400 text-xs mt-1">{t.noSpinsDesc}</p>
            </div>
          </div>
        )}
      </div>

      {/* Spin button (mobile friendly) */}
      {canSpin && !isSpinning && (
        <motion.button
          onClick={handleStart}
          disabled={loading}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative overflow-hidden px-10 py-3.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/40 text-lg"
        >
          {/* 流光扫过 */}
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(110deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'lwShimmer 2.4s linear infinite',
            }}
          />
          {/* 脉冲环 */}
          <span
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ border: '2px solid rgba(255,255,255,.5)', animation: 'lwPulseRing 1.8s ease-out infinite' }}
          />
          <span className="relative z-10 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {loading ? t.spinning : t.spinNow}
          </span>
        </motion.button>
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
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResult(false)}
          >
            <motion.div
              className="relative bg-[#1a1735] border border-purple-500/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl overflow-hidden"
              initial={{ scale: 0.6, y: 40, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.7, y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {isWin ? (
                <>
                  {/* 背景旋转光线 */}
                  <div
                    className="absolute left-1/2 -top-10 pointer-events-none opacity-40"
                    style={{
                      width: 320,
                      height: 320,
                      transform: 'translateX(-50%)',
                      background:
                        'repeating-conic-gradient(from 0deg, rgba(168,85,247,.5) 0deg 10deg, transparent 10deg 20deg)',
                      animation: 'lwRay 9s linear infinite',
                      maskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
                      WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
                    }}
                  />
                  {/* 奖杯图标 + 光晕脉冲 */}
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `radial-gradient(circle, ${winPalette[0]}66, transparent 70%)`,
                        animation: 'lwBreath 1.6s ease-in-out infinite',
                      }}
                    />
                    <motion.div
                      className="relative w-24 h-24 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                        boxShadow: '0 0 30px rgba(168,85,247,.6)',
                      }}
                      animate={{ scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Gift className="w-12 h-12 text-white drop-shadow" />
                    </motion.div>
                  </div>

                  <motion.h3
                    className="relative text-2xl font-bold text-white mb-2"
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                  >
                    {t.congratulations}
                  </motion.h3>
                  <p className="relative text-lg text-purple-300 mb-1">{t.youWon}</p>
                  {/* 奖品文字流光 */}
                  <p
                    className="relative text-3xl font-extrabold mb-3 bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        'linear-gradient(110deg, #c084fc, #67e8f9, #fde68a, #c084fc)',
                      backgroundSize: '200% auto',
                      animation: 'lwShimmer 2.6s linear infinite',
                    }}
                  >
                    {t.prizes[result.type] || result.label}
                  </p>
                  <p className="relative text-xs text-zinc-400 mb-6">
                    {isUsdcWin
                      ? t.usdcNote || '💰 USDC has been added to your withdrawable balance'
                      : isBonusWin
                      ? t.bonusNote || '⭐ Bonus has been added to your unlock progress'
                      : isElectronicsWin
                      ? '🎁 Contact admin on Telegram to claim your prize'
                      : ''}
                  </p>
                </>
              ) : (
                <>
                  <motion.div
                    className="w-20 h-20 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center text-4xl"
                    animate={{ rotate: [0, -8, 8, -4, 0] }}
                    transition={{ duration: 0.8 }}
                  >
                    😊
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">{t.prizes.thanks}</h3>
                  <p className="text-zinc-400 mb-6">{t.tryAgain}</p>
                </>
              )}
              <button
                onClick={() => setShowResult(false)}
                className="relative w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                {t.close}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      <span className={`text-sm font-bold ${record.prize_type === 'thanks' ? 'text-zinc-500' : record.prize_type === 'electronics' ? 'text-zinc-300' : record.prize_type.startsWith('usdc_') ? 'text-green-400' : 'text-purple-400'}`}>
                        {record.prize_type === 'electronics' ? '🎁' : record.prize_amount > 0 ? `+$${record.prize_amount}` : '-'}
                      </span>
                      {record.prize_type !== 'thanks' && (
                        <p className="text-[10px] text-zinc-600">
                          {record.prize_type === 'electronics' ? 'Contact Admin' : record.prize_type.startsWith('usdc_') ? 'Withdrawable' : 'Unlock Progress'}
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
