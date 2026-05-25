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
  referrer: { id: string; username: string | null; email: string | null } | null
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

interface DetailResponse {
  profile: ProfileData
  upline: UplineEntry[]
  downline: DownlineEntry[]
  lottery: LotteryRecord[]
  community: {
    info: CommunityInfo | null
    levels: CommunityLevel[]
    claims: PoolClaim[]
    daily_earnings: DailyEarning[]
  }
}

const LOTTERY_PAGE_SIZE = 20

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
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({
    L1: true,
    L2: false,
    L3: false,
    deeper: false,
  })

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
  const totalWonUsdc = lottery.reduce(
    (sum, r) => sum + (Number(r.prize_amount) || 0),
    0
  )
  const prizeDistribution: Record<string, number> = {}
  for (const r of lottery) {
    prizeDistribution[r.prize_label] = (prizeDistribution[r.prize_label] || 0) + 1
  }
  const lotteryTotalPages = Math.max(1, Math.ceil(totalSpins / LOTTERY_PAGE_SIZE))
  const lotteryPageRows = lottery.slice(
    (lotteryPage - 1) * LOTTERY_PAGE_SIZE,
    lotteryPage * LOTTERY_PAGE_SIZE
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
                      <span className="flex items-center gap-2">
                        <code className="text-zinc-300 text-xs">
                          {shortenAddr(profile.wallet_address)}
                        </code>
                        <a
                          href={`https://polygonscan.com/address/${profile.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-emerald-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
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
                            <DownlineTable rows={rows} />
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
                            <DownlineTable rows={downlineByLevel[lvl]} />
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
                    label="Total USDC Won"
                    value={`$${totalWonUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="text-green-400"
                  />
                  <Stat
                    label="Unique Prizes"
                    value={Object.keys(prizeDistribution).length.toString()}
                    color="text-pink-300"
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
                              <th className="text-center text-xs font-medium text-zinc-400 px-3 py-2">Claimed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {community!.levels.map((lvl) => {
                              const claim = community!.claims.find((c) => c.level === lvl.level)
                              const unlockVol = info.is_influencer
                                ? lvl.unlock_volume_influencer
                                : lvl.unlock_volume_normal
                              const isCurrent = lvl.level === info.current_level
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
                                  <td className="px-3 py-2 text-center">
                                    {claim ? (
                                      <span className="text-emerald-400 text-xs">
                                        ${Number(claim.amount).toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-600 text-xs">-</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
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

function DownlineTable({ rows }: { rows: DownlineEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full text-sm">
        <thead className="bg-zinc-800/80">
          <tr className="border-b border-zinc-700">
            <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">User</th>
            <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Wallet</th>
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
