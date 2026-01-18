'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { 
  Shield, 
  LogOut, 
  RefreshCw,
  Users,
  Crown,
  Star,
  Zap,
  Trophy,
  FileSignature,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Gift,
  Calculator,
  Send,
  ClipboardList
} from 'lucide-react'

interface CommunityUser {
  user_id: string
  username: string | null
  email: string
  wallet_address: string | null
  real_level: number
  current_level: number
  is_admin_set: boolean
  is_influencer: boolean
  team_volume_l123: number
  total_community_earned: number
}

interface CommunityLevel {
  level: number
  name: string
  reward_pool: number
  daily_rate: number
  unlock_volume_normal: number
  unlock_volume_influencer: number
}

interface DailyEarningPreview {
  user_id: string
  username: string
  level: number
  level_name: string
  reward_pool: number
  daily_rate: number
  earning_amount: number
  already_earned_today: boolean
}

export default function AdminCommunityPage() {
  const router = useRouter()
  const [users, setUsers] = useState<CommunityUser[]>([])
  const [levels, setLevels] = useState<CommunityLevel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  
  // Daily earnings
  const [dailyPreview, setDailyPreview] = useState<DailyEarningPreview[] | null>(null)
  const [dailyTotalEarnings, setDailyTotalEarnings] = useState(0)
  const [calculatingDaily, setCalculatingDaily] = useState(false)
  const [distributingDaily, setDistributingDaily] = useState(false)

  // Edit level modal
  const [editingUser, setEditingUser] = useState<CommunityUser | null>(null)
  const [newLevel, setNewLevel] = useState(0)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/community')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await res.json()
      setUsers(data.users || [])
      setLevels(data.levels || [])
    } catch {
      setError('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const handleAction = async (userId: string, action: string, params?: Record<string, unknown>) => {
    setProcessing(userId)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: userId, ...params }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Operation failed')
        return
      }

      setSuccess(data.message || 'Success')
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(null)
    }
  }

  const handleCalculateDaily = async () => {
    setCalculatingDaily(true)
    setError('')
    setDailyPreview(null)

    try {
      const res = await fetch('/api/admin/community/daily-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: true }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Calculation failed')
        return
      }

      setDailyPreview(data.users || [])
      setDailyTotalEarnings(data.total_earnings || 0)
    } catch {
      setError('Network error')
    } finally {
      setCalculatingDaily(false)
    }
  }

  const handleDistributeDaily = async () => {
    if (!confirm('确认发放今日社群收益？')) return

    setDistributingDaily(true)
    setError('')

    try {
      const res = await fetch('/api/admin/community/daily-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: false }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Distribution failed')
        return
      }

      setSuccess(`成功发放！${data.processed_count} 位用户，总计 $${data.distributed_amount}`)
      setDailyPreview(null)
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setDistributingDaily(false)
    }
  }

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-amber-100 text-amber-700'
      case 2: return 'bg-slate-200 text-slate-700'
      case 3: return 'bg-yellow-100 text-yellow-700'
      case 4: return 'bg-cyan-100 text-cyan-700'
      case 5: return 'bg-purple-100 text-purple-700'
      case 6: return 'bg-rose-100 text-rose-700'
      default: return 'bg-zinc-100 text-zinc-700'
    }
  }

  const getLevelName = (level: number) => {
    const l = levels.find(lv => lv.level === level)
    return l?.name || 'None'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-zinc-400">Community Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Button>
              </Link>
              <Link href="/admin/airdrop">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Airdrop
                </Button>
              </Link>
              <Link href="/admin/signatures">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <FileSignature className="w-4 h-4 mr-2" />
                  Signatures
                </Button>
              </Link>
              <Link href="/admin/tasks">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Tasks
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

        {/* Daily Earnings Section */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              每日社群收益发放
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCalculateDaily}
                disabled={calculatingDaily}
                className="bg-purple-500 hover:bg-purple-600"
              >
                {calculatingDaily ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4 mr-2" />
                )}
                计算预览
              </Button>
              {dailyPreview && dailyPreview.filter(d => !d.already_earned_today).length > 0 && (
                <Button
                  size="sm"
                  onClick={handleDistributeDaily}
                  disabled={distributingDaily}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {distributingDaily ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  确认发放
                </Button>
              )}
            </div>
          </div>

          {dailyPreview && (
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-sm">预计发放总额</span>
                <span className="text-2xl font-bold text-green-400">${dailyTotalEarnings.toFixed(4)}</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {dailyPreview.map((item) => (
                  <div 
                    key={item.user_id}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                      item.already_earned_today ? 'bg-zinc-600/30 opacity-50' : 'bg-zinc-600/50'
                    }`}
                  >
                    <div>
                      <span className="text-white">{item.username}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${getLevelColor(item.level)}`}>
                        L{item.level} {item.level_name}
                      </span>
                      {item.already_earned_today && (
                        <span className="ml-2 text-xs text-amber-400">今日已发放</span>
                      )}
                    </div>
                    <span className="text-green-400 font-mono">
                      +${item.earning_amount.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <h2 className="text-white font-semibold">用户社群状态</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="border-zinc-600 text-zinc-400"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">用户</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">真实等级</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">当前等级</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">L1-L3 Volume</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">累计收益</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">状态</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.user_id} className="border-b border-zinc-700/50 hover:bg-zinc-700/20">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{user.username || 'Unknown'}</p>
                          <p className="text-zinc-500 text-xs">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${getLevelColor(user.real_level)}`}>
                          L{user.real_level} {getLevelName(user.real_level)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${getLevelColor(user.current_level)}`}>
                          L{user.current_level} {getLevelName(user.current_level)}
                        </span>
                        {user.is_admin_set && (
                          <span className="ml-1 text-xs text-amber-400">🎁</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-300 font-mono">
                          ${user.team_volume_l123.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-green-400 font-mono">
                          ${user.total_community_earned.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {user.is_influencer && (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                              ⭐ Influencer
                            </span>
                          )}
                          {user.is_admin_set && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                              手动设置
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Influencer Toggle */}
                          {user.is_influencer ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(user.user_id, 'remove_influencer')}
                              disabled={processing === user.user_id}
                              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20 text-xs px-2 py-1"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              取消Inf
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(user.user_id, 'set_influencer')}
                              disabled={processing === user.user_id}
                              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20 text-xs px-2 py-1"
                            >
                              <Star className="w-3 h-3 mr-1" />
                              设为Inf
                            </Button>
                          )}

                          {/* Set Level */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUser(user)
                              setNewLevel(user.current_level)
                            }}
                            disabled={processing === user.user_id}
                            className="border-purple-500 text-purple-400 hover:bg-purple-500/20 text-xs px-2 py-1"
                          >
                            <Crown className="w-3 h-3 mr-1" />
                            设等级
                          </Button>

                          {/* Restore Real Level */}
                          {user.is_admin_set && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(user.user_id, 'restore_real_level')}
                              disabled={processing === user.user_id}
                              className="border-zinc-500 text-zinc-400 hover:bg-zinc-500/20 text-xs px-2 py-1"
                            >
                              复原
                            </Button>
                          )}

                          {/* Refresh Volume */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(user.user_id, 'refresh_volume')}
                            disabled={processing === user.user_id}
                            className="border-zinc-600 text-zinc-400 hover:bg-zinc-600/20 text-xs px-2 py-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${processing === user.user_id ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Level Config Reference */}
        <div className="mt-6 bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">等级配置参考</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {levels.map((level) => (
              <div key={level.level} className={`p-3 rounded-lg ${getLevelColor(level.level)}`}>
                <p className="font-semibold">L{level.level} {level.name}</p>
                <p className="text-xs mt-1">奖励池: ${level.reward_pool}</p>
                <p className="text-xs">日利率: {(level.daily_rate * 100).toFixed(1)}%</p>
                <p className="text-xs">解锁: ${level.unlock_volume_normal}</p>
                <p className="text-xs">Inf: ${level.unlock_volume_influencer}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Edit Level Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-semibold mb-4">设置用户等级</h3>
            <p className="text-zinc-400 text-sm mb-4">
              用户: {editingUser.username || editingUser.email}
            </p>
            <p className="text-zinc-400 text-sm mb-4">
              真实等级: L{editingUser.real_level} {getLevelName(editingUser.real_level)}
            </p>
            
            <div className="mb-4">
              <label className="text-zinc-400 text-sm mb-2 block">选择等级</label>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white"
              >
                <option value={0}>Level 0 - None</option>
                {levels.map((level) => (
                  <option key={level.level} value={level.level}>
                    Level {level.level} - {level.name} (${level.reward_pool}, {(level.daily_rate * 100).toFixed(1)}%/day)
                  </option>
                ))}
              </select>
            </div>

            <p className="text-amber-400 text-xs mb-4">
              ⚠️ 手动设置的等级无法领取奖励池，但可以获得每日收益
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  handleAction(editingUser.user_id, 'set_level', { level: newLevel })
                  setEditingUser(null)
                }}
                className="flex-1 bg-purple-500 hover:bg-purple-600"
              >
                确认设置
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
                className="flex-1 border-zinc-600 text-zinc-400"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
