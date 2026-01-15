'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { 
  Shield, 
  LogOut, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  Clock,
  Play,
  Users,
  FileSignature,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'

interface Withdrawal {
  id: string
  user_id: string
  token_type: string
  amount: number
  wallet_address: string
  status: string
  created_at: string
  profiles: {
    username: string
    email: string
  } | null
}

export default function AdminProfitsPage() {
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalWithdrawn: 0,
    pendingWithdrawals: 0,
  })

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/profits')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await res.json()
      setWithdrawals(data.withdrawals || [])
      setStats(data.stats || { totalEarned: 0, totalWithdrawn: 0, pendingWithdrawals: 0 })
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

  const handleCalculate = async () => {
    if (!confirm('手动触发利润计算？这将为所有符合条件的用户计算利润。')) {
      return
    }

    setCalculating(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/profits/calculate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Calculation failed')
        return
      }

      setSuccess(`计算完成！处理了 ${data.processed} 个用户，总利润: $${data.totalProfit}`)
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setCalculating(false)
    }
  }

  const handleProcessWithdrawal = async (withdrawalId: string, action: 'complete' | 'reject') => {
    setProcessing(withdrawalId)
    setError('')

    try {
      const res = await fetch('/api/admin/profits/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, action }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Processing failed')
        return
      }

      setSuccess(`Withdrawal ${action === 'complete' ? 'completed' : 'rejected'}`)
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(null)
    }
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
                <p className="text-xs text-zinc-400">Profit Management</p>
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
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total Earned (All Users)</p>
            <p className="text-2xl font-bold text-green-400">${stats.totalEarned.toFixed(2)}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total Withdrawn</p>
            <p className="text-2xl font-bold text-white">${stats.totalWithdrawn.toFixed(2)}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Pending Withdrawals</p>
            <p className="text-2xl font-bold text-amber-400">{stats.pendingWithdrawals}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex flex-col justify-center">
            <Button
              onClick={handleCalculate}
              disabled={calculating}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {calculating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Calculate Profits
            </Button>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Withdrawal Requests
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">User</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Token</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Wallet</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">Loading...</td>
                  </tr>
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">No withdrawal requests</td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/20">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{w.profiles?.username || 'Unknown'}</p>
                        <p className="text-zinc-500 text-xs">{w.profiles?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          w.token_type === 'USDC' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {w.token_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-mono">
                        {w.token_type === 'USDC' ? '$' : ''}{w.amount.toFixed(4)}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-zinc-400 text-xs">
                          {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          w.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          w.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {new Date(w.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {w.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleProcessWithdrawal(w.id, 'complete')}
                              disabled={processing === w.id}
                              className="bg-green-500 hover:bg-green-600 text-xs"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcessWithdrawal(w.id, 'reject')}
                              disabled={processing === w.id}
                              className="border-red-500 text-red-400 hover:bg-red-500/20 text-xs"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
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
