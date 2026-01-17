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
  const [polPrice, setPolPrice] = useState<number>(0.5) // 默认 POL 价格
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false)

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

  // 可提现总金额（美元）
  const totalAvailable = (profits?.available_usdc || 0)

  // 计算 POL 数量
  const polAmount = withdrawAmount && polPrice > 0 
    ? (parseFloat(withdrawAmount) / polPrice).toFixed(4)
    : '0'

  // 获取 POL 价格 (使用 Polygonscan API)
  const fetchPolPrice = useCallback(async () => {
    try {
      // 从 Polygonscan 获取 MATIC/POL 价格
      const res = await fetch('https://api.polygonscan.com/api?module=stats&action=maticprice&apikey=XE6S22TS8EKJVSQAR44E8NB7D5CF8ZCXAV')
      if (res.ok) {
        const data = await res.json()
        if (data.status === '1' && data.result?.maticusd) {
          setPolPrice(parseFloat(data.result.maticusd))
        }
      }
    } catch (err) {
      console.error('Failed to fetch POL price:', err)
      // 如果 Polygonscan 失败，尝试 CoinGecko 作为备用
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd')
        if (res.ok) {
          const data = await res.json()
          if (data['matic-network']?.usd) {
            setPolPrice(data['matic-network'].usd)
          }
        }
      } catch {
        console.error('Backup price fetch also failed')
      }
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

    const minAmount = config?.min_withdrawal_usdc || 0.1

    if (parseFloat(withdrawAmount) < minAmount) {
      setError(`最低提现金额为 $${minAmount}`)
      return
    }

    if (parseFloat(withdrawAmount) > totalAvailable) {
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
          polAmount: withdrawType === 'POL' ? polAmount : undefined,
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

      {/* Stats Cards - 简化版 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Staking 收益 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Staking 收益</p>
              <p className="text-2xl font-bold text-zinc-900">
                ${(profits?.total_earned_usdc || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* 推荐佣金 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">推荐佣金</p>
              <p className="text-2xl font-bold text-orange-600">
                ${(profits?.total_commission_earned || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* 可提现金额 - 可点击展开 */}
        <div 
          className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 shadow-sm border border-emerald-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-emerald-700">可提现金额</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${totalAvailable.toFixed(4)}
                </p>
              </div>
            </div>
            {showEarningsBreakdown ? (
              <ChevronUp className="w-5 h-5 text-emerald-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          
          {/* 展开的详情 */}
          {showEarningsBreakdown && (
            <div className="mt-4 pt-4 border-t border-emerald-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">Staking 收益</span>
                <span className="font-semibold text-zinc-700">
                  ${(profits?.total_earned_usdc || 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">推荐佣金</span>
                <span className="font-semibold text-zinc-700">
                  ${(profits?.total_commission_earned || 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">已提现</span>
                <span className="font-semibold text-red-500">
                  -${(profits?.withdrawn_usdc || 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-emerald-200">
                <span className="text-emerald-700 font-medium">可用余额</span>
                <span className="font-bold text-emerald-600">
                  ${totalAvailable.toFixed(4)}
                </span>
              </div>
            </div>
          )}
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
            <label className="text-sm text-zinc-500 mb-2 block">提现代币</label>
            <div className="flex gap-2">
              <button
                onClick={() => setWithdrawType('USDC')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  withdrawType === 'USDC'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
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
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-lg mb-1">🟣</span>
                  <span>POL</span>
                </div>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm text-zinc-500 mb-2 block">
              提现金额 (美元)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`最低 ${config?.min_withdrawal_usdc || 0.1}`}
                className="w-full pl-7 pr-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              可用: ${totalAvailable.toFixed(4)}
              {withdrawType === 'POL' && polPrice > 0 && (
                <span className="text-purple-600 ml-2">
                  ≈ {(totalAvailable / polPrice).toFixed(4)} POL
                </span>
              )}
            </p>
            
            {/* POL 换算显示 */}
            {withdrawType === 'POL' && (
              <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-purple-600">当前 POL 价格</span>
                  <span className="text-sm font-semibold text-purple-700">${polPrice.toFixed(4)}</span>
                </div>
                {withdrawAmount && parseFloat(withdrawAmount) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-600">您将收到</span>
                    <span className="text-lg font-bold text-purple-700">{polAmount} POL</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-600">最多可提取</span>
                    <span className="text-lg font-bold text-purple-700">
                      {(totalAvailable / polPrice).toFixed(4)} POL
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              className={`w-full py-3 ${
                withdrawType === 'POL' 
                  ? 'bg-purple-500 hover:bg-purple-600' 
                  : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {withdrawing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowDownCircle className="w-4 h-4 mr-2" />
              )}
              {withdrawType === 'POL' ? `提现 ${polAmount} POL` : '提现 USDC'}
            </Button>
          </div>
        </div>

        <p className="text-xs text-zinc-400 mt-4">
          💡 选择 POL 提现时，系统会自动将等值美元兑换为 POL 发送到您的钱包
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
            <ArrowDownCircle className="w-5 h-5" />
            提现记录
          </h2>
          <div className="space-y-4">
            {withdrawals.map((item) => (
              <div key={item.id} className="border border-zinc-100 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.status === 'completed' ? 'bg-green-100' :
                      item.status === 'pending' ? 'bg-amber-100' :
                      item.status === 'processing' ? 'bg-blue-100' :
                      'bg-red-100'
                    }`}>
                      {item.status === 'completed' ? (
                        <CheckCircle className={`w-5 h-5 text-green-600`} />
                      ) : item.status === 'processing' ? (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      ) : item.status === 'pending' ? (
                        <Clock className="w-5 h-5 text-amber-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-zinc-900">
                        -{item.amount} {item.token_type}
                        {item.usd_amount && (
                          <span className="text-sm text-zinc-500 ml-2">
                            (${item.usd_amount.toFixed(2)})
                          </span>
                        )}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.status === 'completed' ? 'bg-green-100 text-green-700' :
                        item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        item.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.status === 'completed' ? '已完成' :
                         item.status === 'pending' ? '待处理' :
                         item.status === 'processing' ? '处理中' : '失败'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {new Date(item.created_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
                {item.tx_hash && (
                  <div className="bg-zinc-50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">交易哈希</p>
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-zinc-700 font-mono break-all">
                        {item.tx_hash}
                      </code>
                      <a
                        href={`https://polygonscan.com/tx/${item.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 flex-shrink-0 text-emerald-600 hover:text-emerald-700"
                      >
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          收益明细
        </h2>
        {history.length === 0 && commissions.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">暂无收益记录</p>
        ) : (
          <div className="space-y-4">
            {/* 合并并按时间排序 */}
            {[
              ...history.map(item => ({
                type: 'staking' as const,
                id: `staking-${item.id}`,
                amount: item.profit_earned,
                created_at: item.created_at,
                details: {
                  usdc_balance: item.usdc_balance,
                  rate_applied: item.rate_applied,
                  tier_level: item.tier_level,
                }
              })),
              ...commissions.map(item => ({
                type: 'commission' as const,
                id: `commission-${item.id}`,
                amount: item.commission_amount,
                created_at: item.created_at,
                details: {
                  level: item.level,
                  source_profit: item.source_profit,
                  commission_rate: item.commission_rate,
                  source_user: item.source_user,
                }
              }))
            ]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((item) => (
                <div 
                  key={item.id} 
                  className={`border rounded-xl p-4 ${
                    item.type === 'staking' 
                      ? 'border-emerald-100 bg-emerald-50/50' 
                      : 'border-orange-100 bg-orange-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.type === 'staking' ? 'bg-emerald-100' : 'bg-orange-100'
                      }`}>
                        {item.type === 'staking' ? (
                          <TrendingUp className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Users className="w-5 h-5 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            item.type === 'staking' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {item.type === 'staking' ? '📈 Staking 收益' : '🎁 推荐佣金'}
                          </span>
                          {item.type === 'commission' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                              L{(item.details as { level: number }).level}
                            </span>
                          )}
                        </div>
                        <p className={`text-lg font-bold ${
                          item.type === 'staking' ? 'text-emerald-600' : 'text-orange-600'
                        }`}>
                          +${item.amount.toFixed(6)} USDC
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {new Date(item.created_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  
                  {/* 详细信息 */}
                  <div className="mt-3 pt-3 border-t border-zinc-200/50">
                    {item.type === 'staking' ? (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs">快照余额</p>
                          <p className="font-medium text-zinc-700">
                            ${(item.details as { usdc_balance: number }).usdc_balance.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">适用利率</p>
                          <p className="font-medium text-zinc-700">
                            {((item.details as { rate_applied: number }).rate_applied * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">计算公式</p>
                          <p className="font-medium text-zinc-700">
                            ${(item.details as { usdc_balance: number }).usdc_balance.toFixed(2)} × {((item.details as { rate_applied: number }).rate_applied * 100).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs">来源用户</p>
                          <p className="font-medium text-zinc-700">
                            {(item.details as { source_user: { username: string } | null }).source_user?.username || '用户'}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">下线收益</p>
                          <p className="font-medium text-zinc-700">
                            ${(item.details as { source_profit: number }).source_profit.toFixed(4)}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">佣金比例</p>
                          <p className="font-medium text-zinc-700">
                            {(item.details as { commission_rate: number }).commission_rate}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
