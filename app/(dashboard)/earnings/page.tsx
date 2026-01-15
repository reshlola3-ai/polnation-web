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
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAccount, useReadContract } from 'wagmi'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { polygon } from 'wagmi/chains'
import { formatUnits } from 'viem'

// 利润等级配置
const PROFIT_TIERS = [
  { level: 1, name: 'Bronze', min: 10, max: 20, rate: 0.25, color: 'text-amber-600', bg: 'bg-amber-500/20' },
  { level: 2, name: 'Silver', min: 20, max: 100, rate: 0.30, color: 'text-zinc-400', bg: 'bg-zinc-500/20' },
  { level: 3, name: 'Gold', min: 100, max: 500, rate: 0.35, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  { level: 4, name: 'Platinum', min: 500, max: 2000, rate: 0.40, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  { level: 5, name: 'Diamond', min: 2000, max: 10000, rate: 0.50, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { level: 6, name: 'Elite', min: 10000, max: 50000, rate: 0.60, color: 'text-purple-400', bg: 'bg-purple-500/20' },
]

interface ProfitData {
  total_earned_usdc: number
  available_usdc: number
  available_matic: number
  withdrawn_usdc: number
  withdrawn_matic: number
  current_tier: number
  last_calculated_at: string
}

interface HistoryItem {
  id: string
  usdc_balance: number
  tier_level: number
  rate_applied: number
  profit_earned: number
  period_end: string
}

interface WithdrawalItem {
  id: string
  token_type: string
  amount: number
  status: string
  created_at: string
  tx_hash: string | null
}

export default function EarningsPage() {
  const { address, isConnected } = useAccount()
  const [profits, setProfits] = useState<ProfitData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawType, setWithdrawType] = useState<'USDC' | 'MATIC'>('USDC')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 获取链上 USDC 余额
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw, 6)) : 0

  // 获取当前等级
  const currentTier = PROFIT_TIERS.find(t => usdcBalance >= t.min && usdcBalance < t.max)
  const nextTier = currentTier ? PROFIT_TIERS.find(t => t.level === currentTier.level + 1) : PROFIT_TIERS[0]

  const fetchProfits = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/profits/user')
      if (res.ok) {
        const data = await res.json()
        setProfits(data.profits)
        setHistory(data.history)
        setWithdrawals(data.withdrawals)
      }
    } catch (err) {
      console.error('Failed to fetch profits:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfits()
  }, [fetchProfits])

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    const available = withdrawType === 'USDC' 
      ? (profits?.available_usdc || 0) 
      : (profits?.available_matic || 0)

    if (parseFloat(withdrawAmount) > available) {
      setError('Insufficient balance')
      return
    }

    setWithdrawing(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/profits/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenType: withdrawType,
          amount: withdrawAmount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Withdrawal failed')
        return
      }

      setSuccess('Withdrawal request submitted!')
      setWithdrawAmount('')
      fetchProfits()
    } catch {
      setError('Network error')
    } finally {
      setWithdrawing(false)
    }
  }

  // 计算下次计算时间
  const getNextCalculationTime = () => {
    if (!profits?.last_calculated_at) return null
    const last = new Date(profits.last_calculated_at)
    const next = new Date(last.getTime() + 8 * 60 * 60 * 1000)
    return next
  }

  const nextCalc = getNextCalculationTime()
  const timeUntilNext = nextCalc ? Math.max(0, nextCalc.getTime() - Date.now()) : 0
  const hoursUntilNext = Math.floor(timeUntilNext / (60 * 60 * 1000))
  const minutesUntilNext = Math.floor((timeUntilNext % (60 * 60 * 1000)) / (60 * 1000))

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Wallet className="w-16 h-16 text-zinc-400 mb-4" />
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Connect Your Wallet</h2>
        <p className="text-zinc-500 text-center max-w-md">
          Connect your wallet and sign the authorization to start earning passive income.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Earnings</h1>
          <p className="text-zinc-500">Track your passive income from soft staking</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchProfits}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Current Tier & Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Balance & Tier */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-emerald-100 text-sm mb-1">Your USDC Balance</p>
              <p className="text-4xl font-bold">${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            {currentTier && (
              <div className={`px-3 py-1 rounded-full ${currentTier.bg} backdrop-blur`}>
                <span className="text-sm font-semibold flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {currentTier.name}
                </span>
              </div>
            )}
          </div>

          {currentTier ? (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-100">Current Rate</span>
                <span className="text-xl font-bold">{currentTier.rate}% / 8h</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-100">Est. Daily Earnings</span>
                <span className="font-semibold">
                  ${((usdcBalance * currentTier.rate / 100) * 3).toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-emerald-100 text-sm">
                Deposit at least $10 USDC to start earning
              </p>
            </div>
          )}

          {nextTier && usdcBalance < nextTier.min && (
            <div className="mt-4 text-sm text-emerald-100">
              <p>
                Deposit ${(nextTier.min - usdcBalance).toFixed(2)} more to reach{' '}
                <span className="font-semibold text-white">{nextTier.name}</span> tier ({nextTier.rate}%/8h)
              </p>
            </div>
          )}
        </div>

        {/* Next Calculation */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Next Earnings In</p>
              <p className="text-xl font-bold text-zinc-900">
                {hoursUntilNext}h {minutesUntilNext}m
              </p>
            </div>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${100 - (timeUntilNext / (8 * 60 * 60 * 1000)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Earnings calculated every 8 hours
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Earned</p>
              <p className="text-lg font-bold text-zinc-900">
                ${(profits?.total_earned_usdc || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Available USDC</p>
              <p className="text-lg font-bold text-emerald-600">
                ${(profits?.available_usdc || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Available MATIC</p>
              <p className="text-lg font-bold text-purple-600">
                {(profits?.available_matic || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Withdrawn</p>
              <p className="text-lg font-bold text-zinc-900">
                ${((profits?.withdrawn_usdc || 0) + (profits?.withdrawn_matic || 0)).toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5" />
          Withdraw Earnings
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Token Type */}
          <div>
            <label className="text-sm text-zinc-500 mb-2 block">Token</label>
            <div className="flex gap-2">
              <button
                onClick={() => setWithdrawType('USDC')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  withdrawType === 'USDC'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                USDC
              </button>
              <button
                onClick={() => setWithdrawType('MATIC')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  withdrawType === 'MATIC'
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                MATIC
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm text-zinc-500 mb-2 block">
              Amount (Available: {withdrawType === 'USDC' 
                ? `$${(profits?.available_usdc || 0).toFixed(4)}`
                : `${(profits?.available_matic || 0).toFixed(4)} MATIC`
              })
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount}
              className="w-full"
            >
              {withdrawing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowDownCircle className="w-4 h-4 mr-2" />
              )}
              Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* Tier Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5" />
          Earning Tiers
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">Tier</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">USDC Range</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">Rate / 8h</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">Daily Rate</th>
              </tr>
            </thead>
            <tbody>
              {PROFIT_TIERS.map((tier) => (
                <tr 
                  key={tier.level} 
                  className={`border-b border-zinc-50 ${
                    currentTier?.level === tier.level ? 'bg-emerald-50' : ''
                  }`}
                >
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${tier.bg} ${tier.color}`}>
                      <Star className="w-3 h-3" />
                      {tier.name}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-zinc-700">
                    ${tier.min.toLocaleString()} - ${tier.max.toLocaleString()}
                  </td>
                  <td className="py-3 text-sm font-semibold text-zinc-900">
                    {tier.rate}%
                  </td>
                  <td className="py-3 text-sm text-zinc-500">
                    {(tier.rate * 3).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Earning History
        </h2>
        {history.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No earnings yet</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    +${item.profit_earned.toFixed(6)} USDC
                  </p>
                  <p className="text-xs text-zinc-500">
                    Balance: ${item.usdc_balance.toFixed(2)} • Rate: {(item.rate_applied * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">
                    {new Date(item.period_end).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
