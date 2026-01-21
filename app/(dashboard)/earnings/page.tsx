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
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
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

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw, 6)) : 0
  const currentTier = tiers.find(t => usdcBalance >= t.min_usdc && usdcBalance < t.max_usdc)
  const nextTier = currentTier ? tiers.find(t => t.level === currentTier.level + 1) : tiers[0]
  const totalAvailable = (profits?.available_usdc || 0)

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
  if (!isConnected && !boundWalletAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Wallet className="w-16 h-16 text-zinc-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">{tWallet('connect')}</h2>
        <p className="text-zinc-500 text-center max-w-md">{tWallet('signDesc')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Connect Wallet Banner - Show when user has bound wallet but not connected */}
      {!isConnected && boundWalletAddress && (
        <div className="glass-card-solid p-4 flex items-center gap-4 border-amber-500/30">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-300 font-medium">{tWallet('connect')}</p>
            <p className="text-amber-400/70 text-sm">Connect your wallet to see real-time USDC balance</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-500">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProfits} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {tCommon('refresh')}
        </Button>
      </div>

      {/* Current Tier & Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-purple-200 text-sm mb-1">{t('usdcBalance')}</p>
              {isConnected ? (
                <p className="text-4xl font-bold currency">${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              ) : (
                <p className="text-4xl font-bold text-purple-200">--</p>
              )}
            </div>
            {currentTier && isConnected && (
              <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur">
                <span className="text-sm font-semibold flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {currentTier.name}
                </span>
              </div>
            )}
          </div>

          {isConnected ? (
            currentTier ? (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">{t('currentRate')}</span>
                  <span className="text-xl font-bold percentage">{currentTier.rate_percent}% / {formatInterval(config?.interval_seconds || 86400)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-200">{t('estimatedDaily')}</span>
                  <span className="font-semibold currency">
                    ${((usdcBalance * currentTier.rate_percent / 100) * (86400 / (config?.interval_seconds || 86400))).toFixed(4)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-purple-200 text-sm">{t('depositMore')}</p>
              </div>
            )
          ) : (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-purple-200 text-sm">Connect wallet to see your tier and rates</p>
            </div>
          )}

          {isConnected && nextTier && usdcBalance < nextTier.min_usdc && (
            <div className="mt-4 text-sm text-purple-200">
              <p>{t('upgradeHint', { amount: (nextTier.min_usdc - usdcBalance).toFixed(2), tier: nextTier.name, rate: nextTier.rate_percent })}</p>
            </div>
          )}
        </div>

        {/* Next Distribution Countdown */}
        <div className="glass-card-solid p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Timer className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('nextDistribution')}</p>
              {nextDistribution ? (
                <p className="text-xl font-bold text-white font-mono">{formatCountdown(nextDistribution.seconds_remaining)}</p>
              ) : (
                <p className="text-lg font-bold text-purple-400">{t('comingSoon')}</p>
              )}
            </div>
          </div>
          {nextDistribution && (
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.max(0, 100 - (nextDistribution.seconds_remaining / (config?.interval_seconds || 86400)) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-zinc-400 mt-2">{t('distributionInterval', { interval: formatInterval(config?.interval_seconds || 86400) })}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('stakingEarnings')}</p>
              <p className="text-2xl font-bold text-white currency">${(profits?.total_earned_usdc || 0).toFixed(4)}</p>
            </div>
          </div>
        </div>

        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('referralCommission')}</p>
              <p className="text-2xl font-bold text-orange-400 currency">${(profits?.total_commission_earned || 0).toFixed(4)}</p>
            </div>
          </div>
        </div>

        <div 
          className="glass-card-solid p-5 cursor-pointer hover:border-purple-500/40 transition-all"
          onClick={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">{t('availableWithdraw')}</p>
                <p className="text-2xl font-bold text-purple-400 currency">${totalAvailable.toFixed(4)}</p>
              </div>
            </div>
            {showEarningsBreakdown ? <ChevronUp className="w-5 h-5 text-purple-400" /> : <ChevronDown className="w-5 h-5 text-purple-400" />}
          </div>
          
          {showEarningsBreakdown && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{t('stakingEarnings')}</span>
                <span className="font-semibold text-zinc-300 currency">${(profits?.total_earned_usdc || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{t('referralCommission')}</span>
                <span className="font-semibold text-zinc-300 currency">${(profits?.total_commission_earned || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{t('history.withdrawal')}</span>
                <span className="font-semibold text-red-400 currency">-${(profits?.withdrawn_usdc || 0).toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="glass-card-solid p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5" />
          {t('withdraw.title')}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 rounded-lg flex items-center gap-2 text-red-400 text-sm border border-red-500/20">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 rounded-lg flex items-center gap-2 text-green-400 text-sm border border-green-500/20">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-zinc-500 mb-2 block">{t('withdraw.token')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setWithdrawType('USDC')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  withdrawType === 'USDC'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-lg mb-1">💵</span>
                  <span>USDC</span>
                </div>
              </button>
              <button
                onClick={() => setWithdrawType('POL')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  withdrawType === 'POL'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-lg mb-1">🟣</span>
                  <span>POL</span>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-500 mb-2 block">{t('withdraw.amount')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={t('withdraw.minAmount', { amount: config?.min_withdrawal_usdc || 0.1 })}
                className="w-full pl-7 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {t('withdraw.available')}: ${totalAvailable.toFixed(4)}
              {withdrawType === 'POL' && polPrice > 0 && (
                <span className="text-purple-400 ml-2">≈ {(totalAvailable / polPrice).toFixed(4)} POL</span>
              )}
            </p>
            
            {withdrawType === 'POL' && (
              <div className="mt-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-purple-300">{t('withdraw.currentPrice')}</span>
                  <span className="text-sm font-semibold text-purple-400 currency">${polPrice.toFixed(4)}</span>
                </div>
                {withdrawAmount && parseFloat(withdrawAmount) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-300">{t('withdraw.youWillReceive')}</span>
                    <span className="text-lg font-bold text-purple-400 stat-number">{polAmount} POL</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-300">{t('withdraw.maxWithdraw')}</span>
                    <span className="text-lg font-bold text-purple-400 stat-number">{(totalAvailable / polPrice).toFixed(4)} POL</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              className="w-full py-3"
            >
              {withdrawing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
              {withdrawType === 'POL' ? t('withdraw.withdrawPol', { amount: polAmount }) : t('withdraw.withdrawUsdc')}
            </Button>
          </div>
        </div>

        <p className="text-xs text-zinc-400 mt-4">💡 {t('withdraw.polNote')}</p>
      </div>

      {/* Tier Table */}
      <div className="glass-card-solid p-6">
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
        <div className="glass-card-solid p-6">
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
      <div className="glass-card-solid p-6">
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
