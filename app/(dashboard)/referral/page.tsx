'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getCountryByCode } from '@/lib/countries'
import { Referral } from '@/lib/types'
import { Users, User, DollarSign, Copy, Check, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

export default function ReferralPage() {
  const supabase = createClient()

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [filteredReferrals, setFilteredReferrals] = useState<Referral[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Stats
  const [totalTeamMembers, setTotalTeamMembers] = useState(0)
  const [level1Members, setLevel1Members] = useState(0)
  const [totalTeamVolume, setTotalTeamVolume] = useState(0)
  const [level1Volume, setLevel1Volume] = useState(0)

  // Filters
  const [levelFilter, setLevelFilter] = useState('all')
  const [usdcFilter, setUsdcFilter] = useState('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // 获取链上余额
  const fetchBalances = useCallback(async (referralList: Referral[]) => {
    const walletsToFetch = referralList.filter(r => r.wallet_address)
    
    if (walletsToFetch.length === 0) {
      return referralList.map(r => ({ ...r, usdc_balance: 0 }))
    }

    setLoadingBalances(true)

    try {
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http('https://polygon-rpc.com'),
      })

      const balancePromises = referralList.map(async (r) => {
        if (!r.wallet_address) {
          return { ...r, usdc_balance: 0 }
        }

        try {
          const balance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [r.wallet_address as `0x${string}`],
          })
          
          return {
            ...r,
            usdc_balance: parseFloat(formatUnits(balance, 6)),
          }
        } catch {
          return { ...r, usdc_balance: 0 }
        }
      })

      const results = await Promise.all(balancePromises)
      return results
    } catch (err) {
      console.error('Error fetching balances:', err)
      return referralList.map(r => ({ ...r, usdc_balance: 0 }))
    } finally {
      setLoadingBalances(false)
    }
  }, [])

  // 计算统计数据
  const calculateStats = useCallback((referralList: Referral[]) => {
    setTotalTeamMembers(referralList.length)
    setLevel1Members(referralList.filter(r => r.level === 1).length)
    
    const totalVol = referralList.reduce((sum, r) => sum + (r.usdc_balance || 0), 0)
    const l1Vol = referralList
      .filter(r => r.level === 1)
      .reduce((sum, r) => sum + (r.usdc_balance || 0), 0)
    
    setTotalTeamVolume(totalVol)
    setLevel1Volume(l1Vol)
  }, [])

  // 加载推荐列表
  const loadReferrals = useCallback(async () => {
    if (!supabase) return

    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      setUserId(user.id)

      // 获取所有下线
      const { data: referralData } = await supabase
        .rpc('get_all_referrals', { user_id: user.id })

      if (referralData && referralData.length > 0) {
        // 获取真实链上余额
        const referralsWithBalance = await fetchBalances(referralData)
        
        setReferrals(referralsWithBalance)
        setFilteredReferrals(referralsWithBalance)
        calculateStats(referralsWithBalance)
      } else {
        setReferrals([])
        setFilteredReferrals([])
        calculateStats([])
      }
    } catch (err) {
      console.error('Error loading referrals:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, fetchBalances, calculateStats])

  useEffect(() => {
    loadReferrals()
  }, [loadReferrals])

  // Apply filters
  useEffect(() => {
    let filtered = [...referrals]

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(r => r.level === parseInt(levelFilter))
    }

    // USDC filter
    if (usdcFilter === 'has_usdc') {
      filtered = filtered.filter(r => (r.usdc_balance || 0) > 0)
    } else if (usdcFilter === 'no_usdc') {
      filtered = filtered.filter(r => (r.usdc_balance || 0) === 0)
    }

    setFilteredReferrals(filtered)
    setCurrentPage(1)
  }, [levelFilter, usdcFilter, referrals])

  // 刷新余额
  const handleRefreshBalances = async () => {
    if (referrals.length === 0) return
    
    const refreshed = await fetchBalances(referrals)
    setReferrals(refreshed)
    calculateStats(refreshed)
  }

  // Get unique levels for filter
  const uniqueLevels = [...new Set(referrals.map(r => r.level))].sort()

  // Pagination
  const totalPages = Math.ceil(filteredReferrals.length / itemsPerPage)
  const paginatedReferrals = filteredReferrals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const copyReferralLink = () => {
    if (userId) {
      navigator.clipboard.writeText(`${window.location.origin}/register?ref=${userId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getContact = (referral: Referral) => {
    if (referral.telegram_username) {
      return `@${referral.telegram_username}`
    }
    if (referral.phone_number) {
      return `${referral.phone_country_code} ${referral.phone_number}`
    }
    return '-'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Referral Network</h1>
          <p className="text-zinc-600">View and manage your team</p>
        </div>
        <Button onClick={copyReferralLink} variant="outline" className="w-fit">
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy Referral Link'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Team Volume</p>
              <p className="text-lg font-bold text-zinc-900">
                ${totalTeamVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Level 1 Volume</p>
              <p className="text-lg font-bold text-zinc-900">
                ${level1Volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Team</p>
              <p className="text-lg font-bold text-zinc-900">{totalTeamMembers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Direct Referrals</p>
              <p className="text-lg font-bold text-zinc-900">{level1Members}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700">Filters:</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Select
                options={[
                  { value: 'all', label: 'All Levels' },
                  ...uniqueLevels.map(l => ({ value: l.toString(), label: `Level ${l}` }))
                ]}
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-32"
              />
              <Select
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'has_usdc', label: 'Has USDC' },
                  { value: 'no_usdc', label: 'No USDC' },
                ]}
                value={usdcFilter}
                onChange={(e) => setUsdcFilter(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshBalances}
            disabled={loadingBalances || referrals.length === 0}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingBalances ? 'animate-spin' : ''}`} />
            Refresh Balances
          </Button>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Staked
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Team
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paginatedReferrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No referrals found
                  </td>
                </tr>
              ) : (
                paginatedReferrals.map((referral) => {
                  const country = getCountryByCode(referral.country_code || '')
                  return (
                    <tr key={referral.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-zinc-900">{referral.username || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-2xl" title={country?.name}>
                          {country?.flag || '🌍'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {loadingBalances ? (
                          <span className="text-zinc-400">Loading...</span>
                        ) : (
                          <span className={`font-medium ${(referral.usdc_balance || 0) > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                            ${(referral.usdc_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-sm">
                        {getContact(referral)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                          L{referral.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {referral.team_count}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between">
            <p className="text-sm text-zinc-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredReferrals.length)} of {filteredReferrals.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
