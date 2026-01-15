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
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAccount, useReadContract } from 'wagmi'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { polygon } from 'wagmi/chains'
import { formatUnits } from 'viem'

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
  const currentTier = tiers.find(t => usdcBalance >= t.min_usdc && usdcBalance < t.max_usdc)
  const nextTier = currentTier ? tiers.find(t => t.level === currentTier.level + 1) : tiers[0]

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

  // 倒计时更新
  useEffect(() => {
    if (!nextDistribution || nextDistribution.seconds_remaining <= 0) return

    const timer = setInterval(() => {
      setNextDistribution(prev => {
        if (!prev || prev.seconds_remaining <= 0) return null
        return {
          ...prev,
          seconds_remaining: prev.seconds_remaining - 1,
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [nextDistribution?.seconds_remaining])

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('请输入有效金额')
      return
    }

    const minAmount = withdrawType === 'USDC' 
      ? (config?.min_withdrawal_usdc || 0.1)
      : (config?.min_withdrawal_matic || 0.1)

    if (parseFloat(withdrawAmount) < minAmount) {
      setError(`最低提现金额为 ${minAmount} ${withdrawType}`)
      return
    }

    const available = withdrawType === 'USDC' 
      ? (profits?.available_usdc || 0) 
      : (profits?.available_matic || 0)

    if (parseFloat(withdrawAmount) > available) {
      setError('余额不足')
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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '提现失败')
        return
      }

      if (data.tx_hash) {
        setSuccess(`提现成功！交易哈希: ${data.tx_hash.slice(0, 10)}...`)
      } else {
        setSuccess('提现请求已提交，正在处理中...')
      }
      setWithdrawAmount('')
      fetchProfits()
    } catch {
      setError('网络错误')
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
    if (hours >= 24) {
      return `${Math.floor(hours / 24)} 天`
    }
    return `${hours} 小时`
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Wallet className="w-16 h-16 text-zinc-400 mb-4" />
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">连接钱包</h2>
        <p className="text-zinc-500 text-center max-w-md">
          连接钱包并签名授权后，即可开始赚取被动收益。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">收益</h1>
          <p className="text-zinc-500">跟踪您的 Soft Staking 被动收益</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchProfits}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Current Tier & Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Balance & Tier */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-emerald-100 text-sm mb-1">您的 USDC 余额</p>
              <p className="text-4xl font-bold">${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            {currentTier && (
              <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur">
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
                <span className="text-emerald-100">当前利率</span>
                <span className="text-xl font-bold">{currentTier.rate_percent}% / {formatInterval(config?.interval_seconds || 28800)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-100">预计每日收益</span>
                <span className="font-semibold">
                  ${((usdcBalance * currentTier.rate_percent / 100) * (86400 / (config?.interval_seconds || 28800))).toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-emerald-100 text-sm">
                至少存入 $10 USDC 开始赚取收益
              </p>
            </div>
          )}

          {nextTier && usdcBalance < nextTier.min_usdc && (
            <div className="mt-4 text-sm text-emerald-100">
              <p>
                再存入 ${(nextTier.min_usdc - usdcBalance).toFixed(2)} 即可升级到{' '}
                <span className="font-semibold text-white">{nextTier.name}</span> 等级 ({nextTier.rate_percent}%)
              </p>
            </div>
          )}
        </div>

        {/* Next Distribution Countdown */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Timer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">下次发放</p>
              {nextDistribution ? (
                <p className="text-xl font-bold text-zinc-900">
                  {formatCountdown(nextDistribution.seconds_remaining)}
                </p>
              ) : (
                <p className="text-lg font-bold text-emerald-600">即将发放</p>
              )}
            </div>
          </div>
          {nextDistribution && (
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ 
                  width: `${Math.max(0, 100 - (nextDistribution.seconds_remaining / (config?.interval_seconds || 28800)) * 100)}%` 
                }}
              />
            </div>
          )}
          <p className="text-xs text-zinc-400 mt-2">
            收益每 {formatInterval(config?.interval_seconds || 28800)} 发放一次
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Staking 收益</p>
              <p className="text-lg font-bold text-zinc-900">
                ${(profits?.total_earned_usdc || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">推荐佣金</p>
              <p className="text-lg font-bold text-orange-600">
                ${(profits?.total_commission_earned || 0).toFixed(4)}
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
              <p className="text-xs text-zinc-500">可提现 USDC</p>
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
              <p className="text-xs text-zinc-500">可提现 MATIC</p>
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
              <p className="text-xs text-zinc-500">已提现</p>
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
          提现收益
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
            <label className="text-sm text-zinc-500 mb-2 block">代币</label>
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
              金额 (可用: {withdrawType === 'USDC' 
                ? `$${(profits?.available_usdc || 0).toFixed(4)}`
                : `${(profits?.available_matic || 0).toFixed(4)} MATIC`
              })
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder={`最低 ${withdrawType === 'USDC' ? config?.min_withdrawal_usdc : config?.min_withdrawal_matic}`}
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
              提现
            </Button>
          </div>
        </div>

        <p className="text-xs text-zinc-400 mt-3">
          最低提现: USDC ${config?.min_withdrawal_usdc || 0.1} / MATIC {config?.min_withdrawal_matic || 0.1}
        </p>
      </div>

      {/* Tier Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5" />
          收益等级
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">等级</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">USDC 范围</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">利率</th>
                <th className="text-left text-xs font-medium text-zinc-500 pb-3">每日利率</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr 
                  key={tier.level} 
                  className={`border-b border-zinc-50 ${
                    currentTier?.level === tier.level ? 'bg-emerald-50' : ''
                  }`}
                >
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700">
                      <Star className="w-3 h-3" />
                      {tier.name}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-zinc-700">
                    ${tier.min_usdc.toLocaleString()} - ${tier.max_usdc.toLocaleString()}
                  </td>
                  <td className="py-3 text-sm font-semibold text-zinc-900">
                    {tier.rate_percent}%
                  </td>
                  <td className="py-3 text-sm text-zinc-500">
                    {(tier.rate_percent * (86400 / (config?.interval_seconds || 28800))).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            提现记录
          </h2>
          <div className="space-y-3">
            {withdrawals.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'completed' ? 'bg-green-500' :
                    item.status === 'pending' ? 'bg-amber-500' :
                    item.status === 'processing' ? 'bg-blue-500' :
                    'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {item.amount} {item.token_type}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.status === 'completed' ? 'bg-green-100 text-green-700' :
                    item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    item.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.status === 'completed' ? '已完成' :
                     item.status === 'pending' ? '待处理' :
                     item.status === 'processing' ? '处理中' : '失败'}
                  </span>
                  {item.tx_hash && (
                    <a
                      href={`https://polygonscan.com/tx/${item.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-emerald-600 hover:underline mt-1"
                    >
                      查看交易 <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commission History */}
      {commissions.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            推荐佣金记录
          </h2>
          <div className="space-y-3">
            {commissions.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    +${item.commission_amount.toFixed(6)} USDC
                  </p>
                  <p className="text-xs text-zinc-500">
                    来自 L{item.level} 下线 {item.source_user?.username || '用户'} • 
                    收益 ${item.source_profit.toFixed(4)} × {item.commission_rate}%
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">
                    L{item.level}
                  </span>
                  <p className="text-xs text-zinc-400 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Earnings History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Staking 收益记录
        </h2>
        {history.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">暂无收益记录</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    +${item.profit_earned.toFixed(6)} USDC
                  </p>
                  <p className="text-xs text-zinc-500">
                    余额: ${item.usdc_balance.toFixed(2)} • 利率: {(item.rate_applied * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">
                    {new Date(item.created_at).toLocaleString()}
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
