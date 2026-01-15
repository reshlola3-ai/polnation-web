'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
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
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'

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
  referrer: {
    username: string
    email: string
  } | null
  // 计算字段
  usdc_balance?: string
  team_count?: number
  team_usdc?: string
  has_signature?: boolean
  signature_valid?: boolean
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [error, setError] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'created_at' | 'usdc_balance' | 'team_count'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await res.json()
      setUsers(data.users || [])
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
        setUsers(prev => prev.map(user => ({
          ...user,
          usdc_balance: user.wallet_address ? (data.balances[user.wallet_address.toLowerCase()] || '0') : '0',
          team_usdc: data.teamBalances[user.id] || '0',
        })))
      }
    } catch {
      console.error('Failed to fetch balances')
    } finally {
      setLoadingBalances(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case 'usdc_balance':
        comparison = parseFloat(a.usdc_balance || '0') - parseFloat(b.usdc_balance || '0')
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
              <Link href="/admin/profits">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Profits
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
              ${stats.totalUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="created_at">Sort by Date</option>
              <option value="usdc_balance">Sort by USDC</option>
              <option value="team_count">Sort by Team Size</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white"
            >
              {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-3">
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

        {/* Table */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">User</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Wallet</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">USDC Balance</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Team</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Telegram</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Signature</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((user) => (
                    <>
                      <tr 
                        key={user.id} 
                        className="border-b border-zinc-700/50 hover:bg-zinc-700/20 cursor-pointer"
                        onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
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
                      </tr>
                      {/* Expanded Details */}
                      {expandedUser === user.id && (
                        <tr className="bg-zinc-800/30">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-zinc-500 text-xs mb-1">Referrer</p>
                                <p className="text-white">
                                  {user.referrer?.username || user.referrer?.email || 'None'}
                                </p>
                              </div>
                              <div>
                                <p className="text-zinc-500 text-xs mb-1">Country</p>
                                <p className="text-white">{user.country_code || '-'}</p>
                              </div>
                              <div>
                                <p className="text-zinc-500 text-xs mb-1">Phone</p>
                                <p className="text-white">
                                  {user.phone_country_code && user.phone_number 
                                    ? `${user.phone_country_code} ${user.phone_number}`
                                    : '-'
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-zinc-500 text-xs mb-1">Profile Status</p>
                                <p className={user.profile_completed ? 'text-green-400' : 'text-amber-400'}>
                                  {user.profile_completed ? 'Completed' : 'Incomplete'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
