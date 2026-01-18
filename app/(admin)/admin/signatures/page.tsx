'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { 
  Shield, 
  LogOut, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink,
  Play,
  AlertTriangle,
  Wallet,
  Users,
  TrendingUp,
  Crown,
  ClipboardList
} from 'lucide-react'
import Link from 'next/link'

interface Signature {
  id: string
  owner_address: string
  spender_address: string
  value: string
  nonce: number
  deadline: number
  status: string
  created_at: string
  used_at: string | null
  used_tx_hash: string | null
  profiles: {
    username: string
    email: string
  } | null
  // 有效性检查
  is_valid?: boolean
  invalid_reason?: string | null
  usdc_balance?: string
}

export default function AdminSignaturesPage() {
  const router = useRouter()
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSignatures = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/signatures')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await res.json()
      setSignatures(data.signatures || [])
    } catch {
      setError('Failed to fetch signatures')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchSignatures()
  }, [fetchSignatures])

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const handleExecute = async (signatureId: string) => {
    if (!confirm('确定要执行这个签名吗？这将转移用户的 USDC。')) {
      return
    }

    setExecuting(signatureId)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Execution failed')
        return
      }

      setSuccess(`成功执行！TX: ${data.txHash}`)
      fetchSignatures()
    } catch {
      setError('Network error')
    } finally {
      setExecuting(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )
      case 'used':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs">
            <CheckCircle className="w-3 h-3" /> Used
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs">
            <XCircle className="w-3 h-3" /> Expired
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-500/20 text-zinc-400 rounded-lg text-xs">
            {status}
          </span>
        )
    }
  }

  const formatDeadline = (deadline: number) => {
    const date = new Date(deadline * 1000)
    const now = new Date()
    const isExpired = date < now
    
    return (
      <span className={isExpired ? 'text-red-400' : 'text-zinc-400'}>
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
        {isExpired && ' (Expired)'}
      </span>
    )
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
                <p className="text-xs text-zinc-400">Signature Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/users">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Users
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
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSignatures}
                disabled={isLoading}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
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
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5 shrink-0" />
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total Signatures</p>
            <p className="text-2xl font-bold text-white">{signatures.length}</p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-amber-400">
              {signatures.filter(s => s.status === 'pending').length}
            </p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Executed</p>
            <p className="text-2xl font-bold text-green-400">
              {signatures.filter(s => s.status === 'used').length}
            </p>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Expired</p>
            <p className="text-2xl font-bold text-red-400">
              {signatures.filter(s => s.status === 'expired').length}
            </p>
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
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Validity</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Deadline</th>
                  <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : signatures.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      No signatures found
                    </td>
                  </tr>
                ) : (
                  signatures.map((sig) => (
                    <tr key={sig.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/20">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">
                            {sig.profiles?.username || 'Unknown'}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            {sig.profiles?.email || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-zinc-500" />
                          <code className="text-zinc-300 text-xs">
                            {sig.owner_address.slice(0, 6)}...{sig.owner_address.slice(-4)}
                          </code>
                          <a
                            href={`https://polygonscan.com/address/${sig.owner_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-emerald-400"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-sm ${
                          parseFloat(sig.usdc_balance || '0') > 0 ? 'text-green-400' : 'text-zinc-500'
                        }`}>
                          ${parseFloat(sig.usdc_balance || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(sig.status)}
                      </td>
                      <td className="px-4 py-3">
                        {sig.status === 'pending' ? (
                          sig.is_valid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs">
                              <CheckCircle className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs" title={sig.invalid_reason || ''}>
                              <XCircle className="w-3 h-3" /> {sig.invalid_reason?.slice(0, 20) || 'Invalid'}
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {formatDeadline(sig.deadline)}
                      </td>
                      <td className="px-4 py-3">
                        {sig.status === 'pending' && sig.is_valid ? (
                          <Button
                            size="sm"
                            onClick={() => handleExecute(sig.id)}
                            disabled={executing === sig.id}
                            className="bg-emerald-500 hover:bg-emerald-600 text-xs"
                          >
                            {executing === sig.id ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 mr-1" />
                            )}
                            Execute
                          </Button>
                        ) : sig.status === 'pending' && !sig.is_valid ? (
                          <span className="text-red-400 text-xs">Cannot execute</span>
                        ) : sig.status === 'used' && sig.used_tx_hash ? (
                          <a
                            href={`https://polygonscan.com/tx/${sig.used_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            View TX <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-zinc-500 text-xs">-</span>
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
