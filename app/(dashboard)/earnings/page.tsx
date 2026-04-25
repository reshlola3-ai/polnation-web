'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Info
} from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { polygon } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'

interface ProfitTier {
  level: number
  name: string
  min_usdc: number
  max_usdc: number
  rate_percent: number
}

interface ProfitData {
  total_earned_usdc: number
  total_commission_earned: number
  available_usdc: number
  available_matic: number
  withdrawn_usdc: number
  withdrawn_matic: number
  current_tier: number | null
}

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
  const [tiers, setTiers] = useState<ProfitTier[]>([])
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
  const [success, setSuccess] = useState('')
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false)
  const [boundWalletAddress, setBoundWalletAddress] = useState<string | null>(null)

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
        setHistory(data.history)
        setCommissions(data.commissions || [])
        setWithdrawals(data.withdrawals)
        setTiers(data.tiers)
        setConfig(data.config)
        setNextDistribution(data.next_distribution)
        setBoundWalletAddress(data.wallet_address || null)
      }
    } catch (err) {
      console.error('Failed to fetch profits:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

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
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError(tErrors('invalidAmount'))
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
    setSuccess('')

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenType: withdrawType,
          amount: withdrawAmount,
          polAmount: withdrawType === 'POL' ? polAmount : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || tErrors('withdrawFailed'))
        return
      }

      if (data.tx_hash) {
        setSuccess(`${tCommon('success')}! TX: ${data.tx_hash.slice(0, 10)}...`)
      } else {
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
      {/* This banner is no longer needed since we use bound wallet address */}

      {/* ── Header — Apple-style ─────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Polnation · {t('title')}
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold text-white tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-[13px] text-white/50">{t('subtitle')}</p>
        </div>
        <button
          onClick={fetchProfits}
          disabled={isLoading}
          aria-label={tCommon('refresh')}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--kraken-panel-2)] border border-[var(--kraken-border)] text-[13px] font-semibold text-white hover:bg-[#2b2338] transition-colors duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {tCommon('refresh')}
        </button>
      </header>

      {/* ── Balance + Next Distribution ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Balance / Tier — hero card */}
        <section className="kraken-summary lg:col-span-2 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('usdcBalance')}
              </p>
              <p className="mt-2 text-[48px] sm:text-[56px] leading-none font-semibold text-white tracking-tight tabular-nums">
                {hasWallet
                  ? `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : <span className="text-white/30">$—</span>}
              </p>
            </div>
            {currentTier && hasWallet && (
              <span className="kraken-pill inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-semibold text-white">
                <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                {currentTier.name}
              </span>
            )}
          </div>

          {hasWallet ? (
            currentTier ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="kraken-mini-card p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-1.5">
                    {t('currentRate')}
                  </p>
                  <p className="text-xl font-semibold text-white tracking-tight tabular-nums">
                    {currentTier.rate_percent}%
                    <span className="ml-1 text-[13px] font-normal text-white/40">
                      / {formatInterval(config?.interval_seconds || 86400)}
                    </span>
                  </p>
                </div>
                <div className="kraken-mini-card p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-1.5">
                    {t('estimatedDaily')}
                  </p>
                  <p className="text-xl font-semibold text-emerald-400 tracking-tight tabular-nums">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 flex items-center gap-1.5">
            <Timer className="w-3 h-3" />
            {t('nextDistribution')}
          </p>

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
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('stakingEarnings')}</span>
          </div>
          <p className="mt-2.5 text-2xl font-semibold text-white tracking-tight tabular-nums">
            ${(profits?.total_earned_usdc || 0).toFixed(4)}
          </p>
        </div>

        {/* Referral */}
        <div className="kraken-panel p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
            <Users className="w-3.5 h-3.5" />
            <span>{t('referralCommission')}</span>
          </div>
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
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{t('availableWithdraw')}</span>
              </div>
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

      {/* ── Withdraw — Apple-style ──────────────────────────────────────── */}
      <section className="kraken-panel p-6 sm:p-7">

        <header className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {t('withdraw.title')}
          </p>
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
        {success && (
          <div role="status" aria-live="polite" className="mb-5 flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300 ring-1 ring-emerald-500/20">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* iOS segmented control */}
        <div className="mx-auto mb-7 grid grid-cols-2 w-full max-w-xs rounded-full bg-[var(--kraken-panel-2)] p-1 border border-[var(--kraken-border)]">
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
              className="min-w-0 max-w-[70%] bg-transparent border-0 outline-none text-center text-[64px] leading-none font-semibold text-white tracking-tight placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
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
              onClick={() => setWithdrawAmount(chip.value > 0 ? chip.value.toFixed(2) : '')}
              disabled={totalAvailable <= 0}
              className="h-10 rounded-full bg-[var(--kraken-panel-2)] hover:bg-[#2b2338] border border-[var(--kraken-border)] text-[13px] font-semibold text-white/80 transition-colors duration-150 ease-out disabled:opacity-30 disabled:pointer-events-none active:scale-[0.97]"
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

        {/* Primary action */}
        <button
          onClick={handleWithdraw}
          disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
          className="group relative w-full h-14 rounded-2xl bg-[var(--kraken-purple)] text-white font-semibold text-[15px] tracking-tight transition-all duration-200 ease-out hover:bg-[var(--kraken-purple-soft)] active:scale-[0.985] disabled:bg-white/[0.08] disabled:text-white/30 disabled:pointer-events-none"
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
      </section>

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

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="kraken-panel p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5" />
            {t('history.withdrawal')}
          </h2>
          <div className="space-y-4">
            {withdrawals.map((item) => (
              <div key={item.id} className="border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.status === 'completed' ? 'bg-green-500/20' :
                      item.status === 'pending' ? 'bg-amber-500/20' :
                      item.status === 'processing' ? 'bg-blue-500/20' : 'bg-red-500/20'
                    }`}>
                      {item.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-400" /> :
                       item.status === 'processing' ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" /> :
                       item.status === 'pending' ? <Clock className="w-5 h-5 text-amber-400" /> :
                       <AlertCircle className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white currency">
                        -{item.amount} {item.token_type}
                        {item.usd_amount && <span className="text-sm text-zinc-500 ml-2 currency">(${item.usd_amount.toFixed(2)})</span>}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        item.status === 'processing' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {item.status === 'completed' ? t('history.completed') :
                         item.status === 'pending' ? t('history.pending') :
                         item.status === 'processing' ? t('history.processing') : t('history.failed')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                {item.tx_hash && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">{t('history.txHash')}</p>
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-zinc-300 font-mono break-all">{item.tx_hash}</code>
                      <a href={`https://polygonscan.com/tx/${item.tx_hash}`} target="_blank" rel="noopener noreferrer" className="ml-2 flex-shrink-0 text-purple-400 hover:text-purple-300">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
                .map((item) => (
                  <div key={item.id} className={`border rounded-xl p-4 ${item.type === 'staking' ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'staking' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                          {item.type === 'staking' ? <TrendingUp className="w-5 h-5 text-green-400" /> : <Users className="w-5 h-5 text-orange-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.type === 'staking' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {item.type === 'staking' ? `📈 ${t('stakingEarnings')}` : `🎁 ${t('referralCommission')}`}
                            </span>
                          </div>
                          <p className={`text-lg font-bold currency ${item.type === 'staking' ? 'text-green-400' : 'text-orange-400'}`}>+${item.amount.toFixed(6)} USDC</p>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    
                    {item.type === 'staking' && 'details' in item && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-zinc-500 text-xs">{t('history.snapshotBalance')}</p>
                            <p className="font-medium text-zinc-300 currency">${(item.details as { usdc_balance: number }).usdc_balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 text-xs">{t('history.appliedRate')}</p>
                            <p className="font-medium text-zinc-300 percentage">{((item.details as { rate_applied: number }).rate_applied * 100).toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 text-xs">{t('history.formula')}</p>
                            <p className="font-medium text-zinc-300 font-mono">${(item.details as { usdc_balance: number }).usdc_balance.toFixed(2)} × {((item.details as { rate_applied: number }).rate_applied * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {item.type === 'commission' && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-zinc-500 text-xs">Total commission earned from your referral network on this day</p>
                      </div>
                    )}
                  </div>
                ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
