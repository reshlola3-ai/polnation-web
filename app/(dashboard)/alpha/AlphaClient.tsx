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
  Crosshair, AlertTriangle, Wallet, CheckCircle,
  Coins, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useSignTypedData,
  usePublicClient,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { polygon } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import {
  ALPHA_STAKE_ABI,
  getAlphaStakeAddress,
  usdcToUnits,
} from '@/lib/alphastake'
import { signUsdcPermitForSpender } from '@/lib/alphastake-permit'

// ── Constants ──────────────────────────────────────────────────────────────
const TIERS = [
  { days: 15,  dailyRate: 1.0 },
  { days: 30,  dailyRate: 1.1 },
  { days: 60,  dailyRate: 1.2 },
  { days: 150, dailyRate: 1.3 },
  { days: 300, dailyRate: 1.5 },
] as const

type UserPosition = {
  positionId: number
  tierIndex: number
  principal: number
  earned: number
  daysElapsed: number
  totalDays: number
  startTime: number
  unlockTime: number
  matured: boolean
  closed: boolean
}

type StakeAccessResponse = {
  canStake: boolean
  reason: string
  minStakeUsdc: number
  walletAddress?: string | null
}

const MOCK_USDC_BALANCE = 0

async function fetchStakeAccess(): Promise<StakeAccessResponse> {
  const res = await fetch('/api/alpha/stake-access', { cache: 'no-store' })
  if (!res.ok) {
    return { canStake: false, reason: 'error', minStakeUsdc: 1 }
  }
  return res.json()
}

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

// ── Stake profit ticker (per-second accrual from tier daily rate) ───────────
function stakeDailyEarn(principal: number, dailyRate: number) {
  return principal * (dailyRate / 100)
}

function computeStakeAccrued(
  startTime: number,
  principal: number,
  dailyRate: number,
  totalDays: number,
  nowSec = Math.floor(Date.now() / 1000),
) {
  const maxEarn = stakeDailyEarn(principal, dailyRate) * totalDays
  const perSecond = stakeDailyEarn(principal, dailyRate) / 86_400
  const elapsed = Math.max(0, nowSec - startTime)
  return Math.min(elapsed * perSecond, maxEarn)
}

function useStakeAccrued(
  startTime: number,
  principal: number,
  dailyRate: number,
  totalDays: number,
) {
  const [accrued, setAccrued] = useState(() =>
    computeStakeAccrued(startTime, principal, dailyRate, totalDays),
  )

  useEffect(() => {
    const tick = () =>
      setAccrued(computeStakeAccrued(startTime, principal, dailyRate, totalDays))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime, principal, dailyRate, totalDays])

  return accrued
}

function StakeProfitTicker({
  startTime,
  principal,
  dailyRate,
  totalDays,
  className = 'stat-number text-xs font-bold text-cyan-400',
  decimals = 6,
}: {
  startTime: number
  principal: number
  dailyRate: number
  totalDays: number
  className?: string
  decimals?: number
}) {
  const accrued = useStakeAccrued(startTime, principal, dailyRate, totalDays)
  return (
    <span className={className} style={{ fontFamily: 'var(--poly-font-mono)' }}>
      ${accrued.toFixed(decimals)}
    </span>
  )
}

function TotalStakeProfitTicker({
  positions,
  className = 'text-[10px] text-green-400 mt-0.5',
}: {
  positions: UserPosition[]
  className?: string
}) {
  const t = useTranslations('alpha')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000)
      setTotal(
        positions.reduce((sum, pos) => {
          const tier = TIERS[pos.tierIndex]
          return sum + computeStakeAccrued(
            pos.startTime,
            pos.principal,
            tier.dailyRate,
            pos.totalDays,
            nowSec,
          )
        }, 0),
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [positions])

  return (
    <p className={className} style={{ fontFamily: 'var(--poly-font-mono)' }}>
      +${total.toFixed(6)} {t('portfolio.profitGenerated')}
    </p>
  )
}

// Local timestamp for a position's stake time (YYYY-MM-DD HH:mm)
function formatStakeTime(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const ALPHA_CARD_FX = `
@keyframes alphaCardPulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(168,85,247,.35), 0 0 22px rgba(168,85,247,.25); }
  50%      { box-shadow: 0 0 0 1px rgba(34,211,238,.55), 0 0 34px rgba(34,211,238,.45); }
}
`

// ── Position card ──────────────────────────────────────────────────────────
function PositionCard({
  pos,
  onUnstake,
  highlight = false,
}: {
  pos: UserPosition
  onUnstake: (positionId: number, matured: boolean) => Promise<void>
  highlight?: boolean
}) {
  const t = useTranslations('alpha')
  const [withdrawing, setWithdrawing]                   = useState(false)
  const [unstaking, setUnstaking]                   = useState(false)
  const [showUnstakeWarning, setShowUnstakeWarning] = useState(false)
  const [unstakeAcknowledged, setUnstakeAcknowledged] = useState(false)
  const [actionError, setActionError]               = useState('')

  const tier      = TIERS[pos.tierIndex]
  const daysLeft  = Math.max(0, pos.totalDays - pos.daysElapsed)
  const progress  = Math.min(1, pos.daysElapsed / pos.totalDays)
  const penalty   = pos.principal * 0.15

  const handleWithdrawPrincipal = useCallback(async () => {
    if (!pos.matured) return
    setActionError('')
    setWithdrawing(true)
    try {
      await onUnstake(pos.positionId, true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdraw failed'
      setActionError(msg.includes('User rejected') ? 'Transaction cancelled.' : msg)
    } finally {
      setWithdrawing(false)
    }
  }, [pos.matured, pos.positionId, onUnstake])

  const handleUnstake = useCallback(async () => {
    if (pos.matured) return
    setActionError('')
    if (!showUnstakeWarning) {
      setShowUnstakeWarning(true)
      setUnstakeAcknowledged(false)
      return
    }
    if (!unstakeAcknowledged) return
    setUnstaking(true)
    try {
      await onUnstake(pos.positionId, false)
      setShowUnstakeWarning(false)
      setUnstakeAcknowledged(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unstake failed'
      setActionError(msg.includes('User rejected') ? 'Transaction cancelled.' : msg)
    } finally {
      setUnstaking(false)
    }
  }, [pos.matured, pos.positionId, showUnstakeWarning, unstakeAcknowledged, onUnstake])

  const cancelEarlyUnstake = useCallback(() => {
    setShowUnstakeWarning(false)
    setUnstakeAcknowledged(false)
    setActionError('')
  }, [])

  return (
    <div
      className={`glass-card-solid p-5 border transition-all duration-500 ${
        highlight ? 'border-purple-400/60' : 'border-white/[0.06]'
      }`}
      style={highlight ? { animation: 'alphaCardPulse 1.2s ease-in-out 2' } : undefined}
    >
      {/* Header: position id + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-cyan-500/20 border border-white/10">
            <Coins className="h-3.5 w-3.5 text-purple-300" />
          </div>
          <span className="text-xs text-zinc-500" style={{ fontFamily: 'var(--poly-font-mono)' }}>
            #{pos.positionId}
          </span>
        </div>
        {pos.matured ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {t('positions.statusEnded')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            {t('positions.statusOngoing')}
          </span>
        )}
      </div>

      {/* Big principal + lock type + remaining */}
      <div className="mb-3">
        <p className="stat-number text-3xl font-black text-white leading-none">
          ${pos.principal.toLocaleString()}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.05] border border-white/[0.08] text-zinc-300">
            <Lock className="h-2.5 w-2.5" /> {t('positions.lockType', { days: tier.days })}
          </span>
          <span className="text-[11px] text-zinc-500">
            {pos.matured ? t('positions.unlocked') : t('positions.remaining', { days: daysLeft })}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4 h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Detail rows */}
      <div className="mb-4 rounded-xl overflow-hidden border border-white/[0.05] divide-y divide-white/[0.04]">
        <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03]">
          <span className="text-[11px] text-zinc-500">{t('positions.totalEarnings')}</span>
          <StakeProfitTicker
            startTime={pos.startTime}
            principal={pos.principal}
            dailyRate={tier.dailyRate}
            totalDays={pos.totalDays}
            className="stat-number text-sm font-bold text-cyan-400"
          />
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03]">
          <span className="text-[11px] text-zinc-500">{t('positions.redemptionFee')}</span>
          <span className={`stat-number text-sm font-bold ${pos.matured ? 'text-cyan-300' : 'text-white'}`}>
            {pos.matured ? t('positions.redemptionFeeFree') : '15%'}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03]">
          <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> {t('positions.purchaseTime')}
          </span>
          <span className="stat-number text-xs font-semibold text-zinc-300">{formatStakeTime(pos.startTime)}</span>
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
          <button
            type="button"
            onClick={cancelEarlyUnstake}
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.08] transition-colors"
          >
            {t('positions.cancelEarlyUnstake')}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleWithdrawPrincipal}
          disabled={!pos.matured || withdrawing || unstaking}
          className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            pos.matured
              ? 'text-cyan-300 hover:bg-cyan-500/10'
              : 'text-zinc-500 cursor-not-allowed'
          }`}
          style={pos.matured ? {
            background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.08) 100%)',
            border: '1px solid rgba(6,182,212,0.3)',
          } : {
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {withdrawing
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('positions.withdrawingPrincipal')}</>
            : <><ArrowUpRight className="h-3.5 w-3.5" /> {t('positions.withdrawPrincipalBtn')}</>}
        </button>
        {!pos.matured && (
        <button
          onClick={handleUnstake}
          disabled={unstaking || withdrawing || (showUnstakeWarning && !unstakeAcknowledged)}
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
        )}
      </div>
      {actionError && (
        <p className="text-[11px] text-red-400 mt-2">{actionError}</p>
      )}
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
  const { open: openWalletModal } = useWeb3Modal()
  const { address, isConnected, chain, connector } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { mutateAsync: writeContract } = useWriteContract()
  const publicClient = usePublicClient({ chainId: polygon.id })

  const [selectedTier, setSelectedTier] = useState(2)
  const [amount, setAmount]             = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [stakeStep, setStakeStep]       = useState<'idle' | 'signing' | 'confirming'>('idle')
  const [stakeError, setStakeError]     = useState('')
  const [stakeSuccess, setStakeSuccess] = useState('')
  const [stakeAccess, setStakeAccess]   = useState<StakeAccessResponse | null>(null)
  const [accessLoading, setAccessLoading] = useState(true)
  const [txHash, setTxHash]             = useState<`0x${string}` | undefined>()
  const [now]                           = useState(() => Date.now())
  const positionsRef = useRef<HTMLDivElement>(null)

  const stakeAddress = getAlphaStakeAddress()
  const canStake = Boolean(stakeAccess?.canStake)
  const minStake = stakeAccess?.minStakeUsdc ?? 1
  const showCapacityFull = !accessLoading && !canStake

  const tier  = TIERS[selectedTier]
  const num   = parseFloat(amount) || 0
  const daily = num * tier.dailyRate / 100
  const apy   = tier.dailyRate * 365

  const boundWallet = stakeAccess?.walletAddress?.toLowerCase() ?? null
  const walletMatches = Boolean(
    address && boundWallet && address.toLowerCase() === boundWallet,
  )
  const isWrongNetwork = isConnected && chain?.id !== polygon.id

  const { data: usdcBalanceRaw, refetch: refetchUsdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: polygon.id,
    query: { enabled: canStake && isConnected && Boolean(address) },
  })

  const usdcBalance = canStake && isConnected && usdcBalanceRaw !== undefined
    ? Number(formatUnits(usdcBalanceRaw, 6))
    : MOCK_USDC_BALANCE

  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: polygon.id,
  })

  // ── On-chain positions (connected wallet, or bound wallet when not connected) ──
  const [chainPositions, setChainPositions] = useState<UserPosition[]>([])
  const positionWallet = (address ?? boundWallet) as `0x${string}` | null

  const loadPositions = useCallback(async (): Promise<UserPosition[]> => {
    if (!stakeAddress || !positionWallet || !publicClient) {
      setChainPositions([])
      return []
    }
    try {
      const ids = await publicClient.readContract({
        address: stakeAddress,
        abi: ALPHA_STAKE_ABI,
        functionName: 'getUserPositions',
        args: [positionWallet],
      })
      const raw = await Promise.all(
        ids.map(id =>
          publicClient.readContract({
            address: stakeAddress,
            abi: ALPHA_STAKE_ABI,
            functionName: 'getPosition',
            args: [id],
          })
        )
      )
      const nowSec = Math.floor(Date.now() / 1000)
      const mapped: UserPosition[] = raw.map((p, i) => {
        const [, amount, tierId, startTime, unlockTime, closed] = p
        const tierIndex = Math.min(Number(tierId), TIERS.length - 1)
        const totalDays = TIERS[tierIndex].days
        const daysElapsed = Math.min(
          totalDays,
          Math.floor((nowSec - Number(startTime)) / 86400)
        )
        const principal = Number(formatUnits(amount, 6))
        return {
          positionId: Number(ids[i]),
          tierIndex,
          principal,
          earned: principal * (TIERS[tierIndex].dailyRate / 100) * daysElapsed,
          daysElapsed,
          totalDays,
          startTime: Number(startTime),
          unlockTime: Number(unlockTime),
          matured: !closed && Number(unlockTime) <= nowSec,
          closed,
        }
      })
      setChainPositions(mapped)
      return mapped
    } catch {
      // RPC hiccup — keep last known positions
      return []
    }
  }, [stakeAddress, positionWallet, publicClient])

  useEffect(() => {
    loadPositions()
  }, [loadPositions])

  const openPositions = chainPositions.filter(p => !p.closed)
  const totalStakedUsdc = openPositions.reduce((s, p) => s + p.principal, 0)

  const [positionFilter, setPositionFilter] = useState<'all' | 'ongoing' | 'ended'>('all')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const filteredPositions = openPositions.filter(p =>
    positionFilter === 'all' ? true
      : positionFilter === 'ongoing' ? !p.matured
      : p.matured,
  )

  const handlePositionUnstake = useCallback(async (positionId: number, matured: boolean) => {
    if (!stakeAddress) throw new Error('Contract not configured')
    if (!isConnected || !address) {
      openWalletModal()
      throw new Error('Connect your wallet first.')
    }
    if (boundWallet && address.toLowerCase() !== boundWallet) {
      throw new Error('Connect the wallet bound to your account.')
    }
    const hash = await writeContract({
      address: stakeAddress,
      abi: ALPHA_STAKE_ABI,
      functionName: matured ? 'withdraw' : 'emergencyUnstake',
      args: [BigInt(positionId)],
      chainId: polygon.id,
    })
    await publicClient?.waitForTransactionReceipt({ hash })
    await loadPositions()
    refetchUsdcBalance()
  }, [stakeAddress, isConnected, address, boundWallet, writeContract, publicClient, loadPositions, refetchUsdcBalance, openWalletModal])

  const refreshStakeAccess = useCallback(async () => {
    setAccessLoading(true)
    try {
      setStakeAccess(await fetchStakeAccess())
    } catch {
      setStakeAccess({ canStake: false, reason: 'error', minStakeUsdc: 1 })
    } finally {
      setAccessLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStakeAccess()
  }, [refreshStakeAccess])

  useEffect(() => {
    if (isTxConfirmed) {
      setStakeSuccess('Stake confirmed on Polygon.')
      setAmount('')
      setIsLoading(false)
      setStakeStep('idle')
      refetchUsdcBalance()
      refreshStakeAccess()
      // Surface the freshly created position: refresh, then scroll to it and
      // pulse-highlight the newest card so the user sees their new asset pack.
      loadPositions().then(list => {
        if (!list.length) return
        const newest = list.reduce((a, b) => (b.positionId > a.positionId ? b : a))
        setPositionFilter('all')
        setHighlightId(newest.positionId)
        setTimeout(() => {
          positionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 120)
        setTimeout(() => setHighlightId(null), 3000)
      })
    }
  }, [isTxConfirmed, refetchUsdcBalance, refreshStakeAccess, loadPositions])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todaySignals   = initialSignals.filter(s => new Date(s.observed_at) >= today)
  const activeEntities = new Set(todaySignals.map(s => s.entity_name)).size
  const lastSignal     = initialSignals[0] ?? null

  const convergence = initialSignals.find(
    s => s.pattern_id === 'convergence' &&
      new Date(s.observed_at).getTime() > now - 24 * 60 * 60 * 1000,
  )

  const handleStake = useCallback(async () => {
    setStakeError('')
    setStakeSuccess('')

    if (!canStake) return
    if (num < minStake) return

    if (!stakeAddress) {
      setStakeError('AlphaStake contract is not configured.')
      return
    }

    if (!isConnected || !address) {
      openWalletModal()
      return
    }

    if (isWrongNetwork) {
      openWalletModal({ view: 'Networks' })
      return
    }

    if (boundWallet && address.toLowerCase() !== boundWallet) {
      setStakeError('Connect the wallet bound to your account to stake.')
      return
    }

    if (usdcBalanceRaw !== undefined && usdcBalanceRaw < usdcToUnits(num)) {
      setStakeError('Insufficient USDC balance.')
      return
    }

    setIsLoading(true)
    setStakeStep('signing')

    try {
      if (!publicClient) {
        setStakeError('Unable to connect to Polygon.')
        setIsLoading(false)
        setStakeStep('idle')
        return
      }

      const amountUnits = usdcToUnits(num)
      const tierId = selectedTier
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

      const nonce = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'nonces',
        args: [address],
      })

      let hash: `0x${string}`

      let permitSignature: Awaited<ReturnType<typeof signUsdcPermitForSpender>> | null = null
      try {
        permitSignature = await signUsdcPermitForSpender({
          owner: address,
          spender: stakeAddress,
          value: amountUnits,
          nonce,
          deadline,
          signTypedDataAsync,
          connector,
        })
      } catch (permitErr) {
        const msg = permitErr instanceof Error ? permitErr.message.toLowerCase() : ''
        if (msg.includes('user rejected') || msg.includes('denied') || msg.includes('cancel')) {
          throw permitErr
        }
      }

      setStakeStep('confirming')
      if (permitSignature) {
        hash = await writeContract({
          address: stakeAddress,
          abi: ALPHA_STAKE_ABI,
          functionName: 'stakeWithPermit',
          args: [
            amountUnits,
            tierId,
            deadline,
            permitSignature.v,
            permitSignature.r,
            permitSignature.s,
          ],
          chainId: polygon.id,
        })
      } else {
        setStakeStep('confirming')
        const approveHash = await writeContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [stakeAddress, amountUnits],
          chainId: polygon.id,
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        hash = await writeContract({
          address: stakeAddress,
          abi: ALPHA_STAKE_ABI,
          functionName: 'stake',
          args: [amountUnits, tierId],
          chainId: polygon.id,
        })
      }

      setTxHash(hash)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stake failed'
      setStakeError(message.includes('User rejected') ? 'Transaction cancelled.' : message)
      setIsLoading(false)
      setStakeStep('idle')
    }
  }, [
    canStake,
    num,
    minStake,
    stakeAddress,
    isConnected,
    address,
    isWrongNetwork,
    boundWallet,
    usdcBalanceRaw,
    selectedTier,
    publicClient,
    signTypedDataAsync,
    connector,
    writeContract,
    openWalletModal,
  ])

  const stakeButtonDisabled =
    isLoading ||
    isTxConfirming ||
    num < minStake ||
    (isConnected && isWrongNetwork) ||
    (isConnected && boundWallet !== null && !walletMatches)

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
              ${(canStake ? usdcBalance : MOCK_USDC_BALANCE).toLocaleString('en', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('portfolio.available')}</p>
          </div>

          {/* Staking Principal */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">{t('portfolio.stakingPrincipal')}</span>
            </div>
            <p className="stat-number text-2xl font-black text-white">
              ${totalStakedUsdc.toLocaleString('en', { minimumFractionDigits: 2 })}
            </p>
            {openPositions.length > 0 ? (
              <TotalStakeProfitTicker positions={openPositions} />
            ) : (
              <p className="text-[10px] text-zinc-600 mt-0.5">{t('portfolio.profitGenerated')}</p>
            )}
          </div>

          {/* My Positions — clickable, scrolls down */}
          <button
            onClick={scrollToPositions}
            className="col-span-2 sm:col-span-1 flex items-center justify-between sm:flex-col sm:items-start rounded-xl border border-purple-500/20 bg-purple-500/[0.06] px-4 py-3 hover:bg-purple-500/10 hover:border-purple-500/35 transition-all group text-left"
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{t('portfolio.myPositions')}</p>
              <p className="stat-number text-2xl font-black text-white">{openPositions.length}</p>
              <p className="text-[10px] text-purple-400">${totalStakedUsdc.toLocaleString()} {t('portfolio.staked')}</p>
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

        {/* ── Capacity / access banner ── */}
        {showCapacityFull && (
          <div className="flex items-center gap-3 px-6 py-4 bg-amber-500/10 border-b border-amber-500/20">
            <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
            <div>
              {stakeAccess?.reason === 'wallet_required' ? (
                <>
                  <p className="text-sm font-semibold text-amber-300">Wallet required</p>
                  <p className="text-[11px] text-amber-400/70 mt-0.5">
                    Bind your wallet on the dashboard before staking.
                  </p>
                </>
              ) : stakeAccess?.reason === 'login_required' ? (
                <>
                  <p className="text-sm font-semibold text-amber-300">Sign in required</p>
                  <p className="text-[11px] text-amber-400/70 mt-0.5">
                    Log in to check whether your account can stake.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-300">{t('stake.capacityBanner')}</p>
                  <p className="text-[11px] text-amber-400/70 mt-0.5">{t('stake.capacityDesc')}</p>
                </>
              )}
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
                min={String(minStake)}
                disabled={!canStake}
                className="flex-1 bg-transparent text-3xl font-bold text-white placeholder:text-zinc-700 focus:outline-none stat-number disabled:opacity-50"
              />
              <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 shrink-0">
                <Image src="/usdc.webp" alt="USDC" width={16} height={16} className="rounded-full" />
                <span className="text-xs font-bold text-zinc-300">USDC</span>
              </div>
            </div>
            {num > 0 && num < minStake && (
              <p className="text-[11px] text-red-400 mt-1.5">{t('stake.minError', { min: minStake })}</p>
            )}
            {canStake && isConnected && boundWallet && !walletMatches && (
              <p className="text-[11px] text-red-400 mt-1.5">
                Connect your bound wallet ({boundWallet.slice(0, 6)}…{boundWallet.slice(-4)}) to stake.
              </p>
            )}
            {canStake && isConnected && isWrongNetwork && (
              <p className="text-[11px] text-red-400 mt-1.5">Switch to Polygon network to stake.</p>
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
                    {num >= minStake ? `+$${value.toFixed(2)}` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {accessLoading ? (
            <Button disabled className="w-full py-3.5 text-sm font-bold opacity-50">
              <span className="flex items-center justify-center gap-2 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking access…
              </span>
            </Button>
          ) : showCapacityFull ? (
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
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-zinc-900 border border-white/10 px-3 py-2 text-center text-xs text-zinc-300 opacity-0 group-hover/capacity:opacity-100 transition-opacity shadow-xl">
                {t('stake.capacityTooltip')}
              </div>
            </div>
          ) : !isConnected ? (
            <Button
              onClick={() => openWalletModal()}
              className="w-full py-3.5 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/20 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                <Wallet className="h-4 w-4" />
                Connect wallet to stake
              </span>
            </Button>
          ) : (
            <>
              <Button
                onClick={handleStake}
                disabled={stakeButtonDisabled}
                className="w-full py-3.5 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
              >
                {isLoading || isTxConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {stakeStep === 'signing'
                      ? t('stake.signingPermit')
                      : isTxConfirming
                        ? 'Confirming on Polygon…'
                        : t('stake.signingPermit')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" />
                    {num >= minStake
                      ? `Stake $${num.toLocaleString()} for ${tier.days} ${t('stake.days')}`
                      : t('stake.enterMin', { min: minStake })}
                  </span>
                )}
              </Button>
              {stakeError && (
                <p className="text-[11px] text-red-400 text-center">{stakeError}</p>
              )}
              {stakeSuccess && (
                <div className="flex items-center justify-center gap-2 text-[11px] text-green-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {stakeSuccess}
                  {txHash && (
                    <a
                      href={`https://polygonscan.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-green-300/80"
                    >
                      View tx
                    </a>
                  )}
                </div>
              )}
            </>
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
        <style dangerouslySetInnerHTML={{ __html: ALPHA_CARD_FX }} />
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-white">{t('positions.title')}</p>
          <span className="text-[10px] text-zinc-500" style={{ fontFamily: 'var(--poly-font-mono)' }}>
            {openPositions.length} {t('positions.active')}
          </span>
        </div>

        {/* Filter tabs */}
        {openPositions.length > 0 && (
          <div className="flex gap-2 px-1">
            {([
              { key: 'all',     label: t('positions.filterAll') },
              { key: 'ongoing', label: t('positions.filterOngoing') },
              { key: 'ended',   label: t('positions.filterEnded') },
            ] as { key: 'all' | 'ongoing' | 'ended'; label: string }[]).map(({ key, label }) => {
              const count = key === 'all'
                ? openPositions.length
                : key === 'ongoing'
                  ? openPositions.filter(p => !p.matured).length
                  : openPositions.filter(p => p.matured).length
              const selected = positionFilter === key
              return (
                <button
                  key={key}
                  onClick={() => setPositionFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                    selected
                      ? 'bg-purple-500/20 border-purple-400/40 text-purple-200'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.15]'
                  }`}
                >
                  {label} <span className="opacity-60">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {filteredPositions.map(pos => (
            <PositionCard
              key={pos.positionId}
              pos={pos}
              onUnstake={handlePositionUnstake}
              highlight={pos.positionId === highlightId}
            />
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
