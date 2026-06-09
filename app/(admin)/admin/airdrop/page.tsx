'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { 
  Shield, 
  LogOut, 
  RefreshCw,
  Settings,
  Calculator,
  Send,
  Clock,
  Users,
  DollarSign,
  FileSignature,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Timer,
  TrendingUp,
  Edit2,
  Save,
  X,
  Crown,
  ClipboardList,
  Gift,
  ArrowDownToLine,
  History,
  ChevronDown,
  ChevronUp,
  Megaphone
} from 'lucide-react'

interface Config {
  interval_seconds: number
  min_withdrawal_usdc: number
  min_withdrawal_matic: number
  distributor_contract: string | null
  last_distribution_at: string | null
}

interface Tier {
  id: string
  level: number
  name: string
  min_usdc: number
  max_usdc: number
  rate_percent: number
  is_active: boolean
}

interface Countdown {
  next_allowed_at: string
  seconds_remaining: number
  hours: number
  minutes: number
  seconds: number
}

interface Calculation {
  user_id: string
  username: string
  email: string
  wallet_address: string
  usdc_balance: string
  tier: string
  rate: string
  profit: string
}

interface PendingRound {
  id: string
  round_number: number
  total_users: number
  total_usdc: number
  snapshot_at: string
  airdrop_calculations: Array<{
    user_id: string
    wallet_address: string
    usdc_balance: number
    tier_name: string
    rate_percent: number
    profit_usdc: number
  }>
}

interface MiniProfile {
  username: string | null
  email: string | null
}

interface HistoryRound {
  id: string
  round_number: number
  distributed_at: string | null
  snapshot_at: string | null
  total_users: number | null
  total_usdc: number | null
  commission_total: number
  commission_count: number
  community_total: number
  community_count: number
}

interface RoundDetail {
  round: { id: string; round_number: number; distributed_at: string | null; snapshot_at: string | null }
  airdrops: Array<{
    user_id: string
    usdc_balance: number
    tier_level: number
    rate_percent: number
    profit_usdc: number
    profile: MiniProfile | null
  }>
  commissions: Array<{
    beneficiary_id: string
    source_user_id: string
    level: number
    source_profit: number
    commission_rate: number
    commission_amount: number
    beneficiary: MiniProfile | null
    source: MiniProfile | null
  }>
  community: Array<{
    user_id: string
    level: number
    reward_pool: number
    daily_rate: number
    momentum_multiplier: number
    earning_amount: number
    profile: MiniProfile | null
  }>
}

export default function AirdropPage() {
  const router = useRouter()
  const [config, setConfig] = useState<Config | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [countdown, setCountdown] = useState<Countdown | null>(null)
  const [canCalculate, setCanCalculate] = useState(true)
  const [pendingRounds, setPendingRounds] = useState<PendingRound[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [distributing, setDistributing] = useState<string | null>(null)
  const [forceDistributing, setForceDistributing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 发放历史
  const [history, setHistory] = useState<HistoryRound[]>([])
  const [expandedRound, setExpandedRound] = useState<string | null>(null)
  const [roundDetails, setRoundDetails] = useState<Record<string, RoundDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 编辑状态
  const [editingTier, setEditingTier] = useState<number | null>(null)
  const [editingConfig, setEditingConfig] = useState(false)
  const [tempConfig, setTempConfig] = useState<Partial<Config>>({})
  const [tempTier, setTempTier] = useState<Partial<Tier>>({})

  // 预览结果
  const [previewResult, setPreviewResult] = useState<{
    round_id: string
    total_users: number
    total_usdc: string
    estimated_commissions: string
    commission_details: Array<{
      beneficiary: string
      source: string
      level: string
      amount: string
    }>
    calculations: Calculation[]
    community_earnings: {
      total_amount: string
      users_count: number
      details: Array<{
        username: string
        level: number
        level_name: string
        reward_pool: number
        daily_rate: number
        earning_amount: string
      }>
    }
  } | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 获取配置
      const configRes = await fetch('/api/admin/airdrop/config')
      if (configRes.status === 401) {
        router.push('/admin/login')
        return
      }
      const configData = await configRes.json()
      setConfig(configData.config)
      setTiers(configData.tiers || [])

      // 获取轮次状态
      const roundsRes = await fetch('/api/admin/airdrop/calculate')
      const roundsData = await roundsRes.json()
      setCountdown(roundsData.countdown)
      setCanCalculate(roundsData.can_calculate)
      setPendingRounds(roundsData.pending_rounds || [])

      // 获取发放历史
      const historyRes = await fetch('/api/admin/airdrop/history')
      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setHistory(historyData.rounds || [])
      }

    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  // 展开/收起某轮 → 懒加载逐人明细
  const toggleRound = useCallback(async (roundId: string) => {
    if (expandedRound === roundId) {
      setExpandedRound(null)
      return
    }
    setExpandedRound(roundId)
    if (!roundDetails[roundId]) {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/admin/airdrop/history?round_id=${roundId}`)
        if (res.ok) {
          const detail = await res.json()
          setRoundDetails((prev) => ({ ...prev, [roundId]: detail }))
        }
      } catch (err) {
        console.error('Error loading round detail:', err)
      } finally {
        setLoadingDetail(false)
      }
    }
  }, [expandedRound, roundDetails])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 倒计时更新
  useEffect(() => {
    if (!countdown || countdown.seconds_remaining <= 0) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (!prev || prev.seconds_remaining <= 0) {
          setCanCalculate(true)
          return null
        }
        const remaining = prev.seconds_remaining - 1
        return {
          ...prev,
          seconds_remaining: remaining,
          hours: Math.floor(remaining / 3600),
          minutes: Math.floor((remaining % 3600) / 60),
          seconds: remaining % 60,
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown?.seconds_remaining])

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const handleCalculate = async () => {
    setCalculating(true)
    setError('')
    setSuccess('')
    setPreviewResult(null)

    try {
      const res = await fetch('/api/admin/airdrop/calculate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Calculation failed')
        return
      }

      setPreviewResult({
        round_id: data.round_id,
        total_users: data.total_users,
        total_usdc: data.total_usdc,
        estimated_commissions: data.estimated_commissions || '0',
        commission_details: data.commission_details || [],
        calculations: data.calculations,
        community_earnings: data.community_earnings || { total_amount: '0', users_count: 0, details: [] },
      })
      const commissionMsg = parseFloat(data.estimated_commissions || '0') > 0 
        ? `，预计佣金: $${data.estimated_commissions}` 
        : ''
      const communityMsg = parseFloat(data.community_earnings?.total_amount || '0') > 0 
        ? `，社群池收益: $${data.community_earnings.total_amount} (${data.community_earnings.users_count}人)` 
        : ''
      setSuccess(`计算完成！${data.total_users} 位用户，总利润: $${data.total_usdc}${commissionMsg}${communityMsg}`)
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setCalculating(false)
    }
  }

  const handleForceDistribute = async () => {
    if (!confirm('【测试模式】跳过24小时限制，立即计算并发放奖励？')) return
    setForceDistributing(true)
    setError('')
    setSuccess('')
    setPreviewResult(null)
    try {
      // Step 1: calculate with force flag
      const calcRes = await fetch('/api/admin/airdrop/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const calcData = await calcRes.json()
      if (!calcRes.ok) {
        setError(calcData.error || 'Force calculate failed')
        return
      }

      // Step 2: immediately distribute
      const distRes = await fetch('/api/admin/airdrop/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: calcData.round_id }),
      })
      const distData = await distRes.json()
      if (!distRes.ok) {
        setError(distData.error || 'Force distribute failed')
        return
      }

      const commissionMsg = parseFloat(distData.total_commissions || '0') > 0
        ? `，佣金: $${parseFloat(distData.total_commissions).toFixed(6)}`
        : ''
      setSuccess(`[测试] 立即发放成功！${distData.distributed_count} 位用户，总计: $${distData.total_distributed}${commissionMsg}`)
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setForceDistributing(false)
    }
  }

  const handleDistribute = async (roundId: string) => {
    if (!confirm('确认发放此轮利润到所有用户账户？')) return

    setDistributing(roundId)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/airdrop/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: roundId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Distribution failed')
        return
      }

      const commissionMsg = parseFloat(data.total_commissions || '0') > 0 
        ? `，佣金: $${parseFloat(data.total_commissions).toFixed(6)} (${data.commission_count}笔)` 
        : ''
      const communityMsg = data.community_distribution && parseFloat(data.community_distribution.distributed_amount || '0') > 0
        ? `，社群池: $${parseFloat(data.community_distribution.distributed_amount).toFixed(4)} (${data.community_distribution.processed_count}人)` 
        : ''
      setSuccess(`发放成功！${data.distributed_count} 位用户，总计: $${data.total_distributed}${commissionMsg}${communityMsg}`)
      setPreviewResult(null)
      await fetchData()
      // 自动展开刚发放的这一轮明细
      setExpandedRound(roundId)
      try {
        const detailRes = await fetch(`/api/admin/airdrop/history?round_id=${roundId}`)
        if (detailRes.ok) {
          const detail = await detailRes.json()
          setRoundDetails((prev) => ({ ...prev, [roundId]: detail }))
        }
      } catch {
        // 明细加载失败不影响发放结果
      }
    } catch {
      setError('Network error')
    } finally {
      setDistributing(null)
    }
  }

  const handleCancelRound = async (roundId: string) => {
    if (!confirm('确认取消此轮空投？')) return

    try {
      const res = await fetch(`/api/admin/airdrop/distribute?round_id=${roundId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        setError('Cancel failed')
        return
      }

      setPreviewResult(null)
      fetchData()
    } catch {
      setError('Network error')
    }
  }

  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/admin/airdrop/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          ...tempConfig,
        }),
      })

      if (!res.ok) {
        setError('Failed to save config')
        return
      }

      setSuccess('配置已保存')
      setEditingConfig(false)
      fetchData()
    } catch {
      setError('Network error')
    }
  }

  const handleSaveTier = async (level: number) => {
    try {
      const res = await fetch('/api/admin/airdrop/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tier',
          level,
          ...tempTier,
        }),
      })

      if (!res.ok) {
        setError('Failed to save tier')
        return
      }

      setSuccess('等级已保存')
      setEditingTier(null)
      fetchData()
    } catch {
      setError('Network error')
    }
  }

  const formatInterval = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    if (hours >= 24) {
      return `${Math.floor(hours / 24)} 天`
    }
    return `${hours} 小时`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-zinc-400">Airdrop Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Button>
              </Link>
              <Link href="/admin/withdrawals">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                  Withdrawals
                </Button>
              </Link>
              <Link href="/admin/signatures">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <FileSignature className="w-4 h-4 mr-2" />
                  Signatures
                </Button>
              </Link>
              <Link href="/admin/community">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Crown className="w-4 h-4 mr-2" />
                  Community
                </Button>
              </Link>
              <Link href="/admin/tasks">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Tasks
                </Button>
              </Link>
              <Link href="/admin/promo">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Megaphone className="w-4 h-4 mr-2" />
                  Promo
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Countdown & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Countdown & Calculate */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Timer className="w-5 h-5 text-emerald-400" />
                  空投发放
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchData}
                  disabled={isLoading}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Countdown Display */}
              {countdown && countdown.seconds_remaining > 0 ? (
                <div className="bg-zinc-700/50 rounded-xl p-6 text-center mb-6">
                  <p className="text-zinc-400 text-sm mb-2">距离下次可发放</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="bg-zinc-800 rounded-lg px-4 py-2">
                      <p className="text-3xl font-bold text-white">{countdown.hours}</p>
                      <p className="text-xs text-zinc-500">小时</p>
                    </div>
                    <span className="text-2xl text-zinc-500">:</span>
                    <div className="bg-zinc-800 rounded-lg px-4 py-2">
                      <p className="text-3xl font-bold text-white">{countdown.minutes}</p>
                      <p className="text-xs text-zinc-500">分钟</p>
                    </div>
                    <span className="text-2xl text-zinc-500">:</span>
                    <div className="bg-zinc-800 rounded-lg px-4 py-2">
                      <p className="text-3xl font-bold text-white">{countdown.seconds}</p>
                      <p className="text-xs text-zinc-500">秒</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center mb-6">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-400 font-medium">可以进行新一轮计算</p>
                </div>
              )}

              {/* Calculate Button */}
              <Button
                onClick={handleCalculate}
                disabled={!canCalculate || calculating}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {calculating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4 mr-2" />
                )}
                计算利润 (预览)
              </Button>

              {/* Force Distribute — for testing only */}
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <Button
                  onClick={handleForceDistribute}
                  disabled={forceDistributing || calculating}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white"
                >
                  {forceDistributing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  立即发放 (测试 — 跳过24小时)
                </Button>
                <p className="text-center text-[10px] text-orange-500/60 mt-1">跳过冷却时间，直接计算并发放，仅用于测试</p>
              </div>

              {config?.last_distribution_at && (
                <p className="text-center text-xs text-zinc-500 mt-3">
                  上次发放: {new Date(config.last_distribution_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Preview Result */}
            {previewResult && (
              <div className="bg-zinc-800/50 border border-amber-500/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-700 bg-amber-500/10 flex items-center justify-between">
                  <h3 className="text-amber-400 font-semibold flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    预览结果 (未发放)
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDistribute(previewResult.round_id)}
                      disabled={distributing === previewResult.round_id}
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      {distributing === previewResult.round_id ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      确认发放
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelRound(previewResult.round_id)}
                      className="border-red-500 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      取消
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs">用户数</p>
                      <p className="text-xl font-bold text-white">{previewResult.total_users}</p>
                    </div>
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs">总利润</p>
                      <p className="text-xl font-bold text-emerald-400">${previewResult.total_usdc}</p>
                    </div>
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs">预计佣金</p>
                      <p className="text-xl font-bold text-amber-400">${previewResult.estimated_commissions}</p>
                    </div>
                  </div>

                  {/* 用户利润列表 */}
                  <div className="mb-4">
                    <h4 className="text-zinc-300 text-sm font-medium mb-2">📊 用户收益明细</h4>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-zinc-400 text-xs">
                            <th className="text-left py-2">用户</th>
                            <th className="text-right py-2">余额</th>
                            <th className="text-right py-2">等级</th>
                            <th className="text-right py-2">利润</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewResult.calculations.map((calc) => (
                            <tr key={calc.user_id} className="border-t border-zinc-700/50">
                              <td className="py-2">
                                <p className="text-white">{calc.username}</p>
                                <p className="text-zinc-500 text-xs">{calc.email}</p>
                              </td>
                              <td className="text-right text-zinc-300">${calc.usdc_balance}</td>
                              <td className="text-right">
                                <span className="text-xs px-2 py-0.5 bg-zinc-700 rounded text-zinc-300">
                                  {calc.tier} ({calc.rate})
                                </span>
                              </td>
                              <td className="text-right text-emerald-400 font-mono">+${calc.profit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 推荐佣金预览 */}
                  {previewResult.commission_details && previewResult.commission_details.length > 0 && (
                    <div>
                      <h4 className="text-zinc-300 text-sm font-medium mb-2">🎁 推荐佣金明细</h4>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-zinc-400 text-xs">
                              <th className="text-left py-2">获益者</th>
                              <th className="text-left py-2">来源</th>
                              <th className="text-right py-2">等级</th>
                              <th className="text-right py-2">佣金</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewResult.commission_details.map((comm, idx) => (
                              <tr key={idx} className="border-t border-zinc-700/50">
                                <td className="py-2 text-white">{comm.beneficiary}</td>
                                <td className="py-2 text-zinc-400">{comm.source}</td>
                                <td className="text-right">
                                  <span className="text-xs px-2 py-0.5 bg-amber-700/30 rounded text-amber-300">
                                    {comm.level}
                                  </span>
                                </td>
                                <td className="text-right text-amber-400 font-mono">+${comm.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 如果没有佣金，显示提示 */}
                  {(!previewResult.commission_details || previewResult.commission_details.length === 0) && (
                    <div className="text-zinc-500 text-sm text-center py-3 border-t border-zinc-700/50">
                      💡 暂无推荐佣金（可能用户没有上线关系或未配置佣金比例）
                    </div>
                  )}

                  {/* 社群池收益预览 */}
                  {previewResult.community_earnings && parseFloat(previewResult.community_earnings.total_amount || '0') > 0 && (
                    <div className="border-t border-zinc-700/50 pt-4 mt-4">
                      <h4 className="text-purple-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        社群池收益明细
                      </h4>
                      <div className="bg-purple-500/10 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-xs">预计发放总额</span>
                          <span className="text-xl font-bold text-purple-400">
                            ${parseFloat(previewResult.community_earnings.total_amount).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-zinc-500 text-xs">受益用户</span>
                          <span className="text-zinc-300 text-sm">{previewResult.community_earnings.users_count} 人</span>
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-zinc-400 text-xs">
                              <th className="text-left py-2">用户</th>
                              <th className="text-right py-2">等级</th>
                              <th className="text-right py-2">奖池</th>
                              <th className="text-right py-2">日利率</th>
                              <th className="text-right py-2">收益</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewResult.community_earnings.details.map((comm, idx) => (
                              <tr key={idx} className="border-t border-zinc-700/50">
                                <td className="py-2 text-white">{comm.username}</td>
                                <td className="text-right">
                                  <span className="text-xs px-2 py-0.5 bg-purple-700/30 rounded text-purple-300">
                                    L{comm.level} {comm.level_name}
                                  </span>
                                </td>
                                <td className="text-right text-zinc-300">${comm.reward_pool}</td>
                                <td className="text-right text-zinc-400">{(comm.daily_rate * 100).toFixed(1)}%</td>
                                <td className="text-right text-purple-400 font-mono">+${comm.earning_amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 如果没有社群收益，显示提示 */}
                  {(!previewResult.community_earnings || parseFloat(previewResult.community_earnings.total_amount || '0') <= 0) && (
                    <div className="text-zinc-500 text-sm text-center py-3 border-t border-zinc-700/50">
                      💡 暂无社群池收益（可能今日已发放或无符合条件的用户）
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Rounds */}
            {pendingRounds.length > 0 && !previewResult && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-700">
                  <h3 className="text-white font-semibold">待发放轮次</h3>
                </div>
                {pendingRounds.map((round) => (
                  <div key={round.id} className="p-4 border-b border-zinc-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">轮次 #{round.round_number}</p>
                        <p className="text-zinc-500 text-xs">
                          快照时间: {new Date(round.snapshot_at).toLocaleString()}
                        </p>
                        <p className="text-zinc-400 text-sm mt-1">
                          {round.total_users} 用户 · ${round.total_usdc?.toFixed(6)} USDC
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleDistribute(round.id)}
                          disabled={distributing === round.id}
                          className="bg-emerald-500 hover:bg-emerald-600"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          发放
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelRound(round.id)}
                          className="border-red-500 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 发放历史 */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <h3 className="text-white font-semibold">发放历史明细</h3>
                <span className="text-xs text-zinc-500">点击某轮展开逐人明细</span>
              </div>

              {history.length === 0 ? (
                <p className="px-4 py-6 text-sm text-zinc-500">暂无发放记录。</p>
              ) : (
                history.map((r) => {
                  const detail = roundDetails[r.id]
                  const isOpen = expandedRound === r.id
                  return (
                    <div key={r.id} className="border-b border-zinc-700/50">
                      {/* 轮次汇总行 */}
                      <button
                        onClick={() => toggleRound(r.id)}
                        className="w-full text-left p-4 hover:bg-zinc-700/20 transition-colors flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-white font-medium">
                            轮次 #{r.round_number}
                            <span className="ml-2 text-xs text-zinc-500 font-normal">
                              {r.distributed_at ? new Date(r.distributed_at).toLocaleString() : '-'}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
                            <span className="text-zinc-300">{r.total_users ?? 0} 用户</span>
                            <span className="text-green-400">
                              利润 ${Number(r.total_usdc || 0).toFixed(6)}
                            </span>
                            <span className="text-amber-300">
                              佣金 ${Number(r.commission_total || 0).toFixed(6)} ({r.commission_count}笔)
                            </span>
                            <span className="text-purple-300">
                              社群池 ${Number(r.community_total || 0).toFixed(4)} ({r.community_count}人)
                            </span>
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                        )}
                      </button>

                      {/* 展开的逐人明细 */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-4">
                          {!detail ? (
                            <p className="text-sm text-zinc-500 py-2">
                              {loadingDetail ? '加载中...' : '无明细'}
                            </p>
                          ) : (
                            <>
                              {/* 空投利润明细 */}
                              <div>
                                <h4 className="text-zinc-300 text-sm font-medium mb-2 flex items-center gap-1">
                                  <Gift className="w-3.5 h-3.5 text-emerald-400" /> 空投利润 ({detail.airdrops.length})
                                </h4>
                                {detail.airdrops.length === 0 ? (
                                  <p className="text-xs text-zinc-600">无</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-zinc-700">
                                    <table className="w-full text-xs">
                                      <thead className="bg-zinc-800/80 text-zinc-400">
                                        <tr>
                                          <th className="text-left px-3 py-2">用户</th>
                                          <th className="text-right px-3 py-2">USDC 余额</th>
                                          <th className="text-center px-3 py-2">档位</th>
                                          <th className="text-right px-3 py-2">费率</th>
                                          <th className="text-right px-3 py-2">到账利润</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.airdrops.map((a, i) => (
                                          <tr key={`${a.user_id}-${i}`} className="border-t border-zinc-700/50">
                                            <td className="px-3 py-2 text-zinc-200">{a.profile?.username || a.profile?.email || '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-zinc-300">${Number(a.usdc_balance).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-center text-zinc-400">L{a.tier_level}</td>
                                            <td className="px-3 py-2 text-right text-zinc-400">{Number(a.rate_percent)}%</td>
                                            <td className="px-3 py-2 text-right font-mono text-green-400">${Number(a.profit_usdc).toFixed(6)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* 推荐佣金明细 */}
                              <div>
                                <h4 className="text-zinc-300 text-sm font-medium mb-2 flex items-center gap-1">
                                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> 推荐佣金 ({detail.commissions.length})
                                </h4>
                                {detail.commissions.length === 0 ? (
                                  <p className="text-xs text-zinc-600">无</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-zinc-700">
                                    <table className="w-full text-xs">
                                      <thead className="bg-zinc-800/80 text-zinc-400">
                                        <tr>
                                          <th className="text-left px-3 py-2">受益人</th>
                                          <th className="text-left px-3 py-2">来源用户</th>
                                          <th className="text-center px-3 py-2">层级</th>
                                          <th className="text-right px-3 py-2">比例</th>
                                          <th className="text-right px-3 py-2">佣金</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.commissions.map((c, i) => (
                                          <tr key={`${c.beneficiary_id}-${i}`} className="border-t border-zinc-700/50">
                                            <td className="px-3 py-2 text-zinc-200">{c.beneficiary?.username || c.beneficiary?.email || '—'}</td>
                                            <td className="px-3 py-2 text-zinc-400">{c.source?.username || c.source?.email || '—'}</td>
                                            <td className="px-3 py-2 text-center text-zinc-400">L{c.level}</td>
                                            <td className="px-3 py-2 text-right text-zinc-400">{Number(c.commission_rate)}%</td>
                                            <td className="px-3 py-2 text-right font-mono text-amber-300">${Number(c.commission_amount).toFixed(6)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* 社群池收益明细 */}
                              <div>
                                <h4 className="text-zinc-300 text-sm font-medium mb-2 flex items-center gap-1">
                                  <Crown className="w-3.5 h-3.5 text-purple-400" /> 社群池收益 ({detail.community.length})
                                </h4>
                                {detail.community.length === 0 ? (
                                  <p className="text-xs text-zinc-600">无</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-zinc-700">
                                    <table className="w-full text-xs">
                                      <thead className="bg-zinc-800/80 text-zinc-400">
                                        <tr>
                                          <th className="text-left px-3 py-2">用户</th>
                                          <th className="text-center px-3 py-2">等级</th>
                                          <th className="text-right px-3 py-2">奖池</th>
                                          <th className="text-right px-3 py-2">日利率</th>
                                          <th className="text-center px-3 py-2">Momentum</th>
                                          <th className="text-right px-3 py-2">收益</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.community.map((c, i) => (
                                          <tr key={`${c.user_id}-${i}`} className="border-t border-zinc-700/50">
                                            <td className="px-3 py-2 text-zinc-200">{c.profile?.username || c.profile?.email || '—'}</td>
                                            <td className="px-3 py-2 text-center text-zinc-400">L{c.level}</td>
                                            <td className="px-3 py-2 text-right text-zinc-400">${Number(c.reward_pool).toFixed(0)}</td>
                                            <td className="px-3 py-2 text-right text-zinc-400">{(Number(c.daily_rate) * 100).toFixed(1)}%</td>
                                            <td className="px-3 py-2 text-center text-zinc-400">×{Number(c.momentum_multiplier).toFixed(1)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-purple-300">${Number(c.earning_amount).toFixed(6)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Configuration */}
          <div className="space-y-6">
            {/* System Config */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-400" />
                  系统配置
                </h3>
                {editingConfig ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveConfig} className="bg-emerald-500">
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingConfig(false)} className="border-zinc-600">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTempConfig(config || {})
                      setEditingConfig(true)
                    }}
                    className="border-zinc-600 text-zinc-400"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-zinc-400 text-xs">发放间隔</label>
                  {editingConfig ? (
                    <select
                      value={tempConfig.interval_seconds || 86400}
                      onChange={(e) => setTempConfig({ ...tempConfig, interval_seconds: parseInt(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
                    >
                      <option value={3600}>1 小时</option>
                      <option value={7200}>2 小时</option>
                      <option value={14400}>4 小时</option>
                      <option value={28800}>8 小时</option>
                      <option value={43200}>12 小时</option>
                      <option value={86400}>24 小时</option>
                      <option value={172800}>48 小时</option>
                    </select>
                  ) : (
                    <p className="text-white font-medium">{formatInterval(config?.interval_seconds || 86400)}</p>
                  )}
                </div>

                <div>
                  <label className="text-zinc-400 text-xs">最小提现 (USDC)</label>
                  {editingConfig ? (
                    <input
                      type="number"
                      step="0.01"
                      value={tempConfig.min_withdrawal_usdc || 0.1}
                      onChange={(e) => setTempConfig({ ...tempConfig, min_withdrawal_usdc: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
                    />
                  ) : (
                    <p className="text-white font-medium">${config?.min_withdrawal_usdc || 0.1}</p>
                  )}
                </div>

                <div>
                  <label className="text-zinc-400 text-xs">最小提现 (MATIC)</label>
                  {editingConfig ? (
                    <input
                      type="number"
                      step="0.01"
                      value={tempConfig.min_withdrawal_matic || 0.1}
                      onChange={(e) => setTempConfig({ ...tempConfig, min_withdrawal_matic: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
                    />
                  ) : (
                    <p className="text-white font-medium">{config?.min_withdrawal_matic || 0.1} MATIC</p>
                  )}
                </div>
              </div>
            </div>

            {/* Profit Tiers */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                利润等级
              </h3>

              <div className="space-y-2">
                {tiers.map((tier) => (
                  <div 
                    key={tier.level} 
                    className={`p-3 rounded-lg ${tier.is_active ? 'bg-zinc-700/50' : 'bg-zinc-700/20 opacity-50'}`}
                  >
                    {editingTier === tier.level ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tempTier.name || ''}
                            onChange={(e) => setTempTier({ ...tempTier, name: e.target.value })}
                            placeholder="名称"
                            className="flex-1 px-2 py-1 bg-zinc-600 border border-zinc-500 rounded text-white text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={tempTier.rate_percent || 0}
                            onChange={(e) => setTempTier({ ...tempTier, rate_percent: parseFloat(e.target.value) })}
                            placeholder="利率%"
                            className="w-20 px-2 py-1 bg-zinc-600 border border-zinc-500 rounded text-white text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={tempTier.min_usdc || 0}
                            onChange={(e) => setTempTier({ ...tempTier, min_usdc: parseFloat(e.target.value) })}
                            placeholder="最小"
                            className="flex-1 px-2 py-1 bg-zinc-600 border border-zinc-500 rounded text-white text-sm"
                          />
                          <span className="text-zinc-500 self-center">-</span>
                          <input
                            type="number"
                            value={tempTier.max_usdc || 0}
                            onChange={(e) => setTempTier({ ...tempTier, max_usdc: parseFloat(e.target.value) })}
                            placeholder="最大"
                            className="flex-1 px-2 py-1 bg-zinc-600 border border-zinc-500 rounded text-white text-sm"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleSaveTier(tier.level)} className="bg-emerald-500">
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTier(null)} className="border-zinc-600">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-zinc-600 rounded text-zinc-300">L{tier.level}</span>
                            <span className="text-white font-medium">{tier.name}</span>
                          </div>
                          <p className="text-zinc-400 text-xs mt-1">
                            ${tier.min_usdc} - ${tier.max_usdc}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">{tier.rate_percent}%</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTempTier(tier)
                              setEditingTier(tier.level)
                            }}
                            className="border-zinc-600 text-zinc-400 p-1"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
