'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Users, 
  Gift, 
  Lock, 
  Unlock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
  Copy,
  Check,
  Filter,
  User,
  DollarSign,
  Link2,
  ArrowUpDown
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { getCountryByCode, countries } from '@/lib/countries'
import { Referral } from '@/lib/types'

interface CommunityLevel {
  level: number
  name: string
  reward_pool: number
  daily_rate: number
  unlock_volume_normal: number
  unlock_volume_influencer: number
}

interface CommunityStatus {
  real_level: number
  current_level: number
  is_admin_set: boolean
  is_influencer: boolean
  team_volume_l123: number
  total_community_earned: number
}

interface MomentumData {
  multiplier: number
  recentReferrals: number
  lastReferralAt: string | null
  daysUntilDecay: number
  nextMultiplierAfterDecay: number
}

interface MaintenanceInfo {
  level: number
  levelName: string
  amount: number
  requiredDays: number
  daysDone: number
  threshold: number
  stakingPct: number
  nonStakingPct: number
}

interface ApiResponse {
  isLocked?: boolean
  lockReason?: string
  hasReachedThreshold?: boolean
  status: CommunityStatus
  levels: CommunityLevel[]
  currentLevelInfo: CommunityLevel | null
  nextLevelInfo: CommunityLevel | null
  nextUnlockVolume: number
  effectiveVolume: number
  taskBonus: number
  volumeToNextLevel: number
  claimedLevels: number[]
  claimableLevels: number[]
  pendingLevels?: number[]
  hasPendingClaim?: boolean
  claimsFrozen?: boolean
  hasIdentity?: boolean
  adminLockReason?: { type: 'real_level_too_low' | 'volume_short'; needed: number; nextLevel: number } | null
  maintenance?: MaintenanceInfo | null
  dailyEarnings: DailyEarning[]
  dailyEarningAmount: number
  lastDailyDistribution?: string
  momentum?: MomentumData
}

interface DailyEarning {
  id: string
  earning_date: string
  level: number
  earning_amount: number
  is_credited: boolean
}

const SUPPORT_TELEGRAM = 'https://t.me/polnationsupport'
const SUPPORT_WHATSAPP = 'https://wa.me/212773084865?text=' +
  encodeURIComponent('Hi Hossam, I submitted my Polnation community reward claim and would like to follow up.')

export default function TeamPage() {
  const t = useTranslations('team')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const supabase = createClient()
  
  // Community state
  const [isLocked, setIsLocked] = useState(false)
  const [hasReachedThreshold, setHasReachedThreshold] = useState(false)
  const [status, setStatus] = useState<CommunityStatus | null>(null)
  const [levels, setLevels] = useState<CommunityLevel[]>([])
  const [currentLevelInfo, setCurrentLevelInfo] = useState<CommunityLevel | null>(null)
  const [nextUnlockVolume, setNextUnlockVolume] = useState(0)
  const [volumeToNextLevel, setVolumeToNextLevel] = useState(0)
  const [claimedLevels, setClaimedLevels] = useState<number[]>([])
  const [claimableLevels, setClaimableLevels] = useState<number[]>([])
  const [adminLockReason, setAdminLockReason] = useState<ApiResponse['adminLockReason']>(null)
  const [maintenance, setMaintenance] = useState<MaintenanceInfo | null>(null)
  const [dailyEarningAmount, setDailyEarningAmount] = useState(0)
  const [effectiveVolume, setEffectiveVolume] = useState(0)
  const [taskBonus, setTaskBonus] = useState(0)
  const [lastDistribution, setLastDistribution] = useState<string | null>(null)
  
  // Referral state
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [filteredReferrals, setFilteredReferrals] = useState<Referral[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)
  const [totalTeamMembers, setTotalTeamMembers] = useState(0)
  const [level1Members, setLevel1Members] = useState(0)
  const [totalTeamVolume, setTotalTeamVolume] = useState(0)
  const [level1Volume, setLevel1Volume] = useState(0)
  const [levelFilter, setLevelFilter] = useState('all')
  const [onlyWithBalance, setOnlyWithBalance] = useState(false)
  const [balanceSort, setBalanceSort] = useState<'none' | 'desc' | 'asc'>('none')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [claiming, setClaiming] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  // Claim 审批流相关
  const [pendingLevels, setPendingLevels] = useState<number[]>([])
  const [claimsFrozen, setClaimsFrozen] = useState(false)
  const [hasIdentity, setHasIdentity] = useState(false)
  const [claimModalLevel, setClaimModalLevel] = useState<number | null>(null)
  const [claimRealName, setClaimRealName] = useState('')
  const [claimPhoneCode, setClaimPhoneCode] = useState('+212')
  const [claimPhoneNumber, setClaimPhoneNumber] = useState('')
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [claimCongrats, setClaimCongrats] = useState<{ levelName: string; amount: number } | null>(null)
  const [showAllLevels, setShowAllLevels] = useState(false)
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [selectedLevel, setSelectedLevel] = useState<CommunityLevel | null>(null)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [momentum, setMomentum] = useState<MomentumData>({
    multiplier: 5.0,
    recentReferrals: 0,
    lastReferralAt: null,
    daysUntilDecay: 0,
    nextMultiplierAfterDecay: 1.0,
  })

  // Fetch community status
  const fetchCommunityStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/community/status')
      if (res.ok) {
        const data: ApiResponse = await res.json()
        setIsLocked(data.isLocked || false)
        setHasReachedThreshold(data.hasReachedThreshold || false)
        setStatus(data.status)
        setLevels(data.levels || [])
        setCurrentLevelInfo(data.currentLevelInfo)
        setNextUnlockVolume(data.nextUnlockVolume)
        setVolumeToNextLevel(data.volumeToNextLevel)
        setClaimedLevels(data.claimedLevels || [])
        setClaimableLevels(data.claimableLevels || [])
        setPendingLevels(data.pendingLevels || [])
        setClaimsFrozen(data.claimsFrozen || false)
        setHasIdentity(data.hasIdentity || false)
        setAdminLockReason(data.adminLockReason ?? null)
        setMaintenance(data.maintenance ?? null)
        setDailyEarningAmount(data.dailyEarningAmount || 0)
        setEffectiveVolume(data.effectiveVolume || 0)
        setTaskBonus(data.taskBonus || 0)
        setLastDistribution(data.lastDailyDistribution || null)
        if (data.momentum) {
          setMomentum(data.momentum)
        }
      }
    } catch (err) {
      console.error('Failed to fetch community status:', err)
    }
  }, [])

  // Fetch referrals
  const fetchReferrals = useCallback(async () => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setUserEmail(user.email || null)

      // Fetch profile for referral_code
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single()
      if (profileData) {
        setReferralCode(profileData.referral_code)
      }

      const res = await fetch('/api/referral/balances')
      if (res.ok) {
        const data = await res.json()
        setReferrals(data.referrals || [])
        setFilteredReferrals(data.referrals || [])
        setTotalTeamMembers(data.stats?.totalMembers || 0)
        setLevel1Members(data.stats?.level1Members || 0)
        setTotalTeamVolume(data.stats?.totalVolume || 0)
        setLevel1Volume(data.stats?.level1Volume || 0)
      }
    } catch (err) {
      console.error('Error loading referrals:', err)
    }
  }, [supabase])

  // Fetch last distribution time
  const fetchLastDistribution = useCallback(async () => {
    try {
      const res = await fetch('/api/community/last-distribution')
      if (res.ok) {
        const data = await res.json()
        setLastDistribution(data.lastDistribution)
      }
    } catch (err) {
      console.error('Failed to fetch last distribution:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true)
      await Promise.all([fetchCommunityStatus(), fetchReferrals(), fetchLastDistribution()])
      setIsLoading(false)
    }
    loadAll()
  }, [fetchCommunityStatus, fetchReferrals, fetchLastDistribution])

  // Countdown timer
  useEffect(() => {
    if (!lastDistribution) return

    const calculateCountdown = () => {
      const lastDist = new Date(lastDistribution)
      const nextDist = new Date(lastDist.getTime() + 24 * 60 * 60 * 1000) // +24 hours
      const now = new Date()
      const diff = nextDist.getTime() - now.getTime()

      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setCountdown({ hours, minutes, seconds })
    }

    calculateCountdown()
    const interval = setInterval(calculateCountdown, 1000)
    return () => clearInterval(interval)
  }, [lastDistribution])

  // Filter referrals
  useEffect(() => {
    let filtered = [...referrals]
    if (levelFilter !== 'all') {
      filtered = filtered.filter(r => r.level === parseInt(levelFilter))
    }
    if (onlyWithBalance) {
      filtered = filtered.filter(r => (r.usdc_balance || 0) > 0)
    }
    if (balanceSort === 'desc') {
      filtered.sort((a, b) => (b.usdc_balance || 0) - (a.usdc_balance || 0))
    } else if (balanceSort === 'asc') {
      filtered.sort((a, b) => (a.usdc_balance || 0) - (b.usdc_balance || 0))
    }
    setFilteredReferrals(filtered)
    setCurrentPage(1)
  }, [levelFilter, onlyWithBalance, balanceSort, referrals])

  // 打开 claim 弹窗（收集身份 → 提交进入审批）
  const handleClaim = (level: number) => {
    if (claimsFrozen) {
      setMessage({ type: 'error', text: 'Your claims are under manual review. Please contact support.' })
      return
    }
    setMessage(null)
    setClaimRealName('')
    setClaimPhoneNumber('')
    setClaimCongrats(null)
    setClaimModalLevel(level)
  }

  // 提交 claim（multipart：首次带真名+照片）
  const submitClaim = async () => {
    if (claimModalLevel == null) return
    const phoneDigits = claimPhoneNumber.replace(/\D/g, '')
    if (!hasIdentity) {
      if (!claimRealName.trim() || claimRealName.trim().length < 2) {
        setMessage({ type: 'error', text: 'Please enter your real name.' })
        return
      }
      if (phoneDigits.length < 6) {
        setMessage({ type: 'error', text: 'Please enter a valid phone number.' })
        return
      }
    }
    setClaimSubmitting(true)
    setClaiming(claimModalLevel)
    try {
      const fd = new FormData()
      fd.append('level', String(claimModalLevel))
      if (!hasIdentity) {
        fd.append('real_name', claimRealName.trim())
        fd.append('phone', `${claimPhoneCode} ${phoneDigits}`)
      }
      const res = await fetch('/api/community/claim', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || tErrors('claimFailed') })
        return
      }
      // 成功 → 显示祝贺/审核中页
      const lvl = levels.find(l => l.level === claimModalLevel)
      setClaimCongrats({ levelName: lvl?.name || data.level_name || `Level ${claimModalLevel}`, amount: data.claimed_amount })
      fetchCommunityStatus()
    } catch {
      setMessage({ type: 'error', text: tErrors('networkError') })
    } finally {
      setClaimSubmitting(false)
      setClaiming(null)
    }
  }

  const handleRefreshBalances = async () => {
    setLoadingBalances(true)
    await fetchReferrals()
    setLoadingBalances(false)
  }

  const canShowReferralLink = !!referralCode

  const copyReferralLink = () => {
    if (referralCode) {
      navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referralCode}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getLevelIcon = (level: number, size: number = 32) => {
    const validLevel = Math.min(Math.max(level, 1), 6)
    return (
      <Image 
        src={`/levels/level-${validLevel}.webp`}
        alt={`Level ${validLevel}`}
        width={size}
        height={size}
        className="object-contain"
      />
    )
  }

  const getContact = (referral: Referral) => {
    if (referral.telegram_username) return `@${referral.telegram_username}`
    if (referral.phone_number) return `${referral.phone_country_code} ${referral.phone_number}`
    return '-'
  }

  const uniqueLevels = [...new Set(referrals.map(r => r.level))].sort()
  const totalPages = Math.ceil(filteredReferrals.length / itemsPerPage)
  const paginatedReferrals = filteredReferrals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const progressPercent = nextUnlockVolume > 0 ? Math.min(100, (effectiveVolume / nextUnlockVolume) * 100) : 100

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }


  return (
    <div className="kraken-shell space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-500">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchCommunityStatus(); fetchReferrals(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {tCommon('refresh')}
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Main Level Card - Compact */}
      <div className="kraken-summary overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_88%_10%,rgba(124,60,255,0.28),transparent_34%)]" />
        
        <div className="relative z-10 p-5">
          {/* Top Right: Badges & Help */}
          <div className="flex items-center justify-end gap-3 mb-4">
            {status?.is_influencer && (
              <span className="px-3 py-1 bg-gradient-to-r from-[var(--poly-purple)] to-[var(--poly-purple-hover)] text-white rounded-full text-xs font-bold">⭐ Influencer</span>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowHelpTooltip(!showHelpTooltip)}
                className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white/70 text-xs font-bold">?</span>
              </button>
              <div className={`absolute right-0 top-9 w-64 p-3 bg-[var(--kraken-panel)] border border-[var(--kraken-border)] rounded-xl shadow-2xl z-50 transition-all duration-200 ${showHelpTooltip ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <button 
                  onClick={() => setShowHelpTooltip(false)}
                  className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white text-xs"
                >
                  ✕
                </button>
                <h4 className="text-white font-semibold mb-2 text-sm pr-4">📖 {t('rulesTitle')}</h4>
                <ul className="text-xs text-zinc-400 space-y-1">
                  <li>• <strong className="text-white">{t('rulePool')}</strong>: {t('rulePoolDesc')}</li>
                  <li>• <strong className="text-white">{t('ruleUnlock')}</strong>: {t('ruleUnlockDesc')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content: Left Icon + Right Stats */}
          <div className="flex gap-5 mb-4">
            {/* Left: Large Level Icon */}
            <div 
              className="flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
              onClick={() => currentLevelInfo && setSelectedLevel(currentLevelInfo)}
            >
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl flex items-center justify-center bg-[var(--kraken-panel)] border border-[var(--kraken-border)]">
                {getLevelIcon(currentLevelInfo?.level || 1, 128)}
              </div>
              <p className="text-xs text-white/40 uppercase tracking-wider mt-3">{t('currentLevel')}</p>
              <p className="text-xl font-bold text-white">{currentLevelInfo?.name || 'Bronze'}</p>
              <p className="text-xs text-zinc-500 mt-1">Tap to enlarge</p>
            </div>
            
            {/* Right: Stats Grid 2x2 */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="kraken-mini-card p-3 text-center">
                <p className="text-xs text-white/40">{t('rewardPool')}</p>
                <p className="text-xl font-bold text-white">${currentLevelInfo?.reward_pool || 10}</p>
              </div>
              <div className="kraken-mini-card p-3 text-center">
                <p className="text-xs text-white/40">{t('dailyRate')}</p>
                {currentLevelInfo ? (
                  <div>
                    <p className="text-xl font-bold text-white/85">
                      {(currentLevelInfo.daily_rate * 100).toFixed(1)}%
                      {momentum.multiplier > 1.0 && (
                        <span className="text-white/75"> ×{momentum.multiplier.toFixed(0)}</span>
                      )}
                    </p>
                    {momentum.multiplier > 1.0 && (
                      <p className="text-[10px] text-white/65/70 mt-0.5">= {(currentLevelInfo.daily_rate * 100 * momentum.multiplier).toFixed(1)}%</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xl font-bold text-white/85">0.0%</p>
                )}
              </div>
              <div className="kraken-mini-card p-3 text-center">
                <p className="text-xs text-white/40">{t('dailyEarnings')}</p>
                <p className="text-xl font-bold text-green-400">+${dailyEarningAmount.toFixed(2)}</p>
              </div>
              <div className="kraken-mini-card p-3 text-center">
                <p className="text-xs text-white/40">{t('nextDistribution')}</p>
                <p className="text-xl font-bold text-white/75">
                  {countdown.hours > 0 || countdown.minutes > 0 ? `${countdown.hours}h ${countdown.minutes}m` : 'Soon'}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar - Clickable */}
          <div 
            className="bg-white/5 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => setShowUnlockModal(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/55 text-sm flex items-center gap-1">
                {t('unlockProgress')}
                <span className="w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center">?</span>
              </span>
              <span className="text-white font-medium text-sm">${effectiveVolume.toFixed(2)} / ${nextUnlockVolume.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all ${hasReachedThreshold ? 'bg-[#00e28a]' : 'bg-[var(--poly-purple)]'}`} style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">
                {hasReachedThreshold ? '✓ Threshold reached!' : `Need $${volumeToNextLevel.toFixed(2)} more`}
              </span>
              {pendingLevels.length > 0 ? (
                <span className="text-amber-300 text-xs font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Under review
                </span>
              ) : claimableLevels.length > 0 && !claimsFrozen && (
                <Button size="sm" onClick={(e) => { e.stopPropagation(); handleClaim(claimableLevels[0]); }} disabled={claiming !== null} className="bg-[var(--poly-purple)] text-white text-xs">
                  {claiming !== null ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Gift className="w-3 h-3 mr-1" /> Claim ${claimableLevels[0] && levels.find(l => l.level === claimableLevels[0])?.reward_pool}</>}
                </Button>
              )}
            </div>

            {/* 账号冻结提示 */}
            {claimsFrozen && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                🔒 Your claims are under manual review.{' '}
                <a href={SUPPORT_TELEGRAM} target="_blank" rel="noopener noreferrer" className="underline text-red-200">
                  Contact support
                </a>
              </div>
            )}

            {/* 审核中提示 */}
            {pendingLevels.length > 0 && !claimsFrozen && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                ⏳ Your claim is under review. The reward will be credited once approved.
              </div>
            )}

            {/* Bonus 维持期：进度 + staking 占比说明 */}
            {maintenance && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100" onClick={(e) => e.stopPropagation()}>
                <p className="font-semibold text-amber-200 mb-1">
                  🎉 {t('maintenanceTitle', { level: maintenance.levelName })}
                </p>
                <p className="text-amber-100/90 leading-relaxed mb-2.5">
                  {t('maintenanceExplain', {
                    stakingPct: maintenance.stakingPct,
                    nonStakingPct: maintenance.nonStakingPct,
                    days: maintenance.requiredDays,
                    amount: maintenance.amount,
                  })}
                </p>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-amber-200 font-medium">
                    {t('maintenanceProgress', { done: maintenance.daysDone, required: maintenance.requiredDays })}
                  </span>
                  <span className="text-amber-100/70">
                    {t('maintenanceRemaining', { remaining: Math.max(0, maintenance.requiredDays - maintenance.daysDone) })}
                  </span>
                </div>
                <div className="h-2 bg-amber-900/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${maintenance.requiredDays > 0 ? Math.min(100, (maintenance.daysDone / maintenance.requiredDays) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-amber-100/60 mt-1.5">{t('maintenanceEarlyRelease')}</p>
              </div>
            )}

            {/* Admin-set lock notice: pool claims gated by real_level catching up */}
            {status?.is_admin_set && adminLockReason && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {adminLockReason.type === 'real_level_too_low' ? (
                  <>🔒 Pool claims locked. Your level is gifted — earn ${adminLockReason.needed.toFixed(2)} more team volume to unlock claiming from Bronze.</>
                ) : (
                  <>🔒 Next claim: Level {adminLockReason.nextLevel}. Need ${adminLockReason.needed.toFixed(2)} more team volume.</>
                )}
              </div>
            )}
          </div>

          {/* Momentum Multiplier Info */}
          <div className="mt-3 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/65 text-sm font-semibold flex items-center gap-1.5">
                🔥 {t('momentumTitle')}
              </span>
              <span className="text-xl font-bold text-white/75">{momentum.multiplier.toFixed(1)}x</span>
            </div>

            {momentum.multiplier > 0.2 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-400">
                  {t('momentumActive', { multiplier: momentum.multiplier.toFixed(1) })}
                </p>
                {momentum.daysUntilDecay > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-500">⏱️</span>
                    <span className="text-zinc-400">
                      {t('momentumDecayCountdown', { days: momentum.daysUntilDecay, next: momentum.nextMultiplierAfterDecay.toFixed(1) })}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">{t('momentumInactive')}</p>
            )}

            {/* Decay Rules Mini Explanation */}
            <div className="mt-2 pt-2 border-t border-white/[0.05]">
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {t('momentumDecayExplain')}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${momentum.multiplier >= 1.0 ? 'bg-white/[0.08] text-white/70 font-bold' : 'bg-white/5 text-zinc-500'}`}>0–2d: 1.0×</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${momentum.multiplier >= 0.8 && momentum.multiplier < 1.0 ? 'bg-white/[0.08] text-white/70 font-bold' : 'bg-white/5 text-zinc-500'}`}>3–5d: 0.8×</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${momentum.multiplier >= 0.6 && momentum.multiplier < 0.8 ? 'bg-white/[0.08] text-white/70 font-bold' : 'bg-white/5 text-zinc-500'}`}>6–8d: 0.6×</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${momentum.multiplier >= 0.4 && momentum.multiplier < 0.6 ? 'bg-white/[0.08] text-white/70 font-bold' : 'bg-white/5 text-zinc-500'}`}>9–11d: 0.4×</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${momentum.multiplier < 0.4 ? 'bg-white/10 text-zinc-400 font-bold' : 'bg-white/5 text-zinc-500'}`}>12+d: 0.2×</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">
                {t('momentumDecayRate')}
              </p>
            </div>
          </div>

          {/* Toggle All Levels */}
          <button onClick={() => setShowAllLevels(!showAllLevels)} className="w-full mt-3 py-2 text-center text-white/40 hover:text-white/80 text-sm flex items-center justify-center gap-1">
            {showAllLevels ? <><ChevronUp className="w-4 h-4" /> Hide All Levels</> : <><ChevronDown className="w-4 h-4" /> View All Levels</>}
          </button>
        </div>
      </div>

      {/* All Levels (Collapsible) - Horizontal Scroll */}
      {showAllLevels && (
        <div className="glass-card-solid p-4">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
            {levels.map((level) => {
              const isCurrent = status?.current_level === level.level
              const isClaimed = claimedLevels.includes(level.level)
              const isPassed = level.level < (status?.current_level || 1)
              const canClaim = claimableLevels.includes(level.level)
              const unlockVolume = status?.is_influencer ? level.unlock_volume_influencer : level.unlock_volume_normal

              return (
                <div 
                  key={level.level} 
                  onClick={() => setSelectedLevel(level)}
                  className={`flex-shrink-0 w-32 p-3 rounded-xl border text-center snap-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    isCurrent 
                      ? 'border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50' 
                      : isPassed 
                        ? 'border-green-500/30 bg-green-500/10' 
                        : 'border-zinc-700 bg-zinc-800/50 opacity-70'
                  }`}
                >
                  {/* Level Icon */}
                  <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center bg-white/10 mb-2 ${isPassed ? 'opacity-60' : ''}`}>
                    {getLevelIcon(level.level, 56)}
                  </div>
                  
                  {/* Level Name */}
                  <p className={`font-semibold text-sm mb-1 ${isPassed ? 'text-zinc-400' : 'text-white'}`}>
                    {level.name}
                  </p>
                  
                  {/* Status Badge */}
                  {isCurrent && (
                    <span className="inline-block px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full mb-2">Current</span>
                  )}
                  {isPassed && isClaimed && (
                    <span className="inline-block text-green-400 text-xs mb-2">✓ Claimed</span>
                  )}
                  {!isCurrent && !isPassed && (
                    <span className="inline-block text-zinc-500 text-xs mb-2">🔒 Locked</span>
                  )}
                  
                  {/* Stats */}
                  <div className="text-xs text-zinc-400 space-y-0.5">
                    <p className="text-white font-medium">${level.reward_pool}</p>
                    <p>
                      {(level.daily_rate * 100).toFixed(1)}%
                      {momentum.multiplier > 1.0 && <span className="text-white/75">×{momentum.multiplier.toFixed(0)}</span>}
                    </p>
                    <p className="text-[10px]">${unlockVolume} to unlock</p>
                  </div>
                  
                  {/* Claim Button */}
                  {canClaim && (
                    <Button 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); handleClaim(level.level); }} 
                      disabled={claiming === level.level} 
                      className="mt-2 w-full bg-green-500 text-white text-xs py-1"
                    >
                      Claim
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-center text-zinc-500 text-xs mt-2">← Swipe to see all levels →</p>
        </div>
      )}

      {/* Level Detail Modal */}
      {selectedLevel && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedLevel(null)}
        >
          <div 
            className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedLevel(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white"
            >
              ✕
            </button>

            {/* Large Level Icon */}
            <div className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center bg-white/10 mb-4">
              {getLevelIcon(selectedLevel.level, 140)}
            </div>
            
            {/* Level Name */}
            <h3 className="text-2xl font-bold text-white text-center mb-1">{selectedLevel.name}</h3>
            <p className="text-zinc-400 text-center text-sm mb-6">Level {selectedLevel.level}</p>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-zinc-400 text-xs mb-1">{t('rewardPool')}</p>
                <p className="text-2xl font-bold text-white">${selectedLevel.reward_pool}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-zinc-400 text-xs mb-1">{t('dailyRate')}</p>
                <p className="text-2xl font-bold text-white/85">
                  {(selectedLevel.daily_rate * 100).toFixed(1)}%
                  {momentum.multiplier > 1.0 && (
                    <span className="text-white/75"> ×{momentum.multiplier.toFixed(0)}</span>
                  )}
                </p>
                {momentum.multiplier > 1.0 && (
                  <p className="text-xs text-white/65/70 mt-1">= {(selectedLevel.daily_rate * 100 * momentum.multiplier).toFixed(1)}% effective</p>
                )}
              </div>
            </div>
            
            {/* Unlock Requirements */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <p className="text-zinc-400 text-xs mb-2">{t('ruleUnlock')}</p>
              <div className="flex justify-between items-center">
                <span className="text-zinc-300 text-sm">Normal</span>
                <span className="text-white font-medium">${selectedLevel.unlock_volume_normal}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-zinc-300 text-sm">Influencer</span>
                <span className="text-white/75 font-medium">${selectedLevel.unlock_volume_influencer}</span>
              </div>
            </div>

            {/* Status & Action */}
            {(() => {
              const isCurrent = status?.current_level === selectedLevel.level
              const canClaim = claimableLevels.includes(selectedLevel.level)
              const isClaimed = claimedLevels.includes(selectedLevel.level)
              const isPassed = selectedLevel.level < (status?.current_level || 1)

              if (canClaim) {
                return (
                  <Button 
                    onClick={() => { handleClaim(selectedLevel.level); setSelectedLevel(null); }} 
                    disabled={claiming === selectedLevel.level}
                    className="w-full bg-[var(--poly-purple)] text-white py-3"
                  >
                    <Gift className="w-5 h-5 mr-2" />
                    Claim ${selectedLevel.reward_pool}
                  </Button>
                )
              }
              if (isCurrent) {
                return <p className="text-center text-purple-400 font-medium py-3">✨ This is your current level</p>
              }
              if (isPassed && isClaimed) {
                return <p className="text-center text-green-400 font-medium py-3">✓ Reward claimed</p>
              }
              return <p className="text-center text-zinc-500 py-3">🔒 Reach the unlock threshold to claim</p>
            })()}
          </div>
        </div>
      )}

      {/* Referral Link */}
      <div className="glass-card-solid p-4">
        {canShowReferralLink ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Link2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">{t('yourReferralLink')}</p>
                <p className="text-white font-mono text-sm truncate max-w-[200px] sm:max-w-none">
                  {typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${referralCode}` : '...'}
                </p>
              </div>
            </div>
            <Button onClick={copyReferralLink} variant="outline" size="sm">
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-600/30 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">Loading referral link...</p>
          </div>
        )}
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card-solid p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00e28a]/[0.10] rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#00e28a]" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">{t('totalTeamVolume')}</p>
              <p className="text-lg font-bold text-white">${totalTeamVolume.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="glass-card-solid p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">{t('l1Volume')}</p>
              <p className="text-lg font-bold text-white">${level1Volume.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="glass-card-solid p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">{t('totalTeam')}</p>
              <p className="text-lg font-bold text-white">{totalTeamMembers}</p>
            </div>
          </div>
        </div>
        <div className="glass-card-solid p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/[0.06] rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-white/75" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">{t('directReferrals')}</p>
              <p className="text-lg font-bold text-white">{level1Members}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members Table */}
      <div className="glass-card-solid overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">{t('teamMembers')}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select options={[{ value: 'all', label: t('allLevels') }, ...uniqueLevels.map(l => ({ value: l.toString(), label: t('levelN', { n: l }) }))]} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-28 text-sm" />
            <button
              type="button"
              onClick={() => setOnlyWithBalance(v => !v)}
              aria-pressed={onlyWithBalance}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                onlyWithBalance
                  ? 'border-[#00e28a]/50 bg-[#00e28a]/15 text-[#00e28a]'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {onlyWithBalance ? <CheckCircle className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              {t('onlyWithBalance')}
            </button>
            <button
              type="button"
              onClick={() => setBalanceSort(s => (s === 'none' ? 'desc' : s === 'desc' ? 'asc' : 'none'))}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                balanceSort !== 'none'
                  ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {balanceSort === 'desc' ? <ChevronDown className="w-4 h-4" /> : balanceSort === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
              {t('sortBalance')}
            </button>
            <Button variant="outline" size="sm" onClick={handleRefreshBalances} disabled={loadingBalances}>
              <RefreshCw className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Staked</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedReferrals.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t('noReferrals')}</td></tr>
              ) : (
                paginatedReferrals.map((referral) => {
                  const country = getCountryByCode(referral.country_code || '')
                  return (
                    <tr key={referral.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-white">{referral.username || '-'}</td>
                      <td className="px-4 py-3"><span className="text-xl">{country?.flag || '🌍'}</span></td>
                      <td className="px-4 py-3"><span className={`font-medium ${(referral.usdc_balance || 0) > 0 ? 'text-[#00e28a]' : 'text-zinc-400'}`}>${(referral.usdc_balance || 0).toFixed(2)}</span></td>
                      <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-zinc-700 text-zinc-300">L{referral.level}</span></td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{getContact(referral)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-zinc-400">Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredReferrals.length)} of {filteredReferrals.length}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Unlock Progress Modal */}
      {showUnlockModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowUnlockModal(false)}
        >
          <div 
            className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{t('unlockProgress')}</h3>
              <button 
                onClick={() => setShowUnlockModal(false)}
                className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              {/* L1-3 Team Volume */}
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-zinc-300 text-sm">L1-3 Team Volume</span>
                </div>
                <span className="text-white font-medium">${(status?.team_volume_l123 || 0).toFixed(2)}</span>
              </div>
              
              {/* Tasks Bonus */}
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-purple-400" />
                  <span className="text-zinc-300 text-sm">Tasks Bonus</span>
                </div>
                <span className="text-white font-medium">${taskBonus.toFixed(2)}</span>
              </div>
              
              {/* Calculation */}
              <div className="border-t border-white/10 pt-3 mt-3">
                <div className="text-center text-sm text-zinc-400 mb-2">
                  ${(status?.team_volume_l123 || 0).toFixed(2)} + ${taskBonus.toFixed(2)}
                </div>
                <div className="flex justify-between items-center p-3 bg-white/[0.04] border border-white/[0.08] rounded-lg">
                  <span className="text-white/65 font-medium">Total Unlock Progress</span>
                  <span className="text-xl font-bold text-white/85">${effectiveVolume.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Next Level Info */}
              <div className="text-center text-xs text-zinc-500 mt-2">
                {hasReachedThreshold
                  ? '✅ You have reached the threshold for current level!'
                  : `Need $${volumeToNextLevel.toFixed(2)} more to reach next level`
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim 弹窗：首次需身份验证；提交后进入审批 */}
      {claimModalLevel !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !claimSubmitting && setClaimModalLevel(null)}
        >
          <div
            className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {claimCongrats ? (
              /* ===== 祝贺 / 审核中 ===== */
              <div className="text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Congratulations on reaching {claimCongrats.levelName}!
                </h3>
                <p className="text-[var(--poly-purple)] text-2xl font-bold mb-3">
                  ${claimCongrats.amount}
                </p>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-200 mb-4">
                  🔒 Your reward is <span className="font-semibold">under review</span>. It will be
                  credited to your withdrawable balance once approved. If you have any questions,
                  please contact support.
                </div>
                <p className="text-[11px] text-zinc-400 mb-2">Need help? Contact our admin directly:</p>
                <a
                  href={SUPPORT_TELEGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full mb-2 py-2.5 rounded-lg bg-[#229ED9] text-white font-medium hover:opacity-90"
                >
                  <span className="text-base">✈️</span>
                  Contact on Telegram
                </a>
                <a
                  href={SUPPORT_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full mb-2 py-2.5 rounded-lg bg-[#25D366] text-white font-medium hover:opacity-90"
                >
                  <span className="text-base">🟢</span>
                  Chat on WhatsApp (Hossam)
                </a>
                <button
                  onClick={() => { setClaimModalLevel(null); setClaimCongrats(null) }}
                  className="w-full py-2.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
                >
                  Done
                </button>
              </div>
            ) : (
              /* ===== 提交表单 ===== */
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Claim ${levels.find(l => l.level === claimModalLevel)?.reward_pool} ·{' '}
                    {levels.find(l => l.level === claimModalLevel)?.name}
                  </h3>
                  <button
                    onClick={() => !claimSubmitting && setClaimModalLevel(null)}
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mb-4">
                  Reward claims are reviewed manually to verify account ownership. After you submit,
                  your reward goes into review and is credited once approved.
                </p>

                {!hasIdentity && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Real name</label>
                      <input
                        type="text"
                        value={claimRealName}
                        onChange={(e) => setClaimRealName(e.target.value)}
                        placeholder="Your full real name"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--poly-purple)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Phone number (with country code)</label>
                      <div className="flex gap-2">
                        <div className="w-28 shrink-0">
                          <SearchableSelect
                            options={countries.map(c => ({
                              value: c.dialCode,
                              label: `${c.flag} ${c.dialCode}`,
                              search: `${c.name} ${c.code} ${c.dialCode}`,
                            }))}
                            value={claimPhoneCode}
                            onChange={setClaimPhoneCode}
                            placeholder="Code"
                            searchPlaceholder="Search country / code"
                          />
                        </div>
                        <input
                          type="tel"
                          inputMode="tel"
                          value={claimPhoneNumber}
                          onChange={(e) => setClaimPhoneNumber(e.target.value)}
                          placeholder="Phone number"
                          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--poly-purple)]"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Required for your first claim only. Used to verify account ownership during review.
                    </p>
                  </div>
                )}

                <button
                  onClick={submitClaim}
                  disabled={claimSubmitting}
                  className="w-full py-2.5 rounded-lg bg-[var(--poly-purple)] text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {claimSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  {claimSubmitting ? 'Submitting…' : 'Submit for review'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
