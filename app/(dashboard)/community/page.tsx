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
        const data = await res.json()
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

      {/* Current Level Card */}
      <div className={`bg-gradient-to-br ${currentLevelInfo ? getLevelColor(currentLevelInfo.level) : 'from-zinc-600 to-zinc-700'} rounded-2xl p-6 text-white shadow-xl`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {status?.is_influencer && (
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">⭐ {t('influencer')}</span>
              )}
              {status?.is_admin_set && (
                <span className="px-2 py-0.5 bg-amber-500/30 rounded-full text-xs font-medium">🎁 {t('specialLevel')}</span>
              )}
            </div>
            <p className="text-white/70 text-sm">{t('currentLevel')}</p>
            <p className="text-4xl font-bold flex items-center gap-3">
              {currentLevelInfo ? (
                <>
                  {getLevelIcon(currentLevelInfo.level)}
                  {currentLevelInfo.name}
                </>
              ) : (
                t('notUnlocked')
              )}
            </p>
          </div>
          {currentLevelInfo && currentLevelInfo.daily_rate > 0 && (
            <div className="text-right">
              <p className="text-white/70 text-sm">{t('dailyEarnings')}</p>
              <p className="text-3xl font-bold currency">${dailyEarningAmount.toFixed(2)}</p>
              <p className="text-white/70 text-xs font-mono">
                {currentLevelInfo.reward_pool} × {(currentLevelInfo.daily_rate * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Progress to Next Level */}
        {nextLevelInfo && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('unlockProgress')}</span>
              <span className="text-white font-medium currency">${effectiveVolume.toFixed(2)} / ${nextUnlockVolume.toFixed(2)}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/70">{t('teamVolume')}: <span className="currency">${(status?.team_volume_l123 || 0).toFixed(2)}</span></span>
                <span className="text-white/70">{t('taskRewards')}: <span className="currency">${taskBonus.toFixed(2)}</span></span>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-white">{t('needMore', { amount: volumeToNextLevel.toFixed(2), level: nextLevelInfo.name })}</span>
              </div>
            </div>
          </div>
        )}

        {!nextLevelInfo && status?.current_level === 6 && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <p className="text-white font-medium">{t('maxLevel')}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('effectiveProgress')}</p>
              <p className="text-2xl font-bold text-indigo-400 currency">${effectiveVolume.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('l123Volume')}</p>
              <p className="text-2xl font-bold text-white currency">${(status?.team_volume_l123 || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Gift className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('taskBonusProgress')}</p>
              <p className="text-2xl font-bold text-purple-400 currency">${taskBonus.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t('totalCommunityEarned')}</p>
              <p className="text-2xl font-bold text-green-400 currency">${(status?.total_community_earned || 0).toFixed(2)}</p>
            </div>
          </div>
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
            const isUnlocked = (status?.real_level || 0) >= level.level
            const isCurrent = status?.current_level === level.level
            const isClaimed = claimedLevels.includes(level.level)
            const canClaim = claimableLevels.includes(level.level)
            const unlockVolume = status?.is_influencer ? level.unlock_volume_influencer : level.unlock_volume_normal

            return (
              <div 
                key={level.level}
                className={`relative rounded-xl p-4 border-2 transition-all ${
                  isCurrent ? 'border-purple-500 bg-purple-500/10' : isUnlocked ? 'border-white/10 bg-white/5' : 'border-zinc-700 bg-zinc-800/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${getLevelColor(level.level)} text-white`}>
                      {getLevelIcon(level.level)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">Level {level.level} - {level.name}</span>
                        {isCurrent && <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">{t('current')}</span>}
                        {isClaimed && <span className="px-2 py-0.5 bg-white/20 text-zinc-300 text-xs rounded-full">{t('claimed')}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-500 mt-1">
                        <span>{t('rewardPool')}: <span className="font-medium text-zinc-300 currency">${level.reward_pool}</span></span>
                        <span>{t('dailyRate')}: <span className="font-medium text-zinc-300 percentage">{(level.daily_rate * 100).toFixed(1)}%</span></span>
                        <span>{t('unlockCondition')}: <span className="font-medium text-zinc-300 currency">${unlockVolume}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isUnlocked ? <Unlock className="w-5 h-5 text-purple-400" /> : <Lock className="w-5 h-5 text-zinc-500" />}
                    {canClaim && (
                      <Button size="sm" onClick={() => handleClaim(level.level)} disabled={claiming === level.level}>
                        {claiming === level.level ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                          <>
                            <Gift className="w-4 h-4 mr-1" />
                            {t('claimReward')} ${level.reward_pool}
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
