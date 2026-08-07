'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Wallet,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowDownCircle,
  History,
  Star,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Timer,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  Unlock
} from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { polygon } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat } from '@/components/ui/poly/MonoStat'
import { BevelCard } from '@/components/ui/poly/BevelCard'
import { Collapsible } from '@/components/ui/poly/Collapsible'
import { WithdrawSuccessScreen } from './components/WithdrawSuccessScreen'
import { TIERS } from '../dashboard/_constants'

interface ProfitTier {
  level: number
  name: string
  min_usdc: number
  max_usdc: number
  rate_percent: number
}

// 客户端展示用的静态档位表：与 dashboard 同一套写死的 TIERS
// (app/(dashboard)/dashboard/_constants.ts)。后台调 profit_tiers 只影响实际发放，
// 绝不改动这里展示给客户的利率表——客户永远看到这套固定数字。
const DISPLAY_TIERS: ProfitTier[] = TIERS.map((t, i) => ({
  level: i + 1,
  name: t.name,
  min_usdc: t.min,
  max_usdc: t.max === Infinity ? 999_999_999 : t.max,
  rate_percent: Number((t.rate * 100).toFixed(4)),
}))

interface Breakdown {
  last_round: { date: string | null; agentic: number; alpha: number; commission: number; community: number; total: number }
  lifetime: { agentic: number; alpha: number; commission: number; community: number; lottery: number; total: number }
}

interface ProfitData {
  total_earned_usdc: number
  total_commission_earned: number
  available_usdc: number
  community_locked_usdc?: number
  available_matic: number
  withdrawn_usdc: number
  withdrawn_matic: number
  current_tier: number | null
}

interface UnlockRequest {
  status: string
  rejected_reason: string | null
}

// Direct line to the admin for locked-salary unlock help
const LOCKED_SUPPORT_TELEGRAM = 'https://t.me/ulsabrn'

// Public Telegram group users must join before they can withdraw
const WITHDRAW_TELEGRAM_GROUP = 'https://t.me/polnation'

interface CommissionItem {
  id: string
  level: number
  source_profit: number
  commission_rate: number
  commission_amount: number
  created_at: string
  source_user: {
    username: string
    email: string
  } | null
}

interface HistoryItem {
  id: string
  usdc_balance: number
  tier_level: number
  rate_applied: number
  profit_earned: number
  created_at: string
}

interface WithdrawalItem {
  id: string
  token_type: string
  amount: number
  usd_amount?: number
  status: string
  created_at: string
  tx_hash: string | null
}

interface ConfigData {
  interval_seconds: number
  min_withdrawal_usdc: number
  min_withdrawal_matic: number
  last_distribution_at: string | null
}

export default function EarningsPage() {
  const t = useTranslations('earnings')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tWallet = useTranslations('wallet')
  
  const { address, isConnected } = useAccount()
  const [profits, setProfits] = useState<ProfitData | null>(null)
  // 提现前必须有有效签名（严格：pending + 未过期 + owner==绑定钱包）。
  // 缺字段（旧缓存）默认放行 UI，服务端仍权威兜底。
  const [canWithdraw, setCanWithdraw] = useState(true)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  // 固定展示档位，不再从后台配置读取（后台改率不影响客户所见）
  const [tiers] = useState<ProfitTier[]>(DISPLAY_TIERS)
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [nextDistribution, setNextDistribution] = useState<{ next_at: string; seconds_remaining: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawType, setWithdrawType] = useState<'USDC' | 'POL'>('USDC')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [polPrice, setPolPrice] = useState<number>(0.15)
  const [error, setError] = useState('')
  const [tgGroupRequired, setTgGroupRequired] = useState(false)
  const [success, setSuccess] = useState('')
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false)
  const [earningsDetailsOpen, setEarningsDetailsOpen] = useState(false)
  const [boundWalletAddress, setBoundWalletAddress] = useState<string | null>(null)
  const [registeredAt, setRegisteredAt] = useState<string | null>(null)
  const [teamVolume, setTeamVolume] = useState<number>(0)
  const [withdrawSuccess, setWithdrawSuccess] = useState<{ amount: number; txHash: string } | null>(null)
  const breakdownRef = useRef<HTMLDivElement | null>(null)
  const [unlockRequest, setUnlockRequest] = useState<UnlockRequest | null>(null)
  const [requestingUnlock, setRequestingUnlock] = useState(false)

  const lockedUsdc = profits?.community_locked_usdc || 0

  // Use bound wallet or connected wallet (same as Dashboard)
  const walletAddress = boundWalletAddress || address

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw, 6)) : 0
  const currentTier = tiers.find(t => usdcBalance >= t.min_usdc && usdcBalance < t.max_usdc)
  const nextTier = currentTier ? tiers.find(t => t.level === currentTier.level + 1) : tiers[0]
  const totalAvailable = (profits?.available_usdc || 0)
  
  // Has wallet = connected OR has bound wallet
  const hasWallet = isConnected || !!boundWalletAddress

  const polAmount = withdrawAmount && polPrice > 0 
    ? (parseFloat(withdrawAmount) / polPrice).toFixed(4)
    : '0'

  const fetchPolPrice = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd', {
        headers: { 'Accept': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        if (data['polygon-ecosystem-token']?.usd) {
          setPolPrice(data['polygon-ecosystem-token'].usd)
        }
      }
    } catch (err) {
      console.error('Failed to fetch POL price:', err)
    }
  }, [])

  const fetchProfits = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/profits/user')
      if (res.ok) {
        const data = await res.json()
        setProfits(data.profits)
        setCanWithdraw(data.canWithdraw !== false)
        // 无签名/无质押/未认证 Telegram → 主动提示"加入 Telegram 群 + 认证"（此时提现按钮也禁用）
        setTgGroupRequired(data.needsTelegram === true)
        setBreakdown(data.breakdown || null)
        setHistory(data.history)
        setCommissions(data.commissions || [])
        setWithdrawals(data.withdrawals)
        setConfig(data.config)
        setNextDistribution(data.next_distribution)
        setBoundWalletAddress(data.wallet_address || null)
        setRegisteredAt(data.registered_at || null)
        setTeamVolume(Number(data.team_volume) || 0)
      }
      // Locked community salary + any open unlock request
      try {
        const ur = await fetch('/api/community/unlock-request')
        if (ur.ok) {
          const urData = await ur.json()
          setUnlockRequest(urData.request || null)
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      console.error('Failed to fetch profits:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const requestUnlock = async () => {
    setRequestingUnlock(true)
    setError(''); setSuccess('')
    try {
      const res = await fetch('/api/community/unlock-request', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error === 'request_pending' ? t('locked.alreadyPending')
            : data.error === 'no_locked_balance' ? t('locked.nothingLocked')
            : tErrors('networkError')
        )
        return
      }
      setSuccess(t('locked.requestSubmitted'))
      fetchProfits()
    } catch {
      setError(tErrors('networkError'))
    } finally {
      setRequestingUnlock(false)
    }
  }

  useEffect(() => {
    fetchProfits()
    fetchPolPrice()
  }, [fetchProfits, fetchPolPrice])

  useEffect(() => {
    if (!nextDistribution || nextDistribution.seconds_remaining <= 0) return

    const timer = setInterval(() => {
      setNextDistribution(prev => {
        if (!prev || prev.seconds_remaining <= 0) return null
        return { ...prev, seconds_remaining: prev.seconds_remaining - 1 }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [nextDistribution?.seconds_remaining])

  const handleWithdraw = async () => {
    // POL 提现暂时关闭：储备不足，引导用户改用 USDC
    if (withdrawType === 'POL') {
      setError(tErrors('polReserveInsufficient'))
      setSuccess('')
      return
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError(tErrors('invalidAmount'))
      return
    }

    // 无有效签名 → 提现前必须先签名（服务端也会拦，这里提前拦省一次往返）
    if (!canWithdraw) {
      setError(tErrors('signatureRequired'))
      return
    }

    const minAmount = config?.min_withdrawal_usdc || 0.1

    if (parseFloat(withdrawAmount) < minAmount) {
      setError(tErrors('minAmount', { amount: minAmount }))
      return
    }

    if (parseFloat(withdrawAmount) > totalAvailable) {
      setError(tErrors('insufficientBalance'))
      return
    }

    setWithdrawing(true)
    setError('')
    setTgGroupRequired(false)
    setSuccess('')

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // POL 已在函数开头被拦截，这里 withdrawType 必为 USDC
          tokenType: withdrawType,
          amount: withdrawAmount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'pol_reserve_insufficient') {
          setError(tErrors('polReserveInsufficient'))
          return
        }
        if (data.error === 'tg_group_required' || data.error === 'telegram_required') {
          // 无签名/无质押 → 引导认证 Telegram + 加入群组（telegram_required=未绑定，tg_group_required=未入群）
          setTgGroupRequired(true)
          return
        }
        if (data.error === 'signature_required') {
          setCanWithdraw(false)
          setError(tErrors('signatureRequired'))
          return
        }
        setError(data.error || tErrors('withdrawFailed'))
        return
      }

      if (data.tx_hash) {
        // 即时上链完成 → 全屏提现成功页
        setWithdrawSuccess({ amount: parseFloat(withdrawAmount), txHash: data.tx_hash })
      } else {
        // 仅排队成功(无 tx_hash) → 保留内联提示
        setSuccess(tCommon('success'))
      }
      setWithdrawAmount('')
      fetchProfits()
    } catch {
      setError(tErrors('networkError'))
    } finally {
      setWithdrawing(false)
    }
  }

  const handleViewBreakdown = () => {
    setWithdrawSuccess(null)
    setEarningsDetailsOpen(true)
    // 等折叠区展开动画后再滚动到收入构成卡片
    setTimeout(() => {
      breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 350)
  }

  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const formatInterval = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    if (hours >= 24) return `${Math.floor(hours / 24)} days`
    return `${hours} hours`
  }

  // Show loading state while fetching initial data
  if (isLoading && !profits) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  // Only show connect wallet prompt if user has no bound wallet AND is not connected
  if (!hasWallet) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Wallet className="w-16 h-16 text-zinc-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">{tWallet('connect')}</h2>
        <p className="text-zinc-500 text-center max-w-md">{tWallet('signDesc')}</p>
      </div>
    )
  }

  return (
    <div className="kraken-shell space-y-4">
      {withdrawSuccess && (
        <WithdrawSuccessScreen
          amount={withdrawSuccess.amount}
          txHash={withdrawSuccess.txHash}
          totalWithdrawn={profits?.withdrawn_usdc || 0}
          registeredAt={registeredAt}
          teamVolume={teamVolume}
          walletAddress={walletAddress}
          onDone={() => setWithdrawSuccess(null)}
          onViewBreakdown={handleViewBreakdown}
        />
      )}
      {/* This banner is no longer needed since we use bound wallet address */}

      {/* ── Header — polygon-style ───────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <EyebrowTag>Polnation · {t('title')}</EyebrowTag>
          <h1 className="mt-1.5 text-3xl font-semibold text-white tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-[13px] text-white/50">{t('subtitle')}</p>
        </div>
        <button
          onClick={fetchProfits}
          disabled={isLoading}
          aria-label={tCommon('refresh')}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--kraken-panel)] border border-[var(--kraken-border)] text-[13px] font-semibold text-white hover:bg-white/[0.06] transition-colors duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {tCommon('refresh')}
        </button>
      </header>

      {/* ── Hero: Withdraw — primary action, immediately visible ─────────── */}
      <BevelCard size="lg" pad={28} bg="rgba(255,255,255,0.02)">

        <header className="mb-7">
          <EyebrowTag>{t('withdraw.title')}</EyebrowTag>
          <h2 className="mt-1.5 text-2xl font-semibold text-white tracking-tight">
            {t('withdraw.amount')}
          </h2>
        </header>

        {error && (
          <div role="alert" aria-live="polite" className="mb-5 flex items-center gap-2.5 rounded-2xl bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300 ring-1 ring-rose-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {tgGroupRequired && (
          <div role="alert" aria-live="polite" className="mb-5 rounded-2xl bg-[#229ED9]/[0.08] px-4 py-3.5 ring-1 ring-[#229ED9]/25">
            <p className="flex items-center gap-2.5 text-[13px] text-[#7fd0f2]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t('withdraw.tgGroupRequired')}</span>
            </p>
            <a
              href={WITHDRAW_TELEGRAM_GROUP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#229ED9] hover:bg-[#1c8dc2] px-4 py-2 text-[13px] font-semibold text-white transition-colors"
            >
              ✈️ {t('withdraw.joinTelegram')}
            </a>
          </div>
        )}
        {success && (
          <div role="status" aria-live="polite" className="mb-5 flex items-center gap-2.5 rounded-2xl bg-[#00e28a]/[0.08] px-4 py-3 text-[13px] text-[#00e28a]/80 ring-1 ring-[#00e28a]/[0.15]">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* iOS segmented control */}
        <div className="mx-auto mb-7 grid grid-cols-2 w-full max-w-xs rounded-full bg-[var(--kraken-panel)] p-1 border border-[var(--kraken-border)]">
          {(['USDC', 'POL'] as const).map((type) => {
            const active = withdrawType === type
            return (
              <button
                key={type}
                onClick={() => setWithdrawType(type)}
                aria-pressed={active}
                className={`relative h-9 rounded-full text-[13px] font-semibold tracking-tight transition-colors duration-200 ease-out ${
                  active
                    ? 'bg-[var(--kraken-purple)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                {type}
              </button>
            )
          })}
        </div>

        {/* Amount display — centered, huge */}
        <div className="mb-5 text-center">
          <div className="flex items-baseline justify-center gap-0.5 tabular-nums">
            <span className="text-3xl font-medium text-white/50 translate-y-[-0.15em]">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0"
              aria-label={t('withdraw.amount')}
              className="min-w-0 max-w-[70%] bg-transparent border-0 outline-none text-center text-[64px]! leading-none font-semibold text-white tracking-tight placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
              style={{ width: `${Math.max(1, (withdrawAmount || '0').length)}ch` }}
            />
          </div>

          <p className="mt-3 text-[13px] text-white/45 tabular-nums">
            {t('withdraw.available')} <span className="text-white/70">${totalAvailable.toFixed(2)}</span>
            {withdrawType === 'POL' && polPrice > 0 && (
              <> · ≈ {(totalAvailable / polPrice).toFixed(2)} POL</>
            )}
          </p>
        </div>

        {/* Locked community salary — visible in the withdrawable area, but gated.
            Funds here are excluded from the withdraw amount until admin approval. */}
        {lockedUsdc > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] text-amber-200/90">
                <Lock className="w-3.5 h-3.5" /> {t('locked.title')}
              </span>
              <span className="text-[15px] font-semibold text-amber-200 tabular-nums">${lockedUsdc.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-200/55">
              {t('locked.note')} · {t('locked.maxClaimable', { amount: totalAvailable.toFixed(2) })}
            </p>
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              {unlockRequest?.status === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-amber-300/80">
                  <RefreshCw className="w-3.5 h-3.5" /> {t('locked.pending')}
                </span>
              ) : (
                <button
                  onClick={requestUnlock}
                  disabled={requestingUnlock}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-1.5 text-[12px] font-semibold text-amber-200 transition-colors disabled:opacity-50"
                >
                  {requestingUnlock ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                  {t('locked.requestUnlock')}
                </button>
              )}
              <a
                href={LOCKED_SUPPORT_TELEGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#229ED9] hover:bg-[#1c8dc2] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors"
              >
                ✈️ {t('locked.contactAdmin')}
              </a>
            </div>
            {unlockRequest?.status === 'rejected' && unlockRequest.rejected_reason && (
              <p className="mt-2 text-[11px] text-rose-300/70">{t('locked.rejected')}: {unlockRequest.rejected_reason}</p>
            )}
          </div>
        )}

        {/* 签名提醒统一放到首页(常驻 banner)，提现页不再显示"验证钱包所有权"卡片。
            质押者本就能提；非质押者无有效签名时提现按钮仍禁用、点击给出 toast 引导。 */}

        {/* Quick picks — Apple Wallet style chips */}
        <div className="mb-7 grid grid-cols-4 gap-2">
          {[
            { label: '25%', value: totalAvailable * 0.25 },
            { label: '50%', value: totalAvailable * 0.5 },
            { label: '75%', value: totalAvailable * 0.75 },
            { label: 'Max', value: totalAvailable },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => setWithdrawAmount(chip.value > 0 ? (Math.floor(chip.value * 100) / 100).toFixed(2) : '')}
              disabled={totalAvailable <= 0}
              className="h-10 rounded-full bg-[var(--kraken-panel)] hover:bg-white/[0.06] border border-[var(--kraken-border)] text-[13px] font-semibold text-white/80 transition-colors duration-150 ease-out disabled:opacity-30 disabled:pointer-events-none active:scale-[0.97]"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* POL conversion line — subtle, no box */}
        {withdrawType === 'POL' && (
          <div className="mb-6 flex items-center justify-between text-[13px] tabular-nums">
            <span className="text-white/45">{t('withdraw.youWillReceive')}</span>
            <span className="font-semibold text-white">
              {(parseFloat(withdrawAmount) > 0 ? polAmount : (totalAvailable / polPrice).toFixed(4))} POL
              <span className="ml-2 text-white/35 font-normal">@ ${polPrice.toFixed(4)}</span>
            </span>
          </div>
        )}

        {/* Primary action — polygon CTA: bevel + purple glow */}
        <button
          onClick={handleWithdraw}
          disabled={withdrawing || !canWithdraw || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
          className="group relative w-full h-14 rounded-sm bg-[var(--poly-purple)] text-white font-semibold text-[15px] tracking-tight transition-colors duration-200 ease-out hover:bg-[var(--poly-purple-hover)] active:scale-[0.985] disabled:bg-white/[0.08] disabled:text-white/30 disabled:pointer-events-none shadow-cta-purple"
        >
          <span className="inline-flex items-center gap-2">
            {withdrawing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {tCommon('loading')}
              </>
            ) : (
              <>
                {withdrawType === 'POL'
                  ? t('withdraw.withdrawPol', { amount: polAmount })
                  : t('withdraw.withdrawUsdc')}
              </>
            )}
          </span>
        </button>

        <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-white/40">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t('withdraw.polNote')}</span>
        </p>
      </BevelCard>

      {/* ── Earnings Details (collapsible) ───────────────────────────────── */}
      <Collapsible
        title="Earnings Details"
        icon={<Wallet className="w-3.5 h-3.5" />}
        preview={hasWallet ? `$${totalAvailable.toFixed(2)}` : '$—'}
        open={earningsDetailsOpen}
        onOpenChange={setEarningsDetailsOpen}
      >

      {/* ── Balance + Next Distribution ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Balance / Tier — hero card */}
        <section className="kraken-summary lg:col-span-2 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <EyebrowTag>{t('usdcBalance')}</EyebrowTag>
              <div className="mt-2">
                {hasWallet
                  ? <MonoStat
                      size="main"
                      prefix="$"
                      value={usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    />
                  : <span className="text-[44px] sm:text-[52px] leading-none font-semibold text-white/30 tracking-tight tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>$—</span>}
              </div>
            </div>
            {currentTier && hasWallet && (
              <span className="kraken-pill inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-semibold text-white">
                <Star className="w-3.5 h-3.5 text-white/60 fill-white/60" />
                {currentTier.name}
              </span>
            )}
          </div>

          {hasWallet ? (
            currentTier ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="kraken-mini-card p-4">
                  <EyebrowTag className="mb-1.5">{t('currentRate')}</EyebrowTag>
                  <p className="text-xl font-semibold text-white tracking-tight tabular-nums">
                    {currentTier.rate_percent}%
                    <span className="ml-1 text-[13px] font-normal text-white/40">
                      / {formatInterval(config?.interval_seconds || 86400)}
                    </span>
                  </p>
                </div>
                <div className="kraken-mini-card p-4">
                  <EyebrowTag className="mb-1.5">{t('estimatedDaily')}</EyebrowTag>
                  <p className="text-xl font-semibold text-[#00e28a] tracking-tight tabular-nums">
                    ${((usdcBalance * currentTier.rate_percent / 100) * (86400 / (config?.interval_seconds || 86400))).toFixed(4)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-white/50">{t('depositMore')}</p>
            )
          ) : (
            <p className="text-[13px] text-white/50">Connect wallet to see your tier and rates</p>
          )}

          {hasWallet && nextTier && usdcBalance < nextTier.min_usdc && (
            <p className="mt-5 text-[13px] text-white/55 leading-relaxed">
              {t('upgradeHint', { amount: (nextTier.min_usdc - usdcBalance).toFixed(2), tier: nextTier.name, rate: nextTier.rate_percent })}
            </p>
          )}
        </section>

        {/* Next Distribution */}
        <section className="kraken-panel p-6 flex flex-col">
          <EyebrowTag className="inline-flex items-center gap-1.5">
            <Timer className="w-3 h-3" />
            {t('nextDistribution')}
          </EyebrowTag>

          <div className="mt-3">
            {nextDistribution ? (
              <p className="text-3xl font-semibold text-white tracking-tight tabular-nums">
                {formatCountdown(nextDistribution.seconds_remaining)}
              </p>
            ) : (
              <p className="text-2xl font-semibold text-white/70 tracking-tight">{t('comingSoon')}</p>
            )}
          </div>

          {nextDistribution && (
            <div className="mt-5 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(0, 100 - (nextDistribution.seconds_remaining / (config?.interval_seconds || 86400)) * 100)}%` }}
              />
            </div>
          )}

          <p className="mt-auto pt-4 text-[12px] text-white/40">
            {t('distributionInterval', { interval: formatInterval(config?.interval_seconds || 86400) })}
          </p>
        </section>
      </div>

      {/* ── Stats — minimal monochrome cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Staking */}
        <div className="kraken-panel p-5">
          <EyebrowTag className="inline-flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('stakingEarnings')}</span>
          </EyebrowTag>
          <p className="mt-2.5 text-2xl font-semibold text-white tracking-tight tabular-nums">
            ${(profits?.total_earned_usdc || 0).toFixed(4)}
          </p>
        </div>

        {/* Referral */}
        <div className="kraken-panel p-5">
          <EyebrowTag className="inline-flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            <span>{t('referralCommission')}</span>
          </EyebrowTag>
          <p className="mt-2.5 text-2xl font-semibold text-white tracking-tight tabular-nums">
            ${(profits?.total_commission_earned || 0).toFixed(4)}
          </p>
        </div>

        {/* Available — expandable */}
        <button
          type="button"
          onClick={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
          aria-expanded={showEarningsBreakdown}
          className="kraken-panel text-left p-5 hover:bg-[#211a2d] transition-colors duration-150 ease-out"
        >
          <div className="flex items-center justify-between">
            <div>
              <EyebrowTag className="inline-flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{t('availableWithdraw')}</span>
              </EyebrowTag>
              <p className="mt-2.5 text-2xl font-semibold text-white tracking-tight tabular-nums">
                ${totalAvailable.toFixed(4)}
              </p>
            </div>
            {showEarningsBreakdown
              ? <ChevronUp className="w-4 h-4 text-white/40" />
              : <ChevronDown className="w-4 h-4 text-white/40" />}
          </div>

          {showEarningsBreakdown && (
            <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2 tabular-nums">
              <div className="flex justify-between text-[13px]">
                <span className="text-white/50">{t('stakingEarnings')}</span>
                <span className="text-white/80">${(profits?.total_earned_usdc || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-white/50">{t('referralCommission')}</span>
                <span className="text-white/80">${(profits?.total_commission_earned || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-white/50">{t('history.withdrawal')}</span>
                <span className="text-rose-300">−${(profits?.withdrawn_usdc || 0).toFixed(4)}</span>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Earning Details — income composition */}
      {breakdown && (breakdown.last_round.total > 0 || breakdown.lifetime.total > 0) && (
        <div ref={breakdownRef} className="kraken-panel p-6 scroll-mt-24">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5" />
            {t('breakdown.title')}
          </h2>

          {breakdown.last_round.total > 0 && (
            <div className="mb-5">
              <EyebrowTag>
                {t('breakdown.lastAirdrop')}
                {breakdown.last_round.date ? ` · ${new Date(breakdown.last_round.date).toLocaleDateString()}` : ''}
              </EyebrowTag>
              <div className="mt-2.5 space-y-1.5 tabular-nums">
                {[
                  { label: t('breakdown.agentic'), amount: breakdown.last_round.agentic },
                  { label: t('breakdown.alphaStake'), amount: breakdown.last_round.alpha },
                  { label: t('referralCommission'), amount: breakdown.last_round.commission },
                  { label: t('breakdown.communityDaily'), amount: breakdown.last_round.community },
                ].filter((r) => r.amount > 0).map((r) => (
                  <div key={r.label} className="flex justify-between text-[13px]">
                    <span className="text-white/50">{r.label}</span>
                    <span className="text-white/80">+${r.amount.toFixed(4)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 border-t border-white/[0.06] text-[13px] font-semibold">
                  <span className="text-white/70">{t('breakdown.total')}</span>
                  <span className="text-[#00e28a]">+${breakdown.last_round.total.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <EyebrowTag>{t('breakdown.lifetime')}</EyebrowTag>
            <div className="mt-2.5 space-y-1.5 tabular-nums">
              {[
                { label: t('breakdown.agentic'), amount: breakdown.lifetime.agentic },
                { label: t('breakdown.alphaStake'), amount: breakdown.lifetime.alpha },
                { label: t('referralCommission'), amount: breakdown.lifetime.commission },
                { label: t('breakdown.communityDaily'), amount: breakdown.lifetime.community },
                { label: t('breakdown.lottery'), amount: breakdown.lifetime.lottery },
              ].filter((r) => r.amount > 0).map((r) => (
                <div key={r.label} className="flex justify-between text-[13px]">
                  <span className="text-white/50">{r.label}</span>
                  <span className="text-white/80">${r.amount.toFixed(4)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 border-t border-white/[0.06] text-[13px] font-semibold">
                <span className="text-white/70">{t('breakdown.total')}</span>
                <span className="text-white">${breakdown.lifetime.total.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Table */}
      <div className="kraken-panel p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5" />
          {t('tiers.title')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">{t('tiers.tier')}</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">{t('tiers.range')}</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">{t('tiers.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const tierIcons: Record<string, string> = {
                  'Visitor': '👁️',
                  'Resident': '🏠',
                  'Citizen': '🎖️',
                  'Representative': '📋',
                  'Senator': '🏛️',
                  'Ambassador': '🌐',
                  'Chancellor': '👑',
                  // Fallback for old names
                  'Bronze': '🥉',
                  'Silver': '🥈',
                  'Gold': '🥇',
                  'Platinum': '💎',
                  'Diamond': '💠',
                  'Elite': '👑',
                }
                const tierNames: Record<string, string> = {
                  'Bronze': 'Resident',
                  'Silver': 'Citizen',
                  'Gold': 'Representative',
                  'Platinum': 'Senator',
                  'Diamond': 'Ambassador',
                  'Elite': 'Chancellor',
                }
                const displayName = tierNames[tier.name] || tier.name
                const icon = tierIcons[displayName] || tierIcons[tier.name] || '⭐'
                
                return (
                  <tr key={tier.level} className={`border-b border-white/5 ${currentTier?.level === tier.level ? 'bg-purple-500/10' : ''}`}>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-zinc-300">
                        <span className="text-lg">{icon}</span>
                        {displayName}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-zinc-300 currency">${tier.min_usdc.toLocaleString()} - ${tier.max_usdc.toLocaleString()}</td>
                    <td className="py-3 text-sm font-semibold text-white percentage">{tier.rate_percent}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      </Collapsible>

      {/* ── Transaction History (collapsible) ────────────────────────────── */}
      <Collapsible
        title="Transaction History"
        icon={<History className="w-3.5 h-3.5" />}
        preview={`${withdrawals.length + history.length + commissions.length} records`}
      >

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="kraken-panel p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5" />
            {t('history.withdrawal')}
          </h2>
          <div className="space-y-2">
            {withdrawals.map((item) => {
              const statusStyles = {
                completed:  { dot: 'bg-[var(--poly-emerald)]',    pill: 'text-[var(--poly-emerald)] border-[var(--poly-emerald)]/30 bg-[var(--poly-emerald)]/[0.06]',  Icon: CheckCircle },
                processing: { dot: 'bg-[var(--poly-purple)]',     pill: 'text-[var(--poly-purple)] border-[var(--poly-purple)]/40 bg-[var(--poly-purple)]/[0.08]',  Icon: Loader2 },
                pending:    { dot: 'bg-white/40',                 pill: 'text-white/60 border-white/15 bg-white/[0.04]',                                              Icon: Clock },
                failed:     { dot: 'bg-rose-400',                 pill: 'text-rose-300 border-rose-400/30 bg-rose-500/[0.08]',                                        Icon: AlertCircle },
              }[item.status as 'completed' | 'processing' | 'pending' | 'failed'] ?? { dot: 'bg-white/40', pill: 'text-white/60 border-white/15 bg-white/[0.04]', Icon: Clock }
              const { Icon } = statusStyles
              return (
                <div key={item.id} className="bg-white/[0.04] border border-white/[0.06] p-4">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 flex items-center justify-center border border-white/15 shrink-0">
                        <Icon className={`w-4 h-4 text-white/85 ${item.status === 'processing' ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-white tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>
                          −{item.amount} {item.token_type}
                          {item.usd_amount && <span className="ml-2 text-[12px] text-white/45">(${item.usd_amount.toFixed(2)})</span>}
                        </p>
                        <span
                          className={`mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase border ${statusStyles.pill}`}
                          style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.1em' }}
                        >
                          <span className={`w-1.5 h-1.5 ${statusStyles.dot}`} />
                          {item.status === 'completed' ? t('history.completed') :
                           item.status === 'pending' ? t('history.pending') :
                           item.status === 'processing' ? t('history.processing') : t('history.failed')}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] text-white/45 shrink-0 text-right">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  {item.tx_hash && (
                    <div className="bg-white/[0.03] p-3 border border-white/[0.05]">
                      <EyebrowTag className="mb-1">{t('history.txHash')}</EyebrowTag>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-[11px] text-white/70 break-all" style={{ fontFamily: 'var(--poly-font-mono)' }}>{item.tx_hash}</code>
                        <a href={`https://polygonscan.com/tx/${item.tx_hash}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[var(--poly-purple)] hover:text-[var(--poly-purple-hover)]">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Combined Earnings History */}
      <div className="kraken-panel p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          {t('history.earnings')}
        </h2>
        {history.length === 0 && commissions.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">{t('history.noRecords')}</p>
        ) : (
          <div className="space-y-4">
            {(() => {
              // Group commissions by date (same day = one record)
              const commissionsByDate: Record<string, { total: number; created_at: string }> = {}
              commissions.forEach(item => {
                const dateKey = new Date(item.created_at).toDateString()
                if (!commissionsByDate[dateKey]) {
                  commissionsByDate[dateKey] = { total: 0, created_at: item.created_at }
                }
                commissionsByDate[dateKey].total += item.commission_amount
              })
              
              const groupedCommissions = Object.entries(commissionsByDate).map(([, data]) => ({
                type: 'commission' as const,
                id: `commission-${data.created_at}`,
                amount: data.total,
                created_at: data.created_at,
              }))

              return [
                ...history.map(item => ({ 
                  type: 'staking' as const, 
                  id: `staking-${item.id}`, 
                  amount: item.profit_earned, 
                  created_at: item.created_at, 
                  details: { usdc_balance: item.usdc_balance, rate_applied: item.rate_applied, tier_level: item.tier_level } 
                })),
                ...groupedCommissions
              ]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((item) => {
                  const isStaking = item.type === 'staking'
                  const TypeIcon = isStaking ? TrendingUp : Users
                  const tone = isStaking
                    ? { dot: 'bg-[var(--poly-emerald)]',  pill: 'text-[var(--poly-emerald)] border-[var(--poly-emerald)]/30 bg-[var(--poly-emerald)]/[0.06]',  amt: 'text-[var(--poly-emerald)]' }
                    : { dot: 'bg-[var(--poly-amber)]',    pill: 'text-[var(--poly-amber)] border-[var(--poly-amber)]/30 bg-[var(--poly-amber)]/[0.06]',      amt: 'text-[var(--poly-amber)]' }
                  return (
                    <div key={item.id} className="bg-white/[0.04] border border-white/[0.06] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 flex items-center justify-center border border-white/15 shrink-0">
                            <TypeIcon className="w-4 h-4 text-white/85" />
                          </div>
                          <div className="min-w-0">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase border ${tone.pill}`}
                              style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.1em' }}
                            >
                              <span className={`w-1.5 h-1.5 ${tone.dot}`} />
                              {isStaking ? t('stakingEarnings') : t('referralCommission')}
                            </span>
                            <p className={`mt-1 text-[15px] font-semibold tabular-nums ${tone.amt}`} style={{ fontFamily: 'var(--poly-font-mono)' }}>
                              +${item.amount.toFixed(6)} USDC
                            </p>
                          </div>
                        </div>
                        <p className="text-[12px] text-white/45 shrink-0 text-right">{new Date(item.created_at).toLocaleString()}</p>
                      </div>

                      {item.type === 'staking' && 'details' in item && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <EyebrowTag>{t('history.snapshotBalance')}</EyebrowTag>
                              <p className="mt-1 text-[13px] text-white/85 tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>${(item.details as { usdc_balance: number }).usdc_balance.toFixed(2)}</p>
                            </div>
                            <div>
                              <EyebrowTag>{t('history.appliedRate')}</EyebrowTag>
                              <p className="mt-1 text-[13px] text-white/85 tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>{((item.details as { rate_applied: number }).rate_applied * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <EyebrowTag>{t('history.formula')}</EyebrowTag>
                              <p className="mt-1 text-[13px] text-white/85" style={{ fontFamily: 'var(--poly-font-mono)' }}>${(item.details as { usdc_balance: number }).usdc_balance.toFixed(2)} × {((item.details as { rate_applied: number }).rate_applied * 100).toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {item.type === 'commission' && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <p className="text-[12px] text-white/50">Total commission earned from your referral network on this day</p>
                        </div>
                      )}
                    </div>
                  )
                })
            })()}
          </div>
        )}
      </div>
      </Collapsible>
    </div>
  )
}
