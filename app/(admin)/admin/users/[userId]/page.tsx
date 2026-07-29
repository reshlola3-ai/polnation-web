'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  User as UserIcon,
  Users,
  Wallet,
  ExternalLink,
  CheckCircle,
  XCircle,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Gift,
  Crown,
  Clock,
  Mail,
  Phone,
  Globe,
  Calendar,
  TrendingUp,
  ArrowDownToLine,
} from 'lucide-react'

interface ProfileData {
  id: string
  username: string | null
  email: string
  phone_country_code: string | null
  phone_number: string | null
  country_code: string | null
  telegram_username: string | null
  wallet_address: string | null
  wallet_bound_at: string | null
  profile_completed: boolean
  created_at: string
  updated_at: string
  auth_created_at: string | null
  last_sign_in_at: string | null
  last_login_ip: string | null
  last_login_country: string | null
  last_login_city: string | null
  last_login_at: string | null
  referrer: { id: string; username: string | null; email: string | null } | null
}

interface LoginEvent {
  ip: string | null
  country: string | null
  city: string | null
  user_agent: string | null
  created_at: string
}

interface UplineEntry {
  id: string
  username: string | null
  email: string | null
  level: number
}

interface DownlineEntry {
  id: string
  username: string | null
  email: string | null
  country_code: string | null
  telegram_username: string | null
  wallet_address: string | null
  created_at: string
  level: number
  team_count: number
}

interface LotteryRecord {
  id: string
  prize_type: string
  prize_amount: number
  prize_label: string
  created_at: string
}

interface CommunityInfo {
  user_id: string
  real_level: number
  current_level: number
  is_admin_set: boolean
  is_influencer: boolean
  team_volume_l123: number
  total_community_earned: number
  current_level_name: string
  current_reward_pool: number
  current_daily_rate: number
  current_daily_earning: number
  next_level: number | null
  next_unlock_volume: number
  volume_to_next_level: number
  can_claim_levels: number[]
}

interface CommunityLevel {
  level: number
  name: string
  reward_pool: number
  daily_rate: number
  unlock_volume_normal: number
  unlock_volume_influencer: number
}

interface PoolClaim {
  level: number
  amount: number
  claim_type: string
  status: string
  claimed_at: string
}

interface DailyEarning {
  earning_date: string
  level: number
  earning_amount: number
  is_credited: boolean
}

interface WithdrawalRecord {
  id: string
  token_type: string
  amount: number
  usd_amount: number | null
  wallet_address: string
  status: string
  tx_hash: string | null
  error_message: string | null
  processed_at: string | null
  created_at: string
}

interface ProfitsData {
  available_usdc: number
  community_locked_usdc?: number
  available_matic: number
  total_earned_usdc: number
  withdrawn_usdc: number
  withdrawn_matic: number
  withdrawals_frozen?: boolean
}

interface WalletAuditRecord {
  id: string
  event: string
  old_address: string | null
  new_address: string | null
  source: string | null
  created_at: string
}

interface TeamGrowth {
  hasData: boolean
  from: string | null
  to: string | null
  memberCount: number
  analyzed: number
  newDeposits: number
  withdrawals: number
  naturalGrowth: number
  netExternal: number
  deltaTotal: number
  trend: 'growing' | 'stagnant' | 'declining'
  topMovers: Array<{ user_id: string; totalNow: number; deltaTotal: number; naturalGrowth: number; netExternal: number; kind: 'deposit' | 'withdraw' | 'natural' }>
}

interface DetailResponse {
  profile: ProfileData
  upline: UplineEntry[]
  downline: DownlineEntry[]
  lottery: LotteryRecord[]
  withdrawals: WithdrawalRecord[]
  login_events: LoginEvent[]
  profits: ProfitsData | null
  wallet_audit: WalletAuditRecord[]
  team_growth: TeamGrowth | null
  community: {
    info: CommunityInfo | null
    levels: CommunityLevel[]
    claims: PoolClaim[]
    daily_earnings: DailyEarning[]
  }
}

const LOTTERY_PAGE_SIZE = 20
const WITHDRAWAL_PAGE_SIZE = 20

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function shortenAddr(addr: string | null | undefined) {
  if (!addr) return '-'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// ISO-2 country code → "🇲🇦 MA". Returns '-' when unknown.
function countryWithFlag(cc: string | null | undefined) {
  if (!cc || cc.length !== 2) return '-'
  const flag = [...cc.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
  return `${flag} ${cc.toUpperCase()}`
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lotteryPage, setLotteryPage] = useState(1)
  const [withdrawalPage, setWithdrawalPage] = useState(1)
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({
    L1: true,
    L2: false,
    L3: false,
    deeper: false,
  })
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [balancesLoaded, setBalancesLoaded] = useState(false)
  const [freezing, setFreezing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to load user')
      }
      const json: DetailResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }, [userId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Freeze (ban + zero withdrawable) / unfreeze a user's withdrawals.
  const toggleFreeze = useCallback(async (freeze: boolean) => {
    if (freeze && !window.confirm('封禁该用户提现并清零其可提现余额?此操作会把 available_usdc 等清 0。')) return
    setFreezing(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: freeze ? 'freeze_withdrawals' : 'unfreeze_withdrawals' }),
      })
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Action failed')
      }
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setFreezing(false)
    }
  }, [userId, router, fetchData])

  // 暂停/恢复奖励发放（claims_frozen）：team 页显示"奖励暂停发放"卡片（模糊 3 原因 + 申诉）。
  const toggleClaimsFrozen = useCallback(async (freeze: boolean) => {
    if (freeze && !window.confirm('暂停该用户的奖励发放？team 页会显示"奖励暂停发放"卡片（模糊原因 + 申诉按钮），并拦住其 claim。')) return
    setFreezing(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: freeze ? 'freeze_claims' : 'unfreeze_claims' }),
      })
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Action failed')
      }
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setFreezing(false)
    }
  }, [userId, router, fetchData])

  // On-demand: fetch on-chain USDC balances for downline wallets.
  // Reuses the admin balances endpoint (returns all wallets keyed by address).
  const fetchDownlineBalances = useCallback(async () => {
    setLoadingBalances(true)
    try {
      const res = await fetch('/api/admin/users/balances')
      if (res.ok) {
        const json = await res.json()
        setBalances(json.balances || {})
        setBalancesLoaded(true)
      }
    } catch {
      console.error('Failed to fetch downline balances')
    } finally {
      setLoadingBalances(false)
    }
  }, [])

  const profile = data?.profile
  const community = data?.community

  // Downline grouping
  const downlineByLevel: Record<number, DownlineEntry[]> = {}
  for (const r of data?.downline || []) {
    if (!downlineByLevel[r.level]) downlineByLevel[r.level] = []
    downlineByLevel[r.level].push(r)
  }
  const deeperLevels = Object.keys(downlineByLevel)
    .map(Number)
    .filter((l) => l >= 4)
    .sort((a, b) => a - b)
  const deeperCount = deeperLevels.reduce(
    (sum, l) => sum + (downlineByLevel[l]?.length || 0),
    0
  )

  // Lottery aggregates
  const lottery = data?.lottery || []
  const totalSpins = lottery.length
  const winningSpins = lottery.filter((r) => r.prize_type !== 'thanks').length
  const withdrawableUsdc = lottery
    .filter((r) => r.prize_type.startsWith('usdc_'))
    .reduce((sum, r) => sum + (Number(r.prize_amount) || 0), 0)
  const bonusLocked = lottery
    .filter((r) => r.prize_type.startsWith('bonus_'))
    .reduce((sum, r) => sum + (Number(r.prize_amount) || 0), 0)
  const prizeDistribution: Record<string, number> = {}
  for (const r of lottery) {
    prizeDistribution[r.prize_label] = (prizeDistribution[r.prize_label] || 0) + 1
  }
  const lotteryTotalPages = Math.max(1, Math.ceil(totalSpins / LOTTERY_PAGE_SIZE))
  const lotteryPageRows = lottery.slice(
    (lotteryPage - 1) * LOTTERY_PAGE_SIZE,
    lotteryPage * LOTTERY_PAGE_SIZE
  )

  // Withdrawal aggregates
  const walletAudit = data?.wallet_audit || []
  const withdrawals = data?.withdrawals || []
  const totalWithdrawals = withdrawals.length
  const completedUsd = withdrawals
    .filter((w) => w.status === 'completed')
    .reduce((sum, w) => sum + (Number(w.usd_amount) || Number(w.amount) || 0), 0)
  const statusCounts: Record<string, number> = {}
  for (const w of withdrawals) {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1
  }
  const pendingCount = (statusCounts['pending'] || 0) + (statusCounts['processing'] || 0)
  const failedCount = statusCounts['failed'] || 0
  const withdrawalTotalPages = Math.max(1, Math.ceil(totalWithdrawals / WITHDRAWAL_PAGE_SIZE))
  const withdrawalPageRows = withdrawals.slice(
    (withdrawalPage - 1) * WITHDRAWAL_PAGE_SIZE,
    withdrawalPage * WITHDRAWAL_PAGE_SIZE
  )

  // Community progress
  const info = community?.info
  const progressPct = info && info.next_unlock_volume > 0
    ? Math.min(100, (Number(info.team_volume_l123) / Number(info.next_unlock_volume)) * 100)
    : info && info.next_level === null
      ? 100
      : 0

  const toggleLevel = (key: string) =>
    setExpandedLevels((prev) => ({ ...prev, [key]: !prev[key] }))

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
                <h1 className="text-lg font-bold text-white">User Detail</h1>
                <p className="text-xs text-zinc-400">
                  {profile?.username || profile?.email || userId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/users">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="text-center py-16 text-zinc-500">Loading...</div>
        ) : !profile ? (
          <div className="text-center py-16 text-zinc-500">User not found</div>
        ) : (
          <div className="space-y-6">
            {/* Section: Profile */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Profile</h2>
              </header>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Username" value={profile.username || '-'} />
                <Field icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={profile.email} />
                <Field
                  icon={<CheckCircle className="w-3.5 h-3.5" />}
                  label="Profile Status"
                  value={
                    <span className={profile.profile_completed ? 'text-green-400' : 'text-amber-400'}>
                      {profile.profile_completed ? 'Completed' : 'Incomplete'}
                    </span>
                  }
                />
                <Field
                  icon={<Phone className="w-3.5 h-3.5" />}
                  label="Phone"
                  value={
                    profile.phone_country_code && profile.phone_number
                      ? `${profile.phone_country_code} ${profile.phone_number}`
                      : '-'
                  }
                />
                <Field icon={<Globe className="w-3.5 h-3.5" />} label="Country" value={profile.country_code || '-'} />
                <Field
                  icon={<MessageCircle className="w-3.5 h-3.5" />}
                  label="Telegram"
                  value={
                    profile.telegram_username ? (
                      <a
                        href={`https://t.me/${profile.telegram_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        @{profile.telegram_username}
                      </a>
                    ) : (
                      '-'
                    )
                  }
                />
                <Field
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  label="Wallet"
                  value={
                    profile.wallet_address ? (
                      <span className="flex items-center gap-2 flex-wrap">
                        <code className="text-zinc-300 text-xs">
                          {shortenAddr(profile.wallet_address)}
                        </code>
                        <a
                          href={`https://polygonscan.com/address/${profile.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-emerald-400"
                          title="在 PolygonScan 查看"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {balancesLoaded ? (
                          <span
                            className={`text-xs font-medium ${
                              parseFloat(balances[(profile.wallet_address || '').toLowerCase()] || '0') > 0
                                ? 'text-green-400'
                                : 'text-zinc-500'
                            }`}
                          >
                            ${parseFloat(balances[(profile.wallet_address || '').toLowerCase()] || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={fetchDownlineBalances}
                            disabled={loadingBalances}
                            className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            {loadingBalances ? '读取中…' : '查余额'}
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Not connected</span>
                    )
                  }
                />
                <Field
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Wallet Bound At"
                  value={formatDate(profile.wallet_bound_at)}
                />
                <Field
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Joined"
                  value={formatDate(profile.created_at)}
                />
                <Field
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Last Sign-In"
                  value={
                    profile.last_sign_in_at ? (
                      <span className="text-emerald-300">{formatDate(profile.last_sign_in_at)}</span>
                    ) : (
                      <span className="text-zinc-500">Never / Unavailable</span>
                    )
                  }
                />
                <Field
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Profile Updated"
                  value={formatDate(profile.updated_at)}
                />
                <Field
                  icon={<UserIcon className="w-3.5 h-3.5" />}
                  label="User ID"
                  value={<code className="text-xs text-zinc-400">{profile.id}</code>}
                />
              </div>
            </section>

            {/* Section: Login & IP */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Login & IP</h2>
                <span className="ml-auto text-xs text-zinc-500">{data?.login_events?.length || 0} records</span>
              </header>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Field icon={<Globe className="w-3.5 h-3.5" />} label="Last IP"
                    value={<code className="text-xs text-emerald-300">{profile.last_login_ip || '-'}</code>} />
                  <Field icon={<Globe className="w-3.5 h-3.5" />} label="Last Country"
                    value={countryWithFlag(profile.last_login_country)} />
                  <Field icon={<Globe className="w-3.5 h-3.5" />} label="Last City" value={profile.last_login_city || '-'} />
                  <Field icon={<Clock className="w-3.5 h-3.5" />} label="Last Login At" value={formatDate(profile.last_login_at)} />
                </div>

                {(!data?.login_events || data.login_events.length === 0) ? (
                  <p className="text-sm text-zinc-500">No login records yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-zinc-700">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/80">
                        <tr className="border-b border-zinc-700">
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Time</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">IP</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Country</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">City</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Device</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.login_events.map((ev, i) => (
                          <tr key={i} className="border-b border-zinc-700/50">
                            <td className="px-4 py-2 text-xs text-zinc-400">{formatDate(ev.created_at)}</td>
                            <td className="px-4 py-2"><code className="text-xs text-zinc-200">{ev.ip || '-'}</code></td>
                            <td className="px-4 py-2 text-xs text-zinc-300">{countryWithFlag(ev.country)}</td>
                            <td className="px-4 py-2 text-xs text-zinc-400">{ev.city || '-'}</td>
                            <td className="px-4 py-2 text-[11px] text-zinc-500 max-w-[260px] truncate" title={ev.user_agent || ''}>{ev.user_agent || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Section: Upline */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Upline</h2>
              </header>
              <div className="p-5">
                {data!.upline.length === 0 ? (
                  <p className="text-sm text-zinc-500">No referrer (top-level user)</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {data!.upline.map((u, i) => (
                      <div key={u.id} className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="px-3 py-1.5 bg-zinc-700/40 border border-zinc-600 rounded-lg hover:bg-zinc-700 hover:border-blue-500/50 transition"
                        >
                          <span className="text-blue-300 text-xs mr-2">L{u.level}</span>
                          <span className="text-white">{u.username || u.email || u.id.slice(0, 8)}</span>
                        </Link>
                        {i < data!.upline.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Section: 团队业绩分析（真入金 vs 吃息 vs 撤资）*/}
            {(() => {
              const g = data?.team_growth
              const trendMeta = {
                growing: { label: '📈 增长', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                declining: { label: '📉 减少', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
                stagnant: { label: '➖ 停滞', cls: 'bg-zinc-600/30 text-zinc-300 border-zinc-600/50' },
              } as const
              const tm = g ? trendMeta[g.trend] : trendMeta.stagnant
              return (
                <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
                  <header className="px-5 py-3 border-b border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-sm font-semibold text-white">团队业绩分析</h2>
                      <span className="text-[11px] text-zinc-500">L1-3 · 最近两次发放</span>
                    </div>
                    {g?.hasData && (
                      <span className={`text-xs px-2.5 py-1 rounded-lg border ${tm.cls}`}>{tm.label}</span>
                    )}
                  </header>
                  {!g || !g.hasData || g.analyzed === 0 ? (
                    <div className="px-5 py-4 text-sm text-zinc-500">
                      暂无数据（至少需要两次发放快照，且下线要有可对比的快照）。
                    </div>
                  ) : (
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                          <p className="text-[11px] text-zinc-500">💵 新入金</p>
                          <p className="text-lg font-bold text-emerald-400 tabular-nums">+${g.newDeposits.toFixed(2)}</p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                          <p className="text-[11px] text-zinc-500">📉 撤资</p>
                          <p className="text-lg font-bold text-red-400 tabular-nums">-${g.withdrawals.toFixed(2)}</p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                          <p className="text-[11px] text-zinc-500">🌱 自然增长(息)</p>
                          <p className="text-lg font-bold text-zinc-300 tabular-nums">+${g.naturalGrowth.toFixed(2)}</p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                          <p className="text-[11px] text-zinc-500">净外部流水</p>
                          <p className={`text-lg font-bold tabular-nums ${g.netExternal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {g.netExternal >= 0 ? '+' : ''}${g.netExternal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500 mb-3">
                        团队总资产净变化 {g.deltaTotal >= 0 ? '+' : ''}${g.deltaTotal.toFixed(2)} · 已分析 {g.analyzed}/{g.memberCount} 名下线
                        {g.from && g.to && <> · {new Date(g.from).toLocaleDateString()} → {new Date(g.to).toLocaleDateString()}</>}
                      </p>
                      {g.topMovers.length > 0 && (
                        <div className="border-t border-white/5 pt-3">
                          <p className="text-[11px] text-zinc-500 mb-2">主要变动成员</p>
                          <div className="space-y-1.5">
                            {g.topMovers.map((m) => {
                              const dl = data?.downline.find((d) => d.id === m.user_id)
                              const label = dl?.username || dl?.email || m.user_id.slice(0, 8)
                              return (
                                <div key={m.user_id} className="flex items-center justify-between text-sm">
                                  <span className="text-zinc-300">
                                    {m.kind === 'deposit' ? '💵' : m.kind === 'withdraw' ? '📉' : '🌱'} {label}
                                  </span>
                                  <span className={`tabular-nums font-medium ${m.netExternal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {m.netExternal >= 0 ? '+' : ''}${m.netExternal.toFixed(2)}
                                    <span className="text-zinc-600 text-xs ml-2">息 +${m.naturalGrowth.toFixed(2)}</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )
            })()}

            {/* Section: Downline */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Downline ({data!.downline.length} total)
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>L1: {downlineByLevel[1]?.length || 0}</span>
                  <span>L2: {downlineByLevel[2]?.length || 0}</span>
                  <span>L3: {downlineByLevel[3]?.length || 0}</span>
                  <span>L4+: {deeperCount}</span>
                  <button
                    onClick={fetchDownlineBalances}
                    disabled={loadingBalances}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-700/40 transition disabled:opacity-50"
                  >
                    <Wallet className={`w-3.5 h-3.5 ${loadingBalances ? 'animate-pulse' : ''}`} />
                    {loadingBalances ? '读取中…' : (balancesLoaded ? '刷新余额' : '读取余额')}
                  </button>
                </div>
              </header>
              <div className="divide-y divide-zinc-700">
                {[1, 2, 3].map((lvl) => {
                  const rows = downlineByLevel[lvl] || []
                  const key = `L${lvl}`
                  const open = expandedLevels[key]
                  return (
                    <div key={lvl}>
                      <button
                        onClick={() => toggleLevel(key)}
                        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-zinc-700/20 transition"
                      >
                        <div className="flex items-center gap-2">
                          {open ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          )}
                          <span className="text-sm font-medium text-white">Level {lvl}</span>
                          <span className="text-xs text-zinc-500">({rows.length} members)</span>
                        </div>
                      </button>
                      {open && (
                        <div className="px-5 pb-4">
                          {rows.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-2">No members at this level.</p>
                          ) : (
                            <DownlineTable rows={rows} balances={balances} balancesLoaded={balancesLoaded} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {deeperCount > 0 && (
                  <div>
                    <button
                      onClick={() => toggleLevel('deeper')}
                      className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-zinc-700/20 transition"
                    >
                      <div className="flex items-center gap-2">
                        {expandedLevels.deeper ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        )}
                        <span className="text-sm font-medium text-white">Deeper levels (L4–L10)</span>
                        <span className="text-xs text-zinc-500">({deeperCount} members)</span>
                      </div>
                    </button>
                    {expandedLevels.deeper && (
                      <div className="px-5 pb-4 space-y-4">
                        {deeperLevels.map((lvl) => (
                          <div key={lvl}>
                            <p className="text-xs text-zinc-400 mb-2">Level {lvl} ({downlineByLevel[lvl].length})</p>
                            <DownlineTable rows={downlineByLevel[lvl]} balances={balances} balancesLoaded={balancesLoaded} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Section: Lottery */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <Gift className="w-4 h-4 text-pink-400" />
                <h2 className="text-sm font-semibold text-white">Lottery History</h2>
              </header>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Stat label="Total Spins" value={totalSpins.toString()} color="text-white" />
                  <Stat label="Winning Spins" value={winningSpins.toString()} color="text-emerald-400" />
                  <Stat
                    label="USDC Won (Withdrawable)"
                    value={`$${withdrawableUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="text-green-400"
                  />
                  <Stat
                    label="Bonus Won (Locked)"
                    value={`$${bonusLocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="text-amber-300"
                  />
                </div>

                {Object.keys(prizeDistribution).length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {Object.entries(prizeDistribution).map(([label, count]) => (
                      <span
                        key={label}
                        className="px-2 py-1 bg-zinc-700/40 border border-zinc-600 rounded-lg text-xs text-zinc-300"
                      >
                        {label}: <span className="text-white font-medium">{count}</span>
                      </span>
                    ))}
                  </div>
                )}

                {totalSpins === 0 ? (
                  <p className="text-sm text-zinc-500">No lottery records.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-zinc-700">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800/80">
                          <tr className="border-b border-zinc-700">
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Time</th>
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Prize</th>
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Type</th>
                            <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lotteryPageRows.map((r) => (
                            <tr key={r.id} className="border-b border-zinc-700/50">
                              <td className="px-4 py-2 text-xs text-zinc-400">{formatDate(r.created_at)}</td>
                              <td className="px-4 py-2 text-white">{r.prize_label}</td>
                              <td className="px-4 py-2">
                                <code className="text-xs text-zinc-400">{r.prize_type}</code>
                              </td>
                              <td className="px-4 py-2 text-right font-mono">
                                {Number(r.prize_amount) > 0 ? (
                                  <span className="text-green-400">
                                    ${Number(r.prize_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-zinc-500">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {lotteryTotalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">
                          Page {lotteryPage} of {lotteryTotalPages} ({totalSpins} records)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLotteryPage((p) => Math.max(1, p - 1))}
                            disabled={lotteryPage === 1}
                            className="px-3 py-1 rounded-lg bg-zinc-700/40 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Prev
                          </button>
                          <button
                            onClick={() => setLotteryPage((p) => Math.min(lotteryTotalPages, p + 1))}
                            disabled={lotteryPage === lotteryTotalPages}
                            className="px-3 py-1 rounded-lg bg-zinc-700/40 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Section: Withdrawals */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Withdraw History</h2>
                {data?.profits?.withdrawals_frozen && (
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                    Frozen
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {/* 暂停/恢复奖励发放（claims_frozen）：team 页显示"暂停发放"卡片（模糊 3 原因 + 申诉） */}
                  <button
                    onClick={() => toggleClaimsFrozen(true)}
                    disabled={freezing}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                  >
                    暂停发放
                  </button>
                  <button
                    onClick={() => toggleClaimsFrozen(false)}
                    disabled={freezing}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-50"
                  >
                    恢复发放
                  </button>
                  {data?.profits?.withdrawals_frozen ? (
                    <button
                      onClick={() => toggleFreeze(false)}
                      disabled={freezing}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-50"
                    >
                      {freezing ? '…' : 'Unfreeze'}
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleFreeze(true)}
                      disabled={freezing}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      {freezing ? '…' : 'Freeze & Zero'}
                    </button>
                  )}
                </div>
              </header>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                  <Stat
                    label="Withdrawable (USDC)"
                    value={`$${(Number(data?.profits?.available_usdc) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="text-emerald-400"
                  />
                  <Stat
                    label="Locked (USDC)"
                    value={`$${(Number(data?.profits?.community_locked_usdc) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color={(Number(data?.profits?.community_locked_usdc) || 0) > 0 ? 'text-amber-400' : 'text-zinc-500'}
                  />
                  <Stat label="Total Withdrawals" value={totalWithdrawals.toString()} color="text-white" />
                  <Stat
                    label="Completed (USD)"
                    value={`$${completedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="text-green-400"
                  />
                  <Stat label="Pending / Processing" value={pendingCount.toString()} color="text-amber-300" />
                  <Stat label="Failed" value={failedCount.toString()} color="text-red-400" />
                </div>

                {totalWithdrawals === 0 ? (
                  <p className="text-sm text-zinc-500">No withdrawal records.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-zinc-700">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800/80">
                          <tr className="border-b border-zinc-700">
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Time</th>
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Token</th>
                            <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">Amount</th>
                            <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2">USD</th>
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Status</th>
                            <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Tx</th>
                          </tr>
                        </thead>
                        <tbody>
                          {withdrawalPageRows.map((w) => (
                            <tr key={w.id} className="border-b border-zinc-700/50">
                              <td className="px-4 py-2 text-xs text-zinc-400">
                                {formatDate(w.created_at)}
                                {w.processed_at && w.processed_at !== w.created_at && (
                                  <p className="text-[10px] text-zinc-600">
                                    done: {formatDate(w.processed_at)}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-2 text-white">{w.token_type}</td>
                              <td className="px-4 py-2 text-right font-mono text-zinc-200">
                                {Number(w.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              </td>
                              <td className="px-4 py-2 text-right font-mono">
                                {w.usd_amount != null ? (
                                  <span className="text-green-400">
                                    ${Number(w.usd_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-zinc-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <WithdrawStatusBadge status={w.status} />
                                {w.status === 'failed' && w.error_message && (
                                  <p className="text-[10px] text-red-300 mt-1 max-w-[200px] truncate" title={w.error_message}>
                                    {w.error_message}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                {w.tx_hash ? (
                                  <a
                                    href={`https://polygonscan.com/tx/${w.tx_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                                  >
                                    <code>{w.tx_hash.slice(0, 6)}...{w.tx_hash.slice(-4)}</code>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-zinc-600 text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {withdrawalTotalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">
                          Page {withdrawalPage} of {withdrawalTotalPages} ({totalWithdrawals} records)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setWithdrawalPage((p) => Math.max(1, p - 1))}
                            disabled={withdrawalPage === 1}
                            className="px-3 py-1 rounded-lg bg-zinc-700/40 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Prev
                          </button>
                          <button
                            onClick={() => setWithdrawalPage((p) => Math.min(withdrawalTotalPages, p + 1))}
                            disabled={withdrawalPage === withdrawalTotalPages}
                            className="px-3 py-1 rounded-lg bg-zinc-700/40 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Section: Wallet Binding Audit */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white">Wallet Binding Audit</h2>
                <span className="text-[11px] text-zinc-500">绑定一次后永久不可变</span>
              </header>
              <div className="p-5">
                {walletAudit.length === 0 ? (
                  <p className="text-sm text-zinc-500">No wallet binding events recorded.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-zinc-700">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/80">
                        <tr className="border-b border-zinc-700">
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Time</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Event</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">From → To</th>
                          <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletAudit.map((a) => (
                          <tr key={a.id} className="border-b border-zinc-700/50">
                            <td className="px-4 py-2 text-xs text-zinc-400 whitespace-nowrap">{formatDate(a.created_at)}</td>
                            <td className="px-4 py-2">
                              {a.event === 'change_blocked' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs">
                                  <XCircle className="w-3 h-3" /> Change blocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
                                  <CheckCircle className="w-3 h-3" /> Bound
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-zinc-300">
                              {a.old_address ? shortenAddr(a.old_address) : '—'}
                              <span className="text-zinc-600"> → </span>
                              {a.new_address ? shortenAddr(a.new_address) : '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-zinc-500">{a.source || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Section: Community */}
            <section className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
              <header className="px-5 py-3 border-b border-zinc-700 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Community Progress</h2>
              </header>
              <div className="p-5 space-y-5">
                {!info ? (
                  <p className="text-sm text-zinc-500">No community data.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Stat
                        label="Current Level"
                        value={`L${info.current_level} ${info.current_level_name || ''}`}
                        color="text-amber-300"
                      />
                      <Stat
                        label="Real Level"
                        value={`L${info.real_level}`}
                        color="text-zinc-200"
                      />
                      <Stat
                        label="Team Volume (L1–L3)"
                        value={`$${Number(info.team_volume_l123).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        color="text-emerald-400"
                      />
                      <Stat
                        label="Total Earned"
                        value={`$${Number(info.total_community_earned).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        color="text-green-400"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {info.is_admin_set && (
                        <span className="px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg">
                          Admin-set Level
                        </span>
                      )}
                      {info.is_influencer && (
                        <span className="px-2 py-1 bg-pink-500/15 border border-pink-500/30 text-pink-300 rounded-lg">
                          Influencer
                        </span>
                      )}
                    </div>

                    {/* Progress to next level */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-zinc-400">
                          Progress to{' '}
                          {info.next_level
                            ? `Level ${info.next_level}`
                            : 'Max Level'}
                        </span>
                        <span className="text-zinc-300 font-mono">
                          ${Number(info.team_volume_l123).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {info.next_level && (
                            <> / ${Number(info.next_unlock_volume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {info.next_level && (
                        <p className="mt-1 text-xs text-zinc-500">
                          ${Number(info.volume_to_next_level).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more to unlock L{info.next_level}
                        </p>
                      )}
                    </div>

                    {/* Admin-set unlock status banner */}
                    {info.is_admin_set && (() => {
                      const adminLockLevel = info.current_level
                      const realLevel = info.real_level
                      const unlocked = realLevel >= adminLockLevel
                      const claimedLevelsSet = new Set(community!.claims.map((c) => c.level))
                      const highestClaimed = claimedLevelsSet.size > 0 ? Math.max(...claimedLevelsSet) : 0
                      const nextUnclaimed = highestClaimed + 1
                      const lockTarget = community!.levels.find((l) => l.level === adminLockLevel)
                      const lockVol = lockTarget
                        ? (info.is_influencer
                            ? lockTarget.unlock_volume_influencer
                            : lockTarget.unlock_volume_normal)
                        : 0
                      const shortfall = Math.max(0, lockVol - info.team_volume_l123)
                      return (
                        <div className={`rounded-lg border px-4 py-3 text-xs ${
                          unlocked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        }`}>
                          <p className="font-semibold mb-1">
                            {unlocked
                              ? `Pool claims UNLOCKED · Next claimable: L${nextUnclaimed}`
                              : `Pool claims LOCKED · Need real_level ≥ L${adminLockLevel}`}
                          </p>
                          <p className="opacity-90">
                            {unlocked
                              ? `Real level (L${realLevel}) ≥ admin-set level (L${adminLockLevel}). User can claim L${nextUnclaimed} next if volume threshold is met.`
                              : `User needs $${Number(shortfall).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more team volume to reach L${adminLockLevel} unlock threshold.`}
                          </p>
                        </div>
                      )
                    })()}

                    {/* Levels overview */}
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">All Levels</p>
                      <div className="overflow-x-auto rounded-lg border border-zinc-700">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-800/80">
                            <tr className="border-b border-zinc-700">
                              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Level</th>
                              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Name</th>
                              <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Reward Pool</th>
                              <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Daily Rate</th>
                              <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">
                                Unlock ({info.is_influencer ? 'Influencer' : 'Normal'})
                              </th>
                              <th className="text-center text-xs font-medium text-zinc-400 px-3 py-2">Pool Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const claimedLevelsSet = new Set(community!.claims.map((c) => c.level))
                              const highestClaimed = claimedLevelsSet.size > 0 ? Math.max(...claimedLevelsSet) : 0
                              const nextUnclaimed = highestClaimed + 1
                              const adminUnlocked = !info.is_admin_set || info.real_level >= info.current_level
                              return community!.levels.map((lvl) => {
                                const claim = community!.claims.find((c) => c.level === lvl.level)
                                const unlockVol = info.is_influencer
                                  ? lvl.unlock_volume_influencer
                                  : lvl.unlock_volume_normal
                                const isCurrent = lvl.level === info.current_level
                                const volumeMet = info.team_volume_l123 >= unlockVol

                                let statusNode: React.ReactNode
                                if (claim) {
                                  statusNode = (
                                    <span className="text-emerald-400 text-xs">
                                      Claimed ${Number(claim.amount).toLocaleString()}
                                    </span>
                                  )
                                } else if (info.is_admin_set && !adminUnlocked) {
                                  statusNode = <span className="text-amber-400 text-xs">Locked (admin)</span>
                                } else if (lvl.level !== nextUnclaimed) {
                                  statusNode = (
                                    <span className="text-zinc-500 text-xs">
                                      {lvl.level < nextUnclaimed ? '—' : `After L${nextUnclaimed}`}
                                    </span>
                                  )
                                } else if (!volumeMet) {
                                  const shortfall = unlockVol - info.team_volume_l123
                                  statusNode = (
                                    <span className="text-zinc-400 text-xs">
                                      Need ${Number(shortfall).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  )
                                } else {
                                  statusNode = (
                                    <span className="text-blue-300 text-xs font-medium">
                                      Available
                                    </span>
                                  )
                                }

                                return (
                                  <tr
                                    key={lvl.level}
                                    className={`border-b border-zinc-700/50 ${isCurrent ? 'bg-amber-500/5' : ''}`}
                                  >
                                    <td className="px-3 py-2 text-white">
                                      L{lvl.level}
                                      {isCurrent && (
                                        <span className="ml-2 text-[10px] uppercase text-amber-400">current</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-zinc-300">{lvl.name}</td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                                      ${Number(lvl.reward_pool).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                                      {(Number(lvl.daily_rate) * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                                      ${Number(unlockVol).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-center">{statusNode}</td>
                                  </tr>
                                )
                              })
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recent daily earnings */}
                    {community!.daily_earnings.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-400 mb-2">Daily Earnings (Last 30 Days)</p>
                        <div className="overflow-x-auto rounded-lg border border-zinc-700">
                          <table className="w-full text-sm">
                            <thead className="bg-zinc-800/80">
                              <tr className="border-b border-zinc-700">
                                <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Date</th>
                                <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Level</th>
                                <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Amount</th>
                                <th className="text-center text-xs font-medium text-zinc-400 px-3 py-2">Credited</th>
                              </tr>
                            </thead>
                            <tbody>
                              {community!.daily_earnings.map((d) => (
                                <tr key={d.earning_date} className="border-b border-zinc-700/50">
                                  <td className="px-3 py-2 text-zinc-300">{d.earning_date}</td>
                                  <td className="px-3 py-2 text-zinc-300">L{d.level}</td>
                                  <td className="px-3 py-2 text-right font-mono text-green-400">
                                    ${Number(d.earning_amount).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {d.is_credited ? (
                                      <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-zinc-600 inline" />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <p className="text-zinc-500 text-xs mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className="text-white text-sm break-all">{value}</div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-700 rounded-lg p-3">
      <p className="text-zinc-400 text-xs">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function WithdrawStatusBadge({ status }: { status: string }) {
  const cls = {
    completed: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    processing: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
    pending: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    failed: 'bg-red-500/15 border-red-500/30 text-red-300',
  }[status] || 'bg-zinc-700/40 border-zinc-600 text-zinc-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] uppercase ${cls}`}>
      {status}
    </span>
  )
}

function DownlineTable({ rows, balances, balancesLoaded }: {
  rows: DownlineEntry[]
  balances: Record<string, string>
  balancesLoaded: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full text-sm">
        <thead className="bg-zinc-800/80">
          <tr className="border-b border-zinc-700">
            <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">User</th>
            <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Wallet</th>
            <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">USDC</th>
            <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Country</th>
            <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Telegram</th>
            <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Own Team</th>
            <th className="text-right text-xs font-medium text-zinc-400 px-3 py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/20">
              <td className="px-3 py-2">
                <Link
                  href={`/admin/users/${r.id}`}
                  className="text-white hover:text-emerald-400"
                >
                  {r.username || r.email || r.id.slice(0, 8)}
                </Link>
                {r.email && r.username && (
                  <p className="text-xs text-zinc-500">{r.email}</p>
                )}
              </td>
              <td className="px-3 py-2">
                {r.wallet_address ? (
                  <code className="text-xs text-zinc-300">{shortenAddr(r.wallet_address)}</code>
                ) : (
                  <span className="text-zinc-600 text-xs">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-xs">
                {!r.wallet_address ? (
                  <span className="text-zinc-600">-</span>
                ) : !balancesLoaded ? (
                  <span className="text-zinc-600">—</span>
                ) : (
                  <span className={parseFloat(balances[r.wallet_address.toLowerCase()] || '0') > 0 ? 'text-green-400 font-medium' : 'text-zinc-500'}>
                    ${parseFloat(balances[r.wallet_address.toLowerCase()] || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-300 text-xs">{r.country_code || '-'}</td>
              <td className="px-3 py-2">
                {r.telegram_username ? (
                  <a
                    href={`https://t.me/${r.telegram_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    @{r.telegram_username}
                  </a>
                ) : (
                  <span className="text-zinc-600 text-xs">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-zinc-300">{r.team_count}</td>
              <td className="px-3 py-2 text-right text-xs text-zinc-400">
                {new Date(r.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
