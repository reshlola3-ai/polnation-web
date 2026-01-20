'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Users, 
  Trophy, 
  TrendingUp, 
  Gift, 
  Lock, 
  Unlock,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  Star,
  Zap,
  Crown
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTranslations } from 'next-intl'

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
}

interface DailyEarning {
  id: string
  earning_date: string
  level: number
  earning_amount: number
  is_credited: boolean
}

export default function CommunityPage() {
  const t = useTranslations('community')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  
  const [isLocked, setIsLocked] = useState(false)
  const [hasReachedThreshold, setHasReachedThreshold] = useState(false)
  const [status, setStatus] = useState<CommunityStatus | null>(null)
  const [levels, setLevels] = useState<CommunityLevel[]>([])
  const [currentLevelInfo, setCurrentLevelInfo] = useState<CommunityLevel | null>(null)
  const [nextLevelInfo, setNextLevelInfo] = useState<CommunityLevel | null>(null)
  const [nextUnlockVolume, setNextUnlockVolume] = useState(0)
  const [volumeToNextLevel, setVolumeToNextLevel] = useState(0)
  const [claimedLevels, setClaimedLevels] = useState<number[]>([])
  const [claimableLevels, setClaimableLevels] = useState<number[]>([])
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([])
  const [dailyEarningAmount, setDailyEarningAmount] = useState(0)
  const [effectiveVolume, setEffectiveVolume] = useState(0)
  const [taskBonus, setTaskBonus] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [claiming, setClaiming] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/community/status')
      if (res.ok) {
        const data: ApiResponse = await res.json()
        setIsLocked(data.isLocked || false)
        setHasReachedThreshold(data.hasReachedThreshold || false)
        setStatus(data.status)
        setLevels(data.levels || [])
        setCurrentLevelInfo(data.currentLevelInfo)
        setNextLevelInfo(data.nextLevelInfo)
        setNextUnlockVolume(data.nextUnlockVolume)
        setVolumeToNextLevel(data.volumeToNextLevel)
        setClaimedLevels(data.claimedLevels || [])
        setClaimableLevels(data.claimableLevels || [])
        setDailyEarnings(data.dailyEarnings || [])
        setDailyEarningAmount(data.dailyEarningAmount || 0)
        setEffectiveVolume(data.effectiveVolume || 0)
        setTaskBonus(data.taskBonus || 0)
      }
    } catch (err) {
      console.error('Failed to fetch status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

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
      fetchStatus()
    } catch {
      setMessage({ type: 'error', text: tErrors('networkError') })
    } finally {
      setClaiming(null)
    }
  }

  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <Star className="w-5 h-5" />
      case 2: return <Star className="w-5 h-5" />
      case 3: return <Trophy className="w-5 h-5" />
      case 4: return <Crown className="w-5 h-5" />
      case 5: return <Zap className="w-5 h-5" />
      case 6: return <Crown className="w-5 h-5" />
      default: return <Star className="w-5 h-5" />
    }
  }

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'from-amber-600 to-amber-700'
      case 2: return 'from-slate-400 to-slate-500'
      case 3: return 'from-yellow-500 to-amber-500'
      case 4: return 'from-cyan-400 to-blue-500'
      case 5: return 'from-purple-500 to-pink-500'
      case 6: return 'from-rose-500 to-red-600'
      default: return 'from-zinc-500 to-zinc-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  const progressPercent = nextUnlockVolume > 0 
    ? Math.min(100, (effectiveVolume / nextUnlockVolume) * 100)
    : 100

  // 锁定状态：钱包用户未绑定邮箱
  if (isLocked) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-zinc-500">{t('subtitle')}</p>
          </div>
        </div>

        {/* Locked State */}
        <div className="relative overflow-hidden rounded-3xl">
          {/* Dark locked background */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/90 via-zinc-900/95 to-black" />
          <div className="absolute inset-0 bg-[url('/pool-waves.svg')] bg-repeat-x bg-bottom opacity-10" />
          
          <div className="relative z-10 p-8 md:p-12 text-center">
            <div className="w-20 h-20 bg-zinc-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-zinc-400" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-white/80 mb-4">
              {t('accountLocked') || 'Community Account Locked'}
            </h2>
            
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              {t('bindEmailToUnlock') || 'Bind your email to unlock your Community Account and start earning rewards.'}
            </p>

            <a 
              href="/tasks" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/30"
            >
              <Unlock className="w-5 h-5" />
              {t('goBindEmail') || 'Go Bind Email'}
            </a>

            {/* Preview of what they can unlock */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-zinc-500 text-sm mb-4">{t('unlockPreview') || 'After binding email, you will start at:'}</p>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider">Level</p>
                  <p className="text-2xl font-bold text-white">Bronze</p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider">{t('rewardPool')}</p>
                  <p className="text-2xl font-bold text-amber-400">$10</p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider">{t('unlockCondition')}</p>
                  <p className="text-2xl font-bold text-cyan-400">$100</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-500">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {tCommon('refresh')}
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Main Pool Card - Water Pool Effect */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Water Pool Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/80 via-blue-900/90 to-indigo-950" />
        <div className="absolute inset-0 bg-[url('/pool-waves.svg')] bg-repeat-x bg-bottom opacity-20 animate-pulse" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/20 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        
        {/* Floating bubbles effect */}
        <div className="absolute bottom-10 left-[10%] w-3 h-3 bg-white/20 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-20 left-[30%] w-2 h-2 bg-white/15 rounded-full animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute bottom-16 right-[20%] w-4 h-4 bg-white/10 rounded-full animate-bounce" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        
        <div className="relative z-10 p-6 md:p-8">
          {/* Header with Status Badges & Help */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              {status?.is_influencer && (
                <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-full text-xs font-bold shadow-lg shadow-amber-500/30">
                  ⭐ {t('influencer')}
                </span>
              )}
              {status?.is_admin_set && (
                <span className="px-3 py-1 bg-purple-500/30 border border-purple-400/50 text-purple-200 rounded-full text-xs font-medium">
                  🎁 {t('specialLevel')}
                </span>
              )}
              {!status?.is_influencer && !status?.is_admin_set && (
                <span className="px-3 py-1 bg-white/10 text-white/70 rounded-full text-xs font-medium">
                  👤 {t('normalUser') || 'Normal User'}
                </span>
              )}
            </div>
            
            {/* Help Button */}
            <div className="relative group">
              <button className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <span className="text-white/70 text-sm font-bold">?</span>
              </button>
              {/* Tooltip */}
              <div className="absolute right-0 top-10 w-72 p-4 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <h4 className="text-white font-semibold mb-2">📖 {t('rulesTitle') || 'Community Account Rules'}</h4>
                <ul className="text-xs text-zinc-400 space-y-2">
                  <li>• <strong className="text-white">{t('rulePool') || 'Prize Pool'}</strong>: {t('rulePoolDesc') || 'Base amount for daily earnings'}</li>
                  <li>• <strong className="text-white">{t('ruleDailyRate') || 'Daily Rate'}</strong>: {t('ruleDailyRateDesc') || 'Your earnings = Pool × Rate'}</li>
                  <li>• <strong className="text-white">{t('ruleUnlock') || 'Unlock'}</strong>: {t('ruleUnlockDesc') || 'Reach volume threshold to unlock levels'}</li>
                  <li>• <strong className="text-white">{t('ruleInfluencer') || 'Influencer'}</strong>: {t('ruleInfluencerDesc') || 'Lower unlock requirements'}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Stats Display */}
          <div className="text-center mb-8">
            <p className="text-cyan-300/80 text-sm uppercase tracking-wider mb-2">{t('currentLevel')}</p>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              {currentLevelInfo ? (
                <>
                  {getLevelIcon(currentLevelInfo.level)}
                  {currentLevelInfo.name}
                </>
              ) : (
                <span className="text-white/50">{t('notUnlocked')}</span>
              )}
            </h2>
            
            {/* Prize Pool & Daily Rate */}
            <div className="flex items-center justify-center gap-8 mt-6">
              <div className="text-center">
                <p className="text-cyan-300/60 text-xs uppercase tracking-wider">{t('rewardPool') || 'Prize Pool'}</p>
                <p className="text-3xl md:text-4xl font-bold text-white currency">
                  ${currentLevelInfo?.reward_pool || 0}
                </p>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-center">
                <p className="text-cyan-300/60 text-xs uppercase tracking-wider">{t('dailyRate')}</p>
                <p className="text-3xl md:text-4xl font-bold text-cyan-400 percentage">
                  {currentLevelInfo ? `${(currentLevelInfo.daily_rate * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-center">
                <p className="text-cyan-300/60 text-xs uppercase tracking-wider">{t('dailyEarnings')}</p>
                <p className="text-3xl md:text-4xl font-bold text-green-400 currency">
                  +${dailyEarningAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards - Integrated */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-cyan-400" />
                <p className="text-xs text-cyan-300/70">{t('unlockProgress') || 'Unlock Progress'}</p>
              </div>
              <p className="text-xl font-bold text-white currency">${effectiveVolume.toFixed(2)}</p>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-cyan-300/70">{t('l123Volume')}</p>
              </div>
              <p className="text-xl font-bold text-white currency">${(status?.team_volume_l123 || 0).toFixed(2)}</p>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-cyan-300/70">{t('taskBonusProgress')}</p>
              </div>
              <p className="text-xl font-bold text-white currency">${taskBonus.toFixed(2)}</p>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <p className="text-xs text-cyan-300/70">{t('totalCommunityEarned')}</p>
              </div>
              <p className="text-xl font-bold text-green-400 currency">${(status?.total_community_earned || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Progress Bar & Claim Button */}
          {currentLevelInfo && (
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cyan-300/80 text-sm">
                  {hasReachedThreshold 
                    ? (t('readyToClaim') || `Ready to claim ${currentLevelInfo.name} reward!`)
                    : (t('unlockProgress') || 'Unlock Progress')}
                </span>
                <span className="text-white font-medium text-sm currency">${effectiveVolume.toFixed(2)} / ${nextUnlockVolume.toFixed(2)}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 relative ${
                    hasReachedThreshold 
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                {hasReachedThreshold ? (
                  <span className="text-green-400 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {t('thresholdReached') || 'Threshold reached! Claim your reward'}
                  </span>
                ) : (
                  <span className="text-cyan-300/60 text-xs">
                    {t('needMore', { amount: volumeToNextLevel.toFixed(2), level: currentLevelInfo.name })}
                  </span>
                )}
                
                {/* Claim Button - Show when threshold reached and not claimed */}
                {claimableLevels.length > 0 && (
                  <Button 
                    size="sm" 
                    onClick={() => handleClaim(claimableLevels[0])}
                    disabled={claiming !== null}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-green-500/30 animate-pulse"
                  >
                    {claiming !== null ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-1" />
                        {t('claimAndUpgrade') || 'Claim'} ${currentLevelInfo.reward_pool}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {status?.current_level && status.current_level > 6 && (
            <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 backdrop-blur rounded-xl p-4 text-center border border-amber-500/30">
              <Crown className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-white font-medium">{t('maxLevel')}</p>
            </div>
          )}
        </div>
      </div>

      {/* All Levels */}
      <div className="glass-card-solid p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          {t('allLevels')}
        </h2>

        <div className="space-y-3">
          {levels.map((level) => {
            // 新逻辑：当前等级是用户所在的等级，已领取的是已经通过的等级
            const isCurrent = status?.current_level === level.level
            const isClaimed = claimedLevels.includes(level.level)
            const isPassed = level.level < (status?.current_level || 1) // 已经通过的等级
            const isFuture = level.level > (status?.current_level || 1) // 未来等级
            const canClaim = claimableLevels.includes(level.level)
            const unlockVolume = status?.is_influencer ? level.unlock_volume_influencer : level.unlock_volume_normal

            return (
              <div 
                key={level.level}
                className={`relative rounded-xl p-4 border-2 transition-all ${
                  isCurrent 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : isPassed 
                      ? 'border-green-500/30 bg-green-500/5' 
                      : 'border-zinc-700 bg-zinc-800/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${getLevelColor(level.level)} text-white ${isPassed ? 'opacity-50' : ''}`}>
                      {getLevelIcon(level.level)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isPassed ? 'text-zinc-400' : 'text-white'}`}>Level {level.level} - {level.name}</span>
                        {isCurrent && <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">{t('current')}</span>}
                        {isPassed && isClaimed && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t('claimed')}</span>}
                        {canClaim && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full animate-pulse">{t('canClaim') || 'Can Claim!'}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-500 mt-1">
                        <span>{t('rewardPool')}: <span className={`font-medium ${isPassed ? 'text-zinc-500' : 'text-zinc-300'} currency`}>${level.reward_pool}</span></span>
                        <span>{t('dailyRate')}: <span className={`font-medium ${isPassed ? 'text-zinc-500' : 'text-zinc-300'} percentage`}>{(level.daily_rate * 100).toFixed(1)}%</span></span>
                        <span>{t('unlockCondition')}: <span className={`font-medium ${isPassed ? 'text-zinc-500' : 'text-zinc-300'} currency`}>${unlockVolume}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPassed ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : isCurrent ? (
                      <Star className="w-5 h-5 text-purple-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-zinc-500" />
                    )}
                    {canClaim && (
                      <Button size="sm" onClick={() => handleClaim(level.level)} disabled={claiming === level.level} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500">
                        {claiming === level.level ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                          <>
                            <Gift className="w-4 h-4 mr-1" />
                            {t('claimAndUpgrade') || 'Claim'} ${level.reward_pool}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {isCurrent && level.daily_rate > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
                    <span className="text-zinc-500">{t('dailyEarnings')}</span>
                    <span className="font-semibold text-green-400">+${(level.reward_pool * level.daily_rate).toFixed(2)} USDC/day</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily Earnings History */}
      {dailyEarnings.length > 0 && (
        <div className="glass-card-solid p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('dailyEarningsHistory')}
          </h2>
          <div className="space-y-2">
            {dailyEarnings.map((earning) => (
              <div key={earning.id} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${getLevelColor(earning.level)} text-white text-xs`}>
                    L{earning.level}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Level {earning.level} {t('dailyEarnings')}</p>
                    <p className="text-xs text-zinc-500">{new Date(earning.earning_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-400 currency">+${earning.earning_amount.toFixed(4)}</p>
                  {earning.is_credited ? <span className="text-xs text-zinc-400">Credited</span> : <span className="text-xs text-amber-400">Pending</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dailyEarnings.length === 0 && (
        <div className="glass-card-solid p-6 text-center">
          <p className="text-zinc-500">{t('noEarnings')}</p>
        </div>
      )}
    </div>
  )
}
