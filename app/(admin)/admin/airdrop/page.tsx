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
  X
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
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
    calculations: Calculation[]
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

    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [router])

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
        calculations: data.calculations,
      })
      setSuccess(`计算完成！${data.total_users} 位用户，总利润: $${data.total_usdc}`)
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setCalculating(false)
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

      setSuccess(`发放成功！${data.distributed_count} 位用户，总计: $${data.total_distributed}`)
      setPreviewResult(null)
      fetchData()
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
              <Link href="/admin/signatures">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <FileSignature className="w-4 h-4 mr-2" />
                  Signatures
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
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs">用户数</p>
                      <p className="text-xl font-bold text-white">{previewResult.total_users}</p>
                    </div>
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs">总利润</p>
                      <p className="text-xl font-bold text-emerald-400">${previewResult.total_usdc}</p>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
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
                      value={tempConfig.interval_seconds || 28800}
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
                    <p className="text-white font-medium">{formatInterval(config?.interval_seconds || 28800)}</p>
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
