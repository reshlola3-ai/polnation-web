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
  Link2
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { getCountryByCode } from '@/lib/countries'
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
  dailyEarnings: DailyEarning[]
  dailyEarningAmount: number
  lastDailyDistribution?: string
}

interface DailyEarning {
  id: string
  earning_date: string
  level: number
  earning_amount: number
  is_credited: boolean
}

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
  const [dailyEarningAmount, setDailyEarningAmount] = useState(0)
  const [effectiveVolume, setEffectiveVolume] = useState(0)
  const [taskBonus, setTaskBonus] = useState(0)
  const [lastDistribution, setLastDistribution] = useState<string | null>(null)
  
  // Referral state
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [filteredReferrals, setFilteredReferrals] = useState<Referral[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [totalTeamMembers, setTotalTeamMembers] = useState(0)
  const [level1Members, setLevel1Members] = useState(0)
  const [totalTeamVolume, setTotalTeamVolume] = useState(0)
  const [level1Volume, setLevel1Volume] = useState(0)
  const [levelFilter, setLevelFilter] = useState('all')
  const [usdcFilter, setUsdcFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [claiming, setClaiming] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showAllLevels, setShowAllLevels] = useState(false)
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [selectedLevel, setSelectedLevel] = useState<CommunityLevel | null>(null)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)

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
        setDailyEarningAmount(data.dailyEarningAmount || 0)
        setEffectiveVolume(data.effectiveVolume || 0)
        setTaskBonus(data.taskBonus || 0)
        setLastDistribution(data.lastDailyDistribution || null)
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
    if (usdcFilter === 'has_usdc') {
      filtered = filtered.filter(r => (r.usdc_balance || 0) > 0)
    } else if (usdcFilter === 'no_usdc') {
      filtered = filtered.filter(r => (r.usdc_balance || 0) === 0)
    }
    setFilteredReferrals(filtered)
    setCurrentPage(1)
  }, [levelFilter, usdcFilter, referrals])

  const handleClaim = async (level: number) => {
    setClaiming(level)
    setMessage(null)
    try {
      const res = await fetch('/api/community/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || tErrors('claimFailed') })
        return
      }
      setMessage({ type: 'success', text: data.message })
      fetchCommunityStatus()
    } catch {
      setMessage({ type: 'error', text: tErrors('networkError') })
    } finally {
      setClaiming(null)
    }
  }

  const handleRefreshBalances = async () => {
    setLoadingBalances(true)
    await fetchReferrals()
    setLoadingBalances(false)
  }

  const copyReferralLink = () => {
    if (userId) {
      navigator.clipboard.writeText(`${window.location.origin}/register?ref=${userId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getLevelIcon = (level: number, size: number = 32) => {
    const validLevel = Math.min(Math.max(level, 1), 6)
    return (
      <Image 
        src={`/levels/level-${validLevel}.png`}
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

  // Locked state for wallet users without email
  if (isLocked) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-zinc-500">{t('subtitle')}</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/90 via-zinc-900/95 to-black" />
          <div className="relative z-10 p-8 md:p-12 text-center">
            <div className="w-20 h-20 bg-zinc-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-zinc-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white/80 mb-4">{t('accountLocked')}</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">{t('bindEmailToUnlock')}</p>
            <a href="/tasks" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold rounded-xl">
              <Unlock className="w-5 h-5" />
              {t('goBindEmail')}
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/80 via-blue-900/90 to-indigo-950" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cyan-500/20 to-transparent" />
        
        <div className="relative z-10 p-5">
          {/* Top Right: Badges & Help */}
          <div className="flex items-center justify-end gap-3 mb-4">
            {status?.is_influencer && (
              <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-full text-xs font-bold">⭐ Influencer</span>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowHelpTooltip(!showHelpTooltip)}
                className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white/70 text-xs font-bold">?</span>
              </button>
              <div className={`absolute right-0 top-9 w-64 p-3 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 transition-all duration-200 ${showHelpTooltip ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
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
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm">
                {getLevelIcon(currentLevelInfo?.level || 1, 128)}
              </div>
              <p className="text-xs text-cyan-300/60 uppercase tracking-wider mt-3">{t('currentLevel')}</p>
              <p className="text-xl font-bold text-white">{currentLevelInfo?.name || 'Bronze'}</p>
              <p className="text-xs text-zinc-500 mt-1">Tap to enlarge</p>
            </div>
            
            {/* Right: Stats Grid 2x2 */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-300/60">{t('rewardPool')}</p>
                <p className="text-xl font-bold text-white">${currentLevelInfo?.reward_pool || 10}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-300/60">{t('dailyRate')}</p>
                <p className="text-xl font-bold text-cyan-400">{currentLevelInfo ? `${(currentLevelInfo.daily_rate * 100).toFixed(1)}%` : '0%'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-300/60">{t('dailyEarnings')}</p>
                <p className="text-xl font-bold text-green-400">+${dailyEarningAmount.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-300/60">{t('nextDistribution')}</p>
                <p className="text-xl font-bold text-amber-400">
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
              <span className="text-cyan-300/80 text-sm flex items-center gap-1">
                {t('unlockProgress')}
                <span className="w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center">?</span>
              </span>
              <span className="text-white font-medium text-sm">${effectiveVolume.toFixed(2)} / ${nextUnlockVolume.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all ${hasReachedThreshold ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`} style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-300/60 text-xs">
                {hasReachedThreshold ? '✓ Threshold reached!' : `Need $${volumeToNextLevel.toFixed(2)} more`}
              </span>
              {claimableLevels.length > 0 && (
                <Button size="sm" onClick={(e) => { e.stopPropagation(); handleClaim(claimableLevels[0]); }} disabled={claiming !== null} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs">
                  {claiming !== null ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Gift className="w-3 h-3 mr-1" /> Claim ${currentLevelInfo?.reward_pool}</>}
                </Button>
              )}
            </div>
          </div>

          {/* Toggle All Levels */}
          <button onClick={() => setShowAllLevels(!showAllLevels)} className="w-full mt-3 py-2 text-center text-cyan-300/60 hover:text-cyan-300 text-sm flex items-center justify-center gap-1">
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
                    <p>{(level.daily_rate * 100).toFixed(1)}% daily</p>
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
                <p className="text-2xl font-bold text-cyan-400">{(selectedLevel.daily_rate * 100).toFixed(1)}%</p>
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
                <span className="text-amber-400 font-medium">${selectedLevel.unlock_volume_influencer}</span>
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
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3"
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">{t('yourReferralLink')}</p>
              <p className="text-white font-mono text-sm truncate max-w-[200px] sm:max-w-none">
                {userId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${userId.slice(0, 8)}...` : '...'}
              </p>
            </div>
          </div>
          <Button onClick={copyReferralLink} variant="outline" size="sm">
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card-solid p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
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
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-amber-400" />
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
          <div className="flex items-center gap-3">
            <Select options={[{ value: 'all', label: 'All Levels' }, ...uniqueLevels.map(l => ({ value: l.toString(), label: `Level ${l}` }))]} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-28 text-sm" />
            <Select options={[{ value: 'all', label: 'All' }, { value: 'has_usdc', label: 'Has USDC' }, { value: 'no_usdc', label: 'No USDC' }]} value={usdcFilter} onChange={(e) => setUsdcFilter(e.target.value)} className="w-28 text-sm" />
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
                      <td className="px-4 py-3"><span className={`font-medium ${(referral.usdc_balance || 0) > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>${(referral.usdc_balance || 0).toFixed(2)}</span></td>
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
                <div className="flex justify-between items-center p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <span className="text-cyan-300 font-medium">Total Unlock Progress</span>
                  <span className="text-xl font-bold text-cyan-400">${effectiveVolume.toFixed(2)}</span>
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
    </div>
  )
}
