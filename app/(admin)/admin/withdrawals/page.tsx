'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import {
  LogOut,
  RefreshCw,
  Users,
  Crown,
  TrendingUp,
  FileSignature,
  ClipboardList,
  ArrowDownToLine,
  ExternalLink,
  Trophy,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react'

interface WithdrawalProfile {
  username: string | null
  email: string | null
  wallet_address: string | null
}

interface Withdrawal {
  id: string
  user_id: string
  token_type: string
  amount: number | null
  usd_amount: number | null
  wallet_address: string | null
  status: string
  tx_hash: string | null
  error_message: string | null
  processed_at: string | null
  created_at: string
  profile: WithdrawalProfile | null
}

interface Summary {
  totalCompletedUsd: number
  totalCount: number
  userCount: number
  pendingUsd: number
  pendingCount: number
  failedCount: number
}

interface RankRow {
  user_id: string
  username: string | null
  email: string | null
  totalUsd: number
  count: number
  lastAt: string
}

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    completed: {
      cls: 'bg-green-500/20 text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
      label: 'Completed',
    },
    pending: {
      cls: 'bg-amber-500/20 text-amber-400',
      icon: <Clock className="w-3 h-3" />,
      label: 'Pending',
    },
    processing: {
      cls: 'bg-blue-500/20 text-blue-400',
      icon: <RefreshCw className="w-3 h-3" />,
      label: 'Processing',
    },
    failed: {
      cls: 'bg-red-500/20 text-red-400',
      icon: <XCircle className="w-3 h-3" />,
      label: 'Failed',
    },
  }
  const s = map[status] || { cls: 'bg-zinc-500/20 text-zinc-400', icon: null, label: status }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  )
}

export default function AdminWithdrawalsPage() {
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'processing' | 'failed'>('all')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/withdrawals')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await res.json()
      setWithdrawals(data.withdrawals || [])
      setSummary(data.summary || null)
    } catch {
      setError('Failed to fetch withdrawals')
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

  // 排行榜：每个用户只统计已完成的提现
  const ranking = useMemo<RankRow[]>(() => {
    const map = new Map<string, RankRow>()
    for (const w of withdrawals) {
      if (w.status !== 'completed') continue
      const existing = map.get(w.user_id)
      const amount = Number(w.usd_amount) || 0
      if (existing) {
        existing.totalUsd += amount
        existing.count += 1
        if (w.created_at > existing.lastAt) existing.lastAt = w.created_at
      } else {
        map.set(w.user_id, {
          user_id: w.user_id,
          username: w.profile?.username ?? null,
          email: w.profile?.email ?? null,
          totalUsd: amount,
          count: 1,
          lastAt: w.created_at,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalUsd - a.totalUsd)
  }, [withdrawals])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return withdrawals.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false
      if (q) {
        const hay = `${w.profile?.username || ''} ${w.profile?.email || ''} ${w.wallet_address || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [withdrawals, searchQuery, statusFilter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-zinc-400">Withdrawal History</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Button>
              </Link>
              <Link href="/admin/community">
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Crown className="w-4 h-4 mr-2" />
                  Community
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

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total Withdrawn</p>
            <p className="text-2xl font-bold text-green-400">
              {summary ? usd(summary.totalCompletedUsd) : '—'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">completed only</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Withdrawals</p>
            <p className="text-2xl font-bold text-white">{summary?.totalCount ?? '—'}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Withdrawers</p>
            <p className="text-2xl font-bold text-emerald-400">{summary?.userCount ?? '—'}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-amber-400">
              {summary ? usd(summary.pendingUsd) : '—'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">{summary?.pendingCount ?? 0} in flight</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Failed</p>
            <p className="text-2xl font-bold text-red-400">{summary?.failedCount ?? '—'}</p>
          </div>
        </div>

        {/* Top withdrawers */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-semibold">Top Withdrawers</h2>
            <span className="text-xs text-zinc-500 font-normal">by completed total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3 w-12">#</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">User</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Total Withdrawn</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Count</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3 pl-8">Last Withdrawal</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-zinc-500">Loading...</td></tr>
                ) : ranking.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-zinc-500">No completed withdrawals yet</td></tr>
                ) : (
                  ranking.map((r, i) => (
                    <tr
                      key={r.user_id}
                      className="border-b border-zinc-700/50 hover:bg-zinc-700/20 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/users/${r.user_id}`)}
                    >
                      <td className="px-4 py-3 text-zinc-500 font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{r.username || 'Unknown'}</p>
                        <p className="text-zinc-500 text-xs">{r.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">{usd(r.totalUsd)}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{r.count}</td>
                      <td className="px-4 py-3 pl-8 text-xs text-zinc-400">
                        {new Date(r.lastAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <h2 className="text-white font-semibold">
              All Withdrawals
              <span className="ml-2 text-xs text-zinc-500 font-normal">
                Showing {filtered.length} of {withdrawals.length}
              </span>
            </h2>
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

          {/* Filters */}
          <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-900/40 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="username / email / wallet"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-500"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">User</th>
                  <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3 pl-8">Status</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Wallet</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Tx</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-zinc-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-500">
                      {withdrawals.length === 0 ? 'No withdrawals found' : 'No withdrawals match the filters'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-zinc-700/50 hover:bg-zinc-700/20 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/users/${w.user_id}`)}
                    >
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(w.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-sm font-medium">{w.profile?.username || 'Unknown'}</p>
                        <p className="text-zinc-500 text-xs">{w.profile?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-green-400">{usd(Number(w.usd_amount) || 0)}</span>
                        <p className="text-[11px] text-zinc-500">{w.token_type}</p>
                      </td>
                      <td className="px-4 py-3 pl-8">
                        <StatusBadge status={w.status} />
                        {w.status === 'failed' && w.error_message && (
                          <p className="text-[11px] text-red-400/70 mt-1 max-w-[200px] truncate" title={w.error_message}>
                            {w.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {w.wallet_address ? (
                          <a
                            href={`https://polygonscan.com/address/${w.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-zinc-300 hover:text-green-400 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code>{w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}</code>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {w.tx_hash ? (
                          <a
                            href={`https://polygonscan.com/tx/${w.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code>{w.tx_hash.slice(0, 6)}...{w.tx_hash.slice(-4)}</code>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
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
