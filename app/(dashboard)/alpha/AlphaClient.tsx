'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { AlphaSignal, AlphaEntity } from '@/lib/alpha-tracker/types'
import { StatsBar } from './components/StatsBar'
import { ConvergenceAlert } from './components/ConvergenceAlert'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'
import {
  Lock, Zap, ArrowUpRight, Loader2,
  Shield, TrendingUp, ChevronDown, ChevronUp,
  Crosshair, AlertTriangle, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ── Constants ──────────────────────────────────────────────────────────────
const TIERS = [
  { days: 15,  dailyRate: 1.0 },
  { days: 30,  dailyRate: 1.1 },
  { days: 60,  dailyRate: 1.2 },
  { days: 150, dailyRate: 1.3 },
  { days: 300, dailyRate: 1.5 },
] as const

// User-facing stake UI stays closed; whitelist stakes on-chain via Polygonscan.
const AT_CAPACITY = true

const MOCK_POSITIONS: { id: string; tierIndex: number; principal: number; earned: number; daysElapsed: number; totalDays: number }[] = []

const MOCK_USDC_BALANCE = 0
const MOCK_TOTAL_STAKED = 0
const MOCK_TOTAL_EARNED = 0
const MOCK_TOTAL_ASSETS = 0

const PATTERN_COLORS: Record<string, string> = {
  pre_cex:          '#fee211',
  bridge_buy:       '#e271d7',
  lp_position:      '#00cc06',
  stable_rotation:  '#670de5',
  convergence:      '#ff7421',
  dca_dump:         '#e271d7',
  pre_gov:          '#ddcff2',
  net_accumulation: '#3b82f6',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(seconds: number) {
  const [secs, setSecs] = useState(seconds)
  useEffect(() => {
    const timer = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ── Position card ──────────────────────────────────────────────────────────
type MockPosition = { id: string; tierIndex: number; principal: number; earned: number; daysElapsed: number; totalDays: number }

function PositionCard({ pos }: { pos: MockPosition }) {
  const t = useTranslations('alpha')
  const [claiming, setClaiming]                     = useState(false)
  const [unstaking, setUnstaking]                   = useState(false)
  const [showUnstakeWarning, setShowUnstakeWarning] = useState(false)
  const [unstakeAcknowledged, setUnstakeAcknowledged] = useState(false)

  const tier      = TIERS[pos.tierIndex]
  const daysLeft  = pos.totalDays - pos.daysElapsed
  const progress  = pos.daysElapsed / pos.totalDays
  const penalty   = pos.principal * 0.15
  const countdown = useCountdown(daysLeft * 86400 - 3600)

  const handleClaim = useCallback(async () => {
    setClaiming(true)
    await new Promise(r => setTimeout(r, 1200))
    setClaiming(false)
  }, [])

  const handleUnstake = useCallback(async () => {
    if (!showUnstakeWarning) {
      setShowUnstakeWarning(true)
      setUnstakeAcknowledged(false)
      return
    }
    if (!unstakeAcknowledged) return
    setUnstaking(true)
    await new Promise(r => setTimeout(r, 1800))
    setUnstaking(false)
    setShowUnstakeWarning(false)
    setUnstakeAcknowledged(false)
  }, [showUnstakeWarning, unstakeAcknowledged])

  return (
    <div className="glass-card-solid p-5 border border-white/[0.06]">
      <div className="flex items-start justify-between mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/20">
          {tier.days}d · {tier.dailyRate}%/day
        </span>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('positions.claimable')}</p>
          <p className="stat-number text-xl font-black text-cyan-400">${pos.earned.toFixed(4)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: t('positions.principal'), value: `$${pos.principal.toLocaleString()}` },
          { label: t('positions.daysLeft'),  value: `${daysLeft}d` },
          { label: t('positions.nextReward'), value: countdown },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">{label}</p>
            <p className="stat-number text-xs font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span>{t('positions.day')} {pos.daysElapsed}</span>
          <span>{t('positions.day')} {pos.totalDays}</span>
        </div>
        <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-1000"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {showUnstakeWarning && (
        <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-red-200 mb-1">
                {t('positions.earlyUnstakeReviewTitle')}
              </p>
              <p className="text-[11px] text-red-300 leading-relaxed">
                {t('positions.penaltyWarning', {
                  penalty: `$${penalty.toFixed(2)}`,
                  amount:  `$${(pos.principal - penalty).toFixed(2)}`,
                })}
              </p>
              <p className="mt-1 text-[10px] text-red-300/80 leading-relaxed">
                {t('positions.earlyUnstakeReviewBody')}
              </p>
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-red-400/15 bg-black/10 p-2 text-[10px] leading-relaxed text-red-100/90">
            <input
              type="checkbox"
              checked={unstakeAcknowledged}
              onChange={(e) => setUnstakeAcknowledged(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-red-300/40 bg-transparent text-red-400 focus:ring-red-400/40"
            />
            <span>{t('positions.earlyUnstakeAcknowledge')}</span>
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="withdraw-pulse flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-cyan-300 flex items-center justify-center gap-1.5 transition-all hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.08) 100%)',
            border: '1px solid rgba(6,182,212,0.3)',
          }}
        >
          {claiming
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('positions.claiming')}</>
            : <><ArrowUpRight className="h-3.5 w-3.5" /> {t('positions.claimBtn')}</>}
        </button>
        <button
          onClick={handleUnstake}
          disabled={unstaking || (showUnstakeWarning && !unstakeAcknowledged)}
          className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            showUnstakeWarning
              ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30'
              : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15]'
          }`}
        >
          {unstaking
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('positions.unstaking')}</>
            : showUnstakeWarning
              ? <><AlertTriangle className="h-3.5 w-3.5" /> {t('positions.confirmEarlyUnstakeWithPenalty')}</>
              : <><Lock className="h-3.5 w-3.5" /> {t('positions.unstakeEarly')}</>}
        </button>
      </div>
    </div>
  )
}

// ── Acted signal row ───────────────────────────────────────────────────────
function ActedSignalRow({ signal }: { signal: AlphaSignal }) {
  const t = useTranslations('alpha')
  const [expanded, setExpanded] = useState(false)
  const meta  = PATTERN_META[signal.pattern_id]
  const color = PATTERN_COLORS[signal.pattern_id] ?? 'rgba(255,255,255,0.18)'

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        <span
          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
          style={{ background: `${color}18`, color, fontFamily: 'var(--poly-font-mono)' }}
        >
          {meta?.emoji} {meta?.name ?? signal.pattern_id}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">{signal.entity_name}</p>
          <p className="text-[11px] text-zinc-600">{relativeTime(signal.observed_at)}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          {t('signals.acted')}
        </span>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-zinc-600 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] uppercase tracking-wider text-white/40 shrink-0"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              {t('signals.confidence')}
            </span>
            <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${signal.confidence}%`, background: color }} />
            </div>
            <span className="text-[11px] text-white/60 tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {signal.confidence} / 100
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('signals.entity'), value: signal.entity_name,         sub: signal.entity_id ? `@${signal.entity_id}` : '' },
              { label: t('signals.token'),  value: signal.token_symbol ?? '—', sub: signal.chain ?? '' },
              { label: t('signals.chain'),  value: signal.chain ?? '—',        sub: '' },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-lg p-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p
                  className="text-[9px] uppercase tracking-[0.12em] text-white/40 mb-1 truncate"
                  style={{ fontFamily: 'var(--poly-font-mono)' }}
                >
                  {label}
                </p>
                <p className="text-[13px] font-semibold text-white/90 truncate" style={{ fontFamily: 'var(--poly-font-mono)' }}>
                  {value}
                </p>
                {sub && <p className="text-[10px] text-white/35 truncate mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          <div className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[9px] uppercase tracking-wider text-white/40 mb-1.5" style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {t('signals.signalReading')}
            </p>
            <p className="text-[12px] text-white/65 leading-relaxed">{signal.meaning_text}</p>
          </div>

          <div className="rounded-lg p-3" style={{ background: `${color}08`, border: `1px solid ${color}25` }}>
            <p className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color, fontFamily: 'var(--poly-font-mono)' }}>
              {t('signals.whatHappened')}
            </p>
            <p className="text-[12px] text-white/60 leading-relaxed">{signal.what_text}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
interface Props {
  initialSignals: AlphaSignal[]
  entities: AlphaEntity[]
}

export function AlphaClient({ initialSignals, entities }: Props) {
  const t = useTranslations('alpha')
  const [selectedTier, setSelectedTier] = useState(2)
  const [amount, setAmount]             = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [now]                           = useState(() => Date.now())
  const positionsRef = useRef<HTMLDivElement>(null)

  const tier  = TIERS[selectedTier]
  const num   = parseFloat(amount) || 0
  const daily = num * tier.dailyRate / 100
  const apy   = tier.dailyRate * 365

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todaySignals   = initialSignals.filter(s => new Date(s.observed_at) >= today)
  const activeEntities = new Set(todaySignals.map(s => s.entity_name)).size
  const lastSignal     = initialSignals[0] ?? null

  const convergence = initialSignals.find(
    s => s.pattern_id === 'convergence' &&
      new Date(s.observed_at).getTime() > now - 24 * 60 * 60 * 1000,
  )

  const handleStake = useCallback(async () => {
    if (num < 1) return
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 1800))
    setIsLoading(false)
    setAmount('')
  }, [num])

  const scrollToPositions = useCallback(() => {
    positionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="space-y-6">

      {/* ── Hero Card ── */}
      <div className="glass-card-solid p-5 sm:p-6 border border-purple-500/10">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span
            className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            {t('portfolio.heading')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* USDC Balance */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Image src="/usdc.webp" alt="USDC" width={14} height={14} className="rounded-full" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">{t('portfolio.usdcBalance')}</span>
            </div>
            <p className="stat-number text-2xl font-black text-white">
              ${MOCK_USDC_BALANCE.toLocaleString('en', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('portfolio.available')}</p>
          </div>

          {/* Total Assets */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">{t('portfolio.totalAssets')}</span>
            </div>
            <p className="stat-number text-2xl font-black text-white">
              ${MOCK_TOTAL_ASSETS.toLocaleString('en', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-green-400 mt-0.5">
              +${MOCK_TOTAL_EARNED.toFixed(2)} {t('portfolio.stakingReturns')}
            </p>

          </div>

          {/* My Positions — clickable, scrolls down */}
          <button
            onClick={scrollToPositions}
            className="col-span-2 sm:col-span-1 flex items-center justify-between sm:flex-col sm:items-start rounded-xl border border-purple-500/20 bg-purple-500/[0.06] px-4 py-3 hover:bg-purple-500/10 hover:border-purple-500/35 transition-all group text-left"
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t('portfolio.myPositions')}</p>
              <p className="stat-number text-2xl font-black text-white">{MOCK_POSITIONS.length}</p>
              <p className="text-[10px] text-purple-400">${MOCK_TOTAL_STAKED.toLocaleString()} {t('portfolio.staked')}</p>
            </div>
            <div className="flex items-center gap-1 text-purple-400 group-hover:text-purple-300 transition-colors sm:mt-auto">
              <span className="text-[10px] font-semibold">{t('portfolio.view')}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </button>
        </div>
      </div>

      {convergence && <ConvergenceAlert signal={convergence} />}

      {/* ── AlphaStake ── */}
      <div className="glass-card-solid overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{t('stake.title')}</p>
              <p className="text-[10px] text-zinc-500">{t('stake.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-400">{t('stake.engineActive')}</span>
          </div>
        </div>

        {/* ── Capacity Full Banner ── */}
        {AT_CAPACITY && (
          <div className="flex items-center gap-3 px-6 py-4 bg-amber-500/10 border-b border-amber-500/20">
            <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-amber-300">{t('stake.capacityBanner')}</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">{t('stake.capacityDesc')}</p>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6">

          {/* Tier selector */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">{t('stake.selectPeriod')}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
              {TIERS.map((tr, i) => {
                const active  = selectedTier === i
                const tierApy = tr.dailyRate * 365
                return (
                  <button
                    key={tr.days}
                    onClick={() => setSelectedTier(i)}
                    className={`relative snap-start shrink-0 w-[calc(20vw+8px)] min-w-[80px] sm:w-auto flex flex-col items-center gap-1 rounded-xl p-3 border transition-all ${
                      active
                        ? 'border-purple-500/40 bg-transparent'
                        : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]'
                    }`}
                  >
                    {active && (
                      <span className="absolute -top-px left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-purple-400" />
                    )}
                    <span className={`stat-number text-3xl font-black leading-none ${active ? 'text-white' : 'text-zinc-400'}`}>
                      {tr.days}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {t('stake.days')}
                    </span>
                    <span className={`stat-number text-base font-black ${active ? 'text-cyan-400' : 'text-zinc-600'}`}>
                      {tr.dailyRate}%
                    </span>
                    {active && (
                      <span className="text-[9px] text-purple-400 mt-0.5 font-semibold">
                        {tierApy.toFixed(0)}% APY
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">{t('stake.amount')}</span>
              <div className="flex gap-1">
                {['100', '500', '1000'].map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-zinc-400 hover:border-purple-500/40 hover:text-purple-400 transition-all"
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 focus-within:border-purple-500/40 transition-colors">
              <span className="text-zinc-600 text-lg">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                className="flex-1 bg-transparent text-3xl font-bold text-white placeholder:text-zinc-700 focus:outline-none stat-number"
              />
              <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 shrink-0">
                <Image src="/usdc.webp" alt="USDC" width={16} height={16} className="rounded-full" />
                <span className="text-xs font-bold text-zinc-300">USDC</span>
              </div>
            </div>
            {num > 0 && num < 1 && (
              <p className="text-[11px] text-red-400 mt-1.5">{t('stake.minError', { min: 1 })}</p>
            )}
          </div>

          {/* Yield Calculator */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {t('stake.calculatorTitle')} · {tier.days} {t('stake.days')} · {tier.dailyRate}%/day
              </p>
              <span className="text-[10px] font-semibold text-purple-400">{apy.toFixed(0)}% APY</span>
            </div>
            <div className="grid grid-cols-4 divide-x divide-white/[0.05]">
              {([
                { label: t('stake.daily'),      value: daily },
                { label: t('stake.sevenDays'),  value: daily * 7 },
                { label: t('stake.thirtyDays'), value: daily * 30 },
                { label: `${tier.days}d ${t('stake.totalLabel')}`, value: daily * tier.days, highlight: true },
              ] as { label: string; value: number; highlight?: boolean }[]).map(({ label, value, highlight }) => (
                <div key={label} className={`flex flex-col items-center py-4 gap-1 ${highlight ? 'bg-cyan-500/[0.04]' : ''}`}>
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
                  <p className={`stat-number text-base font-black ${highlight ? 'text-cyan-400' : 'text-white'}`}>
                    {num >= 1 ? `+$${value.toFixed(2)}` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {AT_CAPACITY ? (
            <div className="relative group/capacity w-full">
              <Button
                disabled
                className="w-full py-3.5 text-sm font-bold opacity-50 cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="flex items-center justify-center gap-2 text-zinc-500">
                  <Lock className="h-4 w-4" />
                  {t('stake.capacityBtn')}
                </span>
              </Button>
              {/* Tooltip on hover — wraps disabled button so mouse events still fire */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-zinc-900 border border-white/10 px-3 py-2 text-center text-xs text-zinc-300 opacity-0 group-hover/capacity:opacity-100 transition-opacity shadow-xl">
                {t('stake.capacityTooltip')}
              </div>
            </div>
          ) : (
            <Button
              onClick={handleStake}
              disabled={isLoading || num < 1}
              className="w-full py-3.5 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/20 transition-all"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('stake.signingPermit')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" />
                  {num >= 1
                    ? `Stake $${num.toLocaleString()} for ${tier.days} ${t('stake.days')}`
                    : t('stake.enterMin', { min: 1 })}
                </span>
              )}
            </Button>
          )}

          {/* Trust chips */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Shield,     label: t('stake.nonCustodial') },
              { icon: Zap,        label: t('stake.gaslessPermit') },
              { icon: TrendingUp, label: t('stake.alphaDriven') },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <Icon className="h-3.5 w-3.5 text-zinc-600" />
                <p className="text-[9px] font-semibold text-zinc-600 text-center uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active Positions ── */}
      <div ref={positionsRef} className="scroll-mt-6 space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-white">{t('positions.title')}</p>
          <span className="text-[10px] text-zinc-500" style={{ fontFamily: 'var(--poly-font-mono)' }}>
            {MOCK_POSITIONS.length} {t('positions.active')}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_POSITIONS.map(pos => (
            <PositionCard key={pos.id} pos={pos} />
          ))}
        </div>
      </div>

      {/* ── Acted Signals ── */}
      <div className="glass-card-solid overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-purple-400" />
            <p className="text-sm font-semibold text-white">{t('signals.title')}</p>
          </div>
          <span className="text-[10px] text-zinc-500" style={{ fontFamily: 'var(--poly-font-mono)' }}>
            {initialSignals.length} {t('signals.signals')}
          </span>
        </div>
        {initialSignals.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-zinc-600">{t('signals.empty')}</p>
          </div>
        ) : (
          initialSignals.slice(0, 20).map(signal => (
            <ActedSignalRow key={signal.id} signal={signal} />
          ))
        )}
      </div>

      {/* ── Stats (bottom) ── */}
      <div>
        <p
          className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3 px-1"
          style={{ fontFamily: 'var(--poly-font-mono)' }}
        >
          {t('stats.heading')}
        </p>
        <StatsBar
          walletCount={entities.length}
          todaySignals={todaySignals.length}
          activeEntities={activeEntities}
          lastSignal={lastSignal}
        />
      </div>

    </div>
  )
}
