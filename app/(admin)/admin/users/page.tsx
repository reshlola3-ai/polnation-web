'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { WithdrawalsNavLink } from '@/components/admin/WithdrawalsNavLink'
import {
  Shield, 
  LogOut, 
  RefreshCw, 
  Users,
  Wallet,
  ExternalLink,
  CheckCircle,
  XCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  FileSignature,
  TrendingUp,
  Crown,
  ClipboardList,
  ChevronRight,
  Megaphone,
  Lock,
  Search,
  X,
} from 'lucide-react'
import Link from 'next/link'

// ISO-2 country code → "🇲🇦 MA". Returns '' when unknown.
function countryWithFlag(cc: string | null | undefined) {
  if (!cc || cc.length !== 2) return ''
  const flag = [...cc.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
  return `${flag} ${cc.toUpperCase()}`
}

interface User {
  id: string
  username: string
  email: string
  phone_country_code: string | null
  phone_number: string | null
  country_code: string | null
  telegram_username: string | null
  wallet_address: string | null
  wallet_bound_at: string | null
  profile_completed: boolean
  created_at: string
  last_login_ip: string | null
  last_login_country: string | null
  referrer: {
    username: string
    email: string
  } | null
  // 计算字段
  usdc_balance?: string // 钱包 USDC + 未平仓质押本金 合计
  staked_usdc?: string // 其中的未平仓 AlphaStake 质押本金
  withdrawable_usdc?: number
  team_count?: number
  team_usdc?: string
  has_signature?: boolean
  signature_valid?: boolean
}

const BALANCES_CACHE_KEY = 'admin_users_balances_cache'

// 单个用户两次抓取之间的余额变动
interface BalanceChange {
  userId: string
  username: string
  email: string
  wallet: string
  prev: number
  next: number
  delta: number
}

// 把链上余额映射套用到用户列表（按钱包地址 / 用户 id 匹配，与列表顺序无关）
function applyBalances(
  list: User[],
  balances: Record<string, string>,
  teamBalances: Record<string, string>,
  staked: Record<string, string> = {}
): User[] {
  return list.map(user => ({
    ...user,
    usdc_balance: user.wallet_address ? (balances[user.wallet_address.toLowerCase()] || '0') : '0',
    staked_usdc: user.wallet_address ? (staked[user.wallet_address.toLowerCase()] || '0') : '0',
    team_usdc: teamBalances[user.id] || '0',
  }))
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [syncingWallets, setSyncingWallets] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; message: string } | null>(null)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'usdc_balance' | 'withdrawable_usdc' | 'team_count'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [balancesUpdatedAt, setBalancesUpdatedAt] = useState<number | null>(null)
  const [balanceChanges, setBalanceChanges] = useState<BalanceChange[] | null>(null)
  const [showChanges, setShowChanges] = useState(false)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('all') // 按最近登录 IP 国家筛选

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await res.json()
      let list: User[] = data.users || []
      // 若本地有上次拉取的余额缓存，刷新后先套用并显示（不重新发起链上查询）
      try {
        const cached = localStorage.getItem(BALANCES_CACHE_KEY)
        if (cached) {
          const { balances, teamBalances, staked, updatedAt } = JSON.parse(cached)
          if (balances && teamBalances) {
            list = applyBalances(list, balances, teamBalances, staked || {})
            setBalancesUpdatedAt(updatedAt || null)
            setSortBy('usdc_balance')
            setSortOrder('desc')
          }
        }
      } catch {
        // 缓存损坏则忽略，保持无余额状态
      }
      setUsers(list)
    } catch {
      setError('Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const fetchBalances = async () => {
    setLoadingBalances(true)
    try {
      const res = await fetch('/api/admin/users/balances')
      if (res.ok) {
        const data = await res.json()

        // 与上次抓取的余额对比，生成变动清单（需在覆盖缓存前读取旧值）
        let prevBalances: Record<string, string> | null = null
        try {
          const cached = localStorage.getItem(BALANCES_CACHE_KEY)
          if (cached) prevBalances = JSON.parse(cached).balances || null
        } catch {
          // 缓存损坏则视为无对比基准
        }
        if (prevBalances) {
          const changes: BalanceChange[] = []
          for (const u of users) {
            if (!u.wallet_address) continue
            const addr = u.wallet_address.toLowerCase()
            const prevV = parseFloat(prevBalances[addr] || '0')
            const nextV = parseFloat(data.balances[addr] || '0')
            const delta = nextV - prevV
            if (Math.abs(delta) >= 0.01) {
              changes.push({
                userId: u.id,
                username: u.username || 'Unknown',
                email: u.email,
                wallet: addr,
                prev: prevV,
                next: nextV,
                delta,
              })
            }
          }
          changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          setBalanceChanges(changes)
          setShowChanges(true)
        } else {
          setBalanceChanges(null)
        }

        setUsers(prev => applyBalances(prev, data.balances, data.teamBalances, data.staked || {}))
        // 持久化到本地，刷新后无需重新发起链上查询
        const updatedAt = Date.now()
        setBalancesUpdatedAt(updatedAt)
        try {
          localStorage.setItem(BALANCES_CACHE_KEY, JSON.stringify({
            balances: data.balances,
            teamBalances: data.teamBalances,
            staked: data.staked || {},
            updatedAt,
          }))
        } catch {
          // localStorage 不可用时忽略，仅本次会话内有效
        }
        // Auto-sort by wallet USDC balance, highest first
        setSortBy('usdc_balance')
        setSortOrder('desc')
      }
    } catch {
      console.error('Failed to fetch balances')
    } finally {
      setLoadingBalances(false)
    }
  }

  const syncWallets = async () => {
    setSyncingWallets(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_wallets' }),
      })
      if (res.ok) {
        const data = await res.json()
        setSyncResult({
          synced: data.synced,
          skipped: data.skipped,
          message: data.message,
        })
        // Refresh user list after sync
        fetchUsers()
      } else {
        setError('Failed to sync wallets')
      }
    } catch {
      setError('Failed to sync wallets')
    } finally {
      setSyncingWallets(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  // 各国家人数分布（按最近登录 IP 国家；null → 未知）
  const NO_COUNTRY = '—'
  const countryCounts = new Map<string, number>()
  for (const u of users) {
    const c = u.last_login_country || NO_COUNTRY
    countryCounts.set(c, (countryCounts.get(c) || 0) + 1)
  }
  const sortedCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])

  // 搜索过滤：用户名 / 邮箱 / 钱包地址 / Telegram（不区分大小写、子串匹配）+ IP 国家筛选
  const query = search.trim().toLowerCase()
  const filteredUsers = users.filter((u) => {
    if (countryFilter !== 'all' && (u.last_login_country || NO_COUNTRY) !== countryFilter) return false
    if (query && ![u.username, u.email, u.wallet_address, u.telegram_username].some((f) => f?.toLowerCase().includes(query))) return false
    return true
  })

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case 'usdc_balance':
        comparison = parseFloat(a.usdc_balance || '0') - parseFloat(b.usdc_balance || '0')
        break
      case 'withdrawable_usdc':
        comparison = (a.withdrawable_usdc || 0) - (b.withdrawable_usdc || 0)
        break
      case 'team_count':
        comparison = (a.team_count || 0) - (b.team_count || 0)
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const stats = {
    total: users.length,
    withWallet: users.filter(u => u.wallet_address).length,
    withSignature: users.filter(u => u.has_signature).length,
    totalUsdc: users.reduce((sum, u) => sum + parseFloat(u.usdc_balance || '0'), 0),
    totalStaked: users.reduce((sum, u) => sum + parseFloat(u.staked_usdc || '0'), 0),
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
                <p className="text-xs text-zinc-400">User Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/alpha-v2">
                <Button variant="outline" size="sm" className="border-emerald-700 text-emerald-300">
                  Alpha V2
                </Button>
              </Link>
              <Link href="/admin/alphastake">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  AlphaStake
                </Button>
              </Link>
              <WithdrawalsNavLink />
              <Link href="/admin/signatures">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <FileSignature className="w-4 h-4 mr-2" />
                  Signatures
                </Button>
              </Link>
              <Link href="/admin/airdrop">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Airdrop
                </Button>
              </Link>
              <Link href="/admin/community">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Community
                </Button>
              </Link>
              <Link href="/admin/tasks">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Tasks
                </Button>
              </Link>
              <Link href="/admin/promo">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
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
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Connected Wallets</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.withWallet}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">With Signatures</p>
            <p className="text-2xl font-bold text-amber-400">{stats.withSignature}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total USDC</p>
            <p className="text-2xl font-bold text-green-400">
              ${Math.max(0, stats.totalUsdc - 3000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {stats.totalStaked > 0 && (
              <p className="text-xs text-sky-400/80 mt-0.5">含质押 ${stats.totalStaked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / email / wallet / telegram"
                className="bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-zinc-500 w-72 focus:outline-none focus:border-emerald-600"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="created_at">Sort by Date</option>
              <option value="usdc_balance">Sort by USDC</option>
              <option value="withdrawable_usdc">Sort by Withdrawable</option>
              <option value="team_count">Sort by Team Size</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white"
            >
              {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {/* 按最近登录 IP 国家筛选（含各国人数）*/}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white max-w-[14rem]"
              title="按最近登录 IP 国家筛选"
            >
              <option value="all">🌍 所有国家 ({users.length})</option>
              {sortedCountries.map(([code, count]) => (
                <option key={code} value={code}>
                  {code === NO_COUNTRY ? '未知' : code} ({count})
                </option>
              ))}
            </select>
            {(query || countryFilter !== 'all') && (
              <span className="text-xs text-zinc-500 whitespace-nowrap">
                {filteredUsers.length} / {users.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={syncWallets}
              disabled={syncingWallets}
              className="border-amber-700 text-amber-300 hover:bg-amber-800/20"
            >
              <Users className={`w-4 h-4 mr-2 ${syncingWallets ? 'animate-pulse' : ''}`} />
              {syncingWallets ? 'Syncing...' : 'Sync Wallets from Signatures'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBalances}
              disabled={loadingBalances}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Wallet className={`w-4 h-4 mr-2 ${loadingBalances ? 'animate-pulse' : ''}`} />
              {loadingBalances ? 'Loading...' : 'Fetch Balances'}
            </Button>
            {balancesUpdatedAt && (
              <span className="text-xs text-zinc-500 whitespace-nowrap">
                余额更新于 {new Date(balancesUpdatedAt).toLocaleString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              disabled={isLoading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{syncResult.message}</span>
            </div>
            {syncResult.synced > 0 && (
              <p className="text-sm mt-1 text-emerald-300">
                Successfully bound {syncResult.synced} wallet(s) from permit signatures.
              </p>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">User</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Wallet</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">USDC Balance</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Withdrawable</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Team</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Telegram</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Signature</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Joined</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Last Login</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-zinc-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-zinc-700/50 hover:bg-zinc-700/20 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.username || 'Unknown'}</p>
                            <p className="text-zinc-500 text-xs">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.wallet_address ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <code className="text-zinc-300 text-xs">
                              {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                            </code>
                            <a
                              href={`https://polygonscan.com/address/${user.wallet_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-emerald-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-zinc-500">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">Not connected</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-sm ${
                          parseFloat(user.usdc_balance || '0') > 0 ? 'text-green-400' : 'text-zinc-500'
                        }`}>
                          ${parseFloat(user.usdc_balance || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {parseFloat(user.staked_usdc || '0') > 0 && (
                          <p className="text-[10px] text-sky-400/80 font-mono">含质押 ${parseFloat(user.staked_usdc || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-sm ${
                          (user.withdrawable_usdc || 0) > 0 ? 'text-emerald-400' : 'text-zinc-500'
                        }`}>
                          ${(user.withdrawable_usdc || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="text-white">{user.team_count || 0}</span>
                          <span className="text-zinc-500 text-xs ml-1">members</span>
                          {user.team_usdc && parseFloat(user.team_usdc) > 0 && (
                            <p className="text-green-400 text-xs">
                              ${parseFloat(user.team_usdc).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.telegram_username ? (
                          <a
                            href={`https://t.me/${user.telegram_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="w-4 h-4" />
                            @{user.telegram_username}
                          </a>
                        ) : (
                          <span className="text-zinc-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.has_signature ? (
                          user.signature_valid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs">
                              <CheckCircle className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs">
                              <XCircle className="w-3 h-3" /> Invalid
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-500 text-xs">No signature</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {user.last_login_ip || user.last_login_country ? (
                          <div className="leading-tight">
                            <div className="text-zinc-300">{countryWithFlag(user.last_login_country) || '-'}</div>
                            <code className="text-[11px] text-zinc-500">{user.last_login_ip || '-'}</code>
                          </div>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-zinc-500 inline" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Balance changes modal: shown after each Fetch Balances when a previous snapshot exists */}
      {showChanges && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowChanges(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-3 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                余额变动 {balanceChanges && balanceChanges.length > 0 ? `(${balanceChanges.length})` : ''}
              </h3>
              <button
                onClick={() => setShowChanges(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-zinc-800"
              >
                收起 ✕
              </button>
            </header>
            <div className="overflow-y-auto p-4 space-y-2">
              {!balanceChanges || balanceChanges.length === 0 ? (
                <p className="text-sm text-zinc-500">与上次抓取相比没有余额变化。</p>
              ) : (
                balanceChanges.map((c) => (
                  <div
                    key={c.userId}
                    className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 cursor-pointer hover:bg-zinc-700/40 transition-colors"
                    onClick={() => router.push(`/admin/users/${c.userId}`)}
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{c.username}</p>
                      <p className="text-zinc-500 text-xs">{c.email}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-semibold ${c.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {c.delta > 0 ? '+' : ''}{c.delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-zinc-500 text-xs font-mono">
                        ${c.prev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${c.next.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
