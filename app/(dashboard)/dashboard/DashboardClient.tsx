'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Copy, Check, Sparkles, Wallet, TrendingUp, Users, Lock,
  ArrowUpRight, CheckCircle, Circle, AlertCircle,
  ChevronRight, DollarSign, Zap, HelpCircle, X
} from 'lucide-react'
import { ConnectWallet } from '@/components/wallet/ConnectWallet'
import { PermitSigner } from '@/components/wallet/PermitSigner'
import { AuroraCard } from '@/components/ui/AuroraCard'
import { useAccount, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'

// Earning tiers - must match database profit_tiers table
// rate is daily rate as decimal (0.0075 = 0.75%)
// Distribution: Once per day (24 hours)
const TIERS = [
  { min: 0, max: 9.99, rate: 0, name: 'Visitor' },
  { min: 10, max: 19.99, rate: 0.0075, name: 'Resident' },      // 0.75% daily (274% APY)
  { min: 20, max: 99.99, rate: 0.009, name: 'Citizen' },        // 0.90% daily (329% APY)
  { min: 100, max: 499.99, rate: 0.0105, name: 'Representative' }, // 1.05% daily (383% APY)
  { min: 500, max: 1999.99, rate: 0.012, name: 'Senator' },     // 1.20% daily (438% APY)
  { min: 2000, max: 9999.99, rate: 0.015, name: 'Ambassador' }, // 1.50% daily (548% APY)
  { min: 10000, max: Infinity, rate: 0.018, name: 'Chancellor' }, // 1.80% daily (657% APY)
]

function getTier(balance: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].min) {
      return { ...TIERS[i], index: i }
    }
  }
  return { ...TIERS[0], index: 0 }
}

function getNextTier(balance: number) {
  const currentIndex = getTier(balance).index
  if (currentIndex < TIERS.length - 1) {
    return TIERS[currentIndex + 1]
  }
  return null
}

function isWalletEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return email.endsWith('@wallet.polnation.com')
}

interface DashboardClientProps {
  userId: string
  profile: {
    username: string | null
    wallet_address: string | null
    profile_completed: boolean
    referral_code: string | null
    email: string | null
  } | null
  teamStats: {
    total_team_members: number
    level1_members: number
  }
}

interface ProfitData {
  totalStakingProfit: number
  totalCommissionProfit: number
  availableWithdraw: number
  hasSignature: boolean
  communityPrizePool: number
  currentLevelName: string
  communityDailyRate: number
  communityDailyEarnings: number
  baseCommunityDailyEarnings: number
  momentumMultiplier: number
  momentumDaysUntilDecay: number
  momentumNextMultiplier: number
  momentumRecentReferrals: number
  teamEffectiveVolume: number
  teamNextUnlockVolume: number
  teamNextLevelName: string
  communityTotalEarned: number
  taskBonus: number
  teamVolumeOnly: number
}

interface ReferralData {
  level: number
  usdc_balance: number
}

// Commission rates by level
const COMMISSION_RATES: Record<number, number> = {
  1: 0.10,  // L1: 10%
  2: 0.05,  // L2: 5%
  3: 0.04,  // L3: 4%
  4: 0.03,  // L4: 3%
  5: 0.02,  // L5: 2%
  6: 0.01,  // L6: 1%
}

// Tier icons mapping
const TIER_ICONS: Record<string, string> = {
  'Visitor': '👁️',
  'Resident': '🏠',
  'Citizen': '🎖️',
  'Representative': '📋',
  'Senator': '🏛️',
  'Ambassador': '🌐',
  'Chancellor': '👑',
}

export function DashboardClient({ userId, profile, teamStats }: DashboardClientProps) {
  const t = useTranslations('dashboard')
  const { address, isConnected } = useAccount()
  const [copied, setCopied] = useState(false)
  const [showEarningsModal, setShowEarningsModal] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [estDailyCommission, setEstDailyCommission] = useState(0)
  const [spinCount, setSpinCount] = useState(0)
  const [profitData, setProfitData] = useState<ProfitData>({
    totalStakingProfit: 0,
    totalCommissionProfit: 0,
    availableWithdraw: 0,
    hasSignature: false,
    communityPrizePool: 10,
    currentLevelName: 'Bronze',
    communityDailyRate: 0,
    communityDailyEarnings: 0,
    baseCommunityDailyEarnings: 0,
    momentumMultiplier: 1.0,
    momentumDaysUntilDecay: 0,
    momentumNextMultiplier: 0.8,
    momentumRecentReferrals: 0,
    teamEffectiveVolume: 0,
    teamNextUnlockVolume: 0,
    teamNextLevelName: '',
    communityTotalEarned: 0,
    taskBonus: 0,
    teamVolumeOnly: 0,
  })
  const [isLoadingProfit, setIsLoadingProfit] = useState(true)

  // Use bound wallet or connected wallet
  const walletAddress = profile?.wallet_address || address

  // Read USDC balance
  const { data: usdcBalanceRaw, isLoading: isBalanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? Number(formatUnits(usdcBalanceRaw, 6)) : 0
  const currentTier = getTier(usdcBalance)
  const nextTier = getNextTier(usdcBalance)
  const dailyEarnings = usdcBalance * currentTier.rate
  const yearlyAPY = currentTier.rate * 365 * 100

  // Progress to next tier
  const progressToNext = nextTier 
    ? ((usdcBalance - currentTier.min) / (nextTier.min - currentTier.min)) * 100
    : 100

  // 🚀 sessionStorage 缓存 key
  const CACHE_KEY = `dashboard_cache_${userId}`
  const CACHE_TTL = 30 * 1000 // 30 seconds

  // 🚀 从 sessionStorage 恢复缓存（页面回退时瞬间显示）
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < CACHE_TTL * 2) {
          // 用缓存数据先渲染，后台再刷新
          if (data.profitData) setProfitData(prev => ({ ...prev, ...data.profitData }))
          if (data.estDailyCommission) setEstDailyCommission(data.estDailyCommission)
          setIsLoadingProfit(false) // 缓存有数据就不显示 loading
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 保存到 sessionStorage
  const saveToCache = (profitDataUpdate: Partial<ProfitData>, commission?: number) => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      const existing = cached ? JSON.parse(cached).data : {}
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: {
          ...existing,
          profitData: { ...existing.profitData, ...profitDataUpdate },
          ...(commission !== undefined && { estDailyCommission: commission }),
        },
        timestamp: Date.now(),
      }))
    } catch { /* ignore */ }
  }

  // Fetch profit data
  const fetchProfitData = async () => {
    try {
      const res = await fetch('/api/profits/user')
      if (res.ok) {
        const data = await res.json()
        const profits = data.profits || {}
        const update = {
          totalStakingProfit: profits.total_earned_usdc || 0,
          totalCommissionProfit: profits.total_commission_earned || 0,
          availableWithdraw: profits.available_usdc || 0,
          hasSignature: data.hasSignature || false,
        }
        setProfitData(prev => ({ ...prev, ...update }))
        saveToCache(update)
      }
    } catch (err) {
      console.error('Error fetching profit data:', err)
    } finally {
      setIsLoadingProfit(false)
    }
  }

  // Fetch community status for prize pool + momentum + team progress
  const fetchCommunityStatus = async () => {
    try {
      const res = await fetch('/api/community/status')
      if (res.ok) {
        const data = await res.json()
        const momentum = data.momentum || {}
        const update = {
          communityPrizePool: data.currentLevelInfo?.reward_pool || 10,
          currentLevelName: data.currentLevelInfo?.name || 'Bronze',
          communityDailyRate: (data.currentLevelInfo?.daily_rate || 0) * 100,
          communityDailyEarnings: data.dailyEarningAmount || 0,
          baseCommunityDailyEarnings: data.baseDailyEarning || 0,
          momentumMultiplier: momentum.multiplier || 1.0,
          momentumDaysUntilDecay: momentum.daysUntilDecay || 0,
          momentumNextMultiplier: momentum.nextMultiplierAfterDecay || 0.8,
          momentumRecentReferrals: momentum.recentReferrals || 0,
          teamEffectiveVolume: data.effectiveVolume || 0,
          teamNextUnlockVolume: data.nextUnlockVolume || 0,
          teamNextLevelName: data.nextLevelInfo?.name || '',
          communityTotalEarned: data.status?.total_community_earned || 0,
          taskBonus: data.taskBonus || 0,
          teamVolumeOnly: data.status?.team_volume_l123 || 0,
        }
        setProfitData(prev => ({ ...prev, ...update }))
        saveToCache(update)
      }
    } catch (err) {
      console.error('Error fetching community status:', err)
    }
  }

  // Fetch remaining Lucky Wheel spins
  const fetchSpinCount = async () => {
    try {
      const res = await fetch('/api/lottery')
      if (res.ok) {
        const data = await res.json()
        setSpinCount(data.remainingSpins || 0)
      }
    } catch { /* ignore */ }
  }

  // Fetch referrals and calculate estimated daily commission
  const fetchEstDailyCommission = async () => {
    try {
      const res = await fetch('/api/referral/balances')
      if (res.ok) {
        const data = await res.json()
        const referrals: ReferralData[] = data.referrals || []
        
        let totalCommission = 0
        referrals.forEach((ref: ReferralData) => {
          const refTier = getTier(ref.usdc_balance)
          const refDailyEarnings = ref.usdc_balance * refTier.rate
          const commissionRate = COMMISSION_RATES[ref.level] || 0
          totalCommission += refDailyEarnings * commissionRate
        })
        
        setEstDailyCommission(totalCommission)
        saveToCache({}, totalCommission)
      }
    } catch (err) {
      console.error('Error fetching referral data:', err)
    }
  }

  useEffect(() => {
    fetchProfitData()
    fetchCommunityStatus()
    fetchEstDailyCommission()
    fetchSpinCount()
  }, [])

  // Total Assets = wallet USDC + available to withdraw + community prize pool
  const totalAssets = usdcBalance + profitData.availableWithdraw + profitData.communityPrizePool
  // Referral link: only show short link if profile completed + real email bound
  const canShowReferralLink = profile?.profile_completed && !isWalletEmail(profile?.email) && !!profile?.referral_code
  const refCode = profile?.referral_code || userId
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?ref=${refCode}`
    : `https://polnation.com/register?ref=${refCode}`

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalEarned = profitData.totalStakingProfit + profitData.totalCommissionProfit
  const showPermitSigner = isConnected || !!profile?.wallet_address

  // If no wallet connected and no bound wallet
  if (!walletAddress) {
    return (
      <div className="space-y-4">
        {/* Hero - Connect Wallet CTA */}
        <AuroraCard className="p-6 md:p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {t('connectToStart')}
            </h2>
            <p className="text-purple-200 mb-6">
              {t('connectToStartDesc', { rate: '1.80%', apy: '657%' })}
            </p>
            <ConnectWallet />
            <p className="text-purple-300/70 text-xs mt-4">
              {t('supportedWallets')}
            </p>
          </div>
        </AuroraCard>

        {/* Referral Link */}
        {canShowReferralLink ? (
          <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} t={t} />
        ) : (
          <ReferralLinkLockedCard t={t} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hero - Total Assets with Aurora + 3D Tilt */}
      <AuroraCard className="p-5 md:p-8">
        {/* Total Assets Row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-purple-200 text-sm mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t('totalAssets')}
            </p>
            {isBalanceLoading ? (
              <div className="animate-pulse h-10 w-40 bg-white/20 rounded-lg" />
            ) : (
              <p className="text-4xl md:text-5xl font-bold text-white stat-number">
                ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div className="text-left md:text-right">
            <p className="text-purple-200 text-sm mb-1 flex items-center gap-2 md:justify-end">
              <Zap className="w-4 h-4" />
              {t('estDailyEarnings')}
            </p>
            <div className="flex items-center gap-2 md:justify-end">
              <p className="text-2xl md:text-3xl font-bold text-cyan-300 stat-number">
                ${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}<span className="text-lg text-cyan-400">{t('perDay')}</span>
              </p>
              <button 
                onClick={() => setShowEarningsModal(true)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                title="View calculation"
              >
                <HelpCircle className="w-5 h-5 text-cyan-300/70 hover:text-cyan-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Wallet + Tier Progress side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Wallet Balance */}
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-purple-200">{t('walletBalance')}</p>
              <img src="/usdc.webp" alt="USDC" className="w-7 h-7" />
            </div>
            {isBalanceLoading ? (
              <div className="animate-pulse h-7 w-24 bg-white/10 rounded" />
            ) : (
              <p className="text-xl font-bold text-white stat-number leading-tight">
                ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-[10px] text-white/50 mt-1">{t('usdcOnPolygon')}</p>
          </div>

          {/* Personal Tier — compact, tappable */}
          <div
            className="bg-white/10 rounded-xl p-4 backdrop-blur cursor-pointer hover:bg-white/15 transition-colors"
            onClick={() => setShowTierModal(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-purple-200">Personal Tier</p>
              <span className="text-base">{TIER_ICONS[currentTier.name] || '⭐'}</span>
            </div>
            <p className="text-sm font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent leading-tight">
              {currentTier.name}
            </p>
            <p className="text-[10px] text-cyan-300 mb-2">
              {(currentTier.rate * 100).toFixed(2)}%/day
              {yearlyAPY > 0 && <span className="text-white/40"> ({yearlyAPY.toFixed(0)}% APY)</span>}
            </p>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressToNext, 100)}%` }}
              />
            </div>
            {nextTier ? (
              <p className="text-[10px] text-purple-300/60 mt-1">
                ${(nextTier.min - usdcBalance).toFixed(2)} → {nextTier.name}
              </p>
            ) : (
              <p className="text-[10px] text-amber-400/70 mt-1">Max tier reached 👑</p>
            )}
            {usdcBalance < 10 && (
              <p className="text-[10px] text-amber-300 mt-1">{t('depositToStart')}</p>
            )}
          </div>
        </div>

        {/* Row 3: Community block — level info + unlock progress */}
        <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
          {/* Header: level + momentum + daily */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                🏆 {profitData.currentLevelName}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                profitData.momentumMultiplier >= 1.0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-white/10 text-white/40'
              }`}>
                🔥 {profitData.momentumMultiplier.toFixed(1)}x
              </span>
              {profitData.momentumDaysUntilDecay > 0 && (
                <span className="text-[10px] text-white/35">⏱️ {profitData.momentumDaysUntilDecay}d</span>
              )}
            </div>
            {isLoadingProfit ? (
              <div className="animate-pulse h-4 w-16 bg-white/10 rounded" />
            ) : (
              <span className="text-xs text-emerald-400 font-medium shrink-0">
                +${profitData.communityDailyEarnings.toFixed(3)}/day
              </span>
            )}
          </div>

          {/* Unlock Progress bar */}
          {profitData.teamNextUnlockVolume > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-purple-200/80">Unlock Progress</span>
                <span className="text-xs font-semibold text-emerald-400">
                  {Math.min(
                    (profitData.teamEffectiveVolume / profitData.teamNextUnlockVolume) * 100,
                    100
                  ).toFixed(0)}%
                  {profitData.teamNextLevelName && (
                    <span className="text-white/40 font-normal"> → {profitData.teamNextLevelName}</span>
                  )}
                </span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min((profitData.teamEffectiveVolume / profitData.teamNextUnlockVolume) * 100, 100)}%`
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  {profitData.teamVolumeOnly > 0 && (
                    <span>🌐 Team <span className="text-white/60">${profitData.teamVolumeOnly.toFixed(2)}</span></span>
                  )}
                  {profitData.taskBonus > 0 && (
                    <span>✅ Tasks <span className="text-white/60">${profitData.taskBonus.toFixed(2)}</span></span>
                  )}
                </div>
                <span className="text-[10px] text-white/40">
                  ${profitData.teamEffectiveVolume.toFixed(2)} / ${profitData.teamNextUnlockVolume.toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </AuroraCard>

      {/* Earnings Calculation Modal */}
      {showEarningsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEarningsModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📊 Earnings Calculation
              </h3>
              <button onClick={() => setShowEarningsModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Wallet Balance</span>
                  <span className="text-white font-medium">${usdcBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Current Tier</span>
                  <span className="text-white font-medium">{TIER_ICONS[currentTier.name]} {currentTier.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Daily Rate</span>
                  <span className="text-white font-medium">{(currentTier.rate * 100).toFixed(2)}%</span>
                </div>
              </div>
              
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <p className="text-zinc-400 text-xs mb-1">Staking Earnings</p>
                  <p className="text-green-400 font-mono text-sm">
                    ${usdcBalance.toFixed(2)} × {(currentTier.rate * 100).toFixed(2)}% = <span className="font-bold">${dailyEarnings.toFixed(4)}</span>/day
                  </p>
                </div>
                
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                  <p className="text-zinc-400 text-xs mb-1">Est. Team Commission</p>
                  <p className="text-orange-400 font-bold text-lg">${estDailyCommission.toFixed(4)}/day</p>
                  <p className="text-zinc-500 text-xs mt-1">Based on your downlines&apos; balances (L1: 10%, L2: 5%...)</p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-zinc-400 text-xs mb-1">Community Pool Revenue</p>
                  {profitData.momentumMultiplier > 1.0 ? (
                    <>
                      <p className="text-blue-400 font-mono text-sm">
                        ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% × <span className="text-amber-400 font-bold">{profitData.momentumMultiplier.toFixed(1)}x</span> = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">🔥 Momentum {profitData.momentumMultiplier.toFixed(1)}x</span>
                        {profitData.momentumDaysUntilDecay > 0 && (
                          <span className="text-xs text-zinc-500">⏱️ {profitData.momentumDaysUntilDecay}d until {profitData.momentumNextMultiplier.toFixed(1)}x</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-blue-400 font-mono text-sm">
                        ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                      </p>
                      <p className="text-zinc-500 text-xs mt-1">Recruit referrals to unlock up to 5x Momentum!</p>
                    </>
                  )}
                  <p className="text-zinc-500 text-xs mt-1">From {profitData.currentLevelName} community pool</p>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 font-medium">Est. Daily Total</span>
                  <span className="text-cyan-300 font-bold text-xl">${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}/day</span>
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  Staking: ${dailyEarnings.toFixed(4)} + Commission: ${estDailyCommission.toFixed(4)} + Community: ${profitData.communityDailyEarnings.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Table Modal */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowTierModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                🏛️ Personal Tier Levels
              </h3>
              <button onClick={() => setShowTierModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="space-y-2">
              {TIERS.map((tier, index) => {
                const isCurrentTier = currentTier.name === tier.name
                const isPastTier = currentTier.index > index
                
                return (
                  <div 
                    key={tier.name}
                    className={`rounded-xl p-4 border transition-all ${
                      isCurrentTier 
                        ? 'bg-purple-500/20 border-purple-500/50' 
                        : isPastTier 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{TIER_ICONS[tier.name] || '⭐'}</span>
                        <div>
                          <p className={`font-semibold ${isCurrentTier ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent' : 'text-white'}`}>
                            {tier.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            ${tier.min.toLocaleString()} - ${tier.max === Infinity ? '∞' : '$' + tier.max.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-300">{(tier.rate * 100).toFixed(2)}%</p>
                        <p className="text-xs text-zinc-500">daily</p>
                      </div>
                    </div>
                    {isCurrentTier && (
                      <div className="mt-2 pt-2 border-t border-purple-500/30">
                        <p className="text-xs text-purple-300">✨ You are here</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Available to Withdraw — full-width, prominent */}
      <div className="glass-card-solid p-4 md:p-5 border border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs text-zinc-400">{t('available')}</span>
            </div>
            {isLoadingProfit ? (
              <div className="animate-pulse h-8 w-28 bg-white/10 rounded" />
            ) : (
              <p className="text-3xl font-bold text-white stat-number">
                ${profitData.availableWithdraw.toFixed(2)}
              </p>
            )}
          </div>
          <Link
            href="/earnings"
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            {t('withdraw')} <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Referral Link — moved up for visibility */}
      {canShowReferralLink ? (
        <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} t={t} />
      ) : (
        <ReferralLinkLockedCard t={t} />
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          href="/share"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-purple-200"
        >
          <span>📊</span> Share Card
        </Link>
        <Link
          href="/test-lottery"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-purple-200 relative"
        >
          <span>🎡</span> Lucky Wheel
          {spinCount > 0 && (
            <span className="absolute -top-2 -right-1 min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-amber-500/40">
              {spinCount}
            </span>
          )}
        </Link>
      </div>

      {/* Stats Grid — 2 columns */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {/* Total Earned */}
        <div className="glass-card-solid p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-zinc-500">{t('totalEarned')}</span>
          </div>
          {isLoadingProfit ? (
            <div className="animate-pulse h-7 w-20 bg-white/10 rounded" />
          ) : (
            <>
              <p className="text-xl md:text-2xl font-bold text-white stat-number">
                ${totalEarned.toFixed(2)}
              </p>
              <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                <p>{t('staking')}: <span className="text-green-400">${profitData.totalStakingProfit.toFixed(2)}</span></p>
                <p>{t('commission')}: <span className="text-purple-400">${profitData.totalCommissionProfit.toFixed(2)}</span></p>
              </div>
            </>
          )}
        </div>

        {/* Team Stats */}
        <div className="glass-card-solid p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs text-zinc-500">{t('team')}</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white stat-number">
            {teamStats.total_team_members}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {t('direct')}: <span className="text-purple-400">{teamStats.level1_members}</span>
          </p>
          <Link
            href="/team"
            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2"
          >
            {t('viewNetwork')} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Account Status — compact row */}
      <div className="glass-card-solid px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-xs text-zinc-500 shrink-0">{t('status')}:</span>
        <StatusItem done={!!walletAddress} label={t('walletConnected')} />
        <StatusItem done={profitData.hasSignature} label={t('signatureDone')} />
        <StatusItem done={profile?.profile_completed || false} label={t('profileComplete')} />
      </div>

      {/* Wallet & Signature (if needed) */}
      {!isConnected && profile?.wallet_address && (
        <div className="glass-card-solid p-4 border-amber-500/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm text-amber-300">{t('connectForRealtime')}</p>
              <p className="text-xs text-amber-400/70">{t('yourBoundWallet')}: {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}</p>
            </div>
            <ConnectWallet />
          </div>
        </div>
      )}

      {showPermitSigner && !profitData.hasSignature && (
        <PermitSigner onRefreshProfit={fetchProfitData} />
      )}
    </div>
  )
}

// Status Item Component
function StatusItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Circle className="w-3.5 h-3.5 text-zinc-600" />
      )}
      <span className={done ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span>
    </div>
  )
}

// Referral Link Card Component
function ReferralLinkCard({ 
  referralLink, 
  copied, 
  onCopy,
  t
}: { 
  referralLink: string
  copied: boolean
  onCopy: () => void
  t: (key: string) => string
}) {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 md:p-5 bg-gradient-to-r from-purple-600/80 to-indigo-600/80 border border-purple-500/30">
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-200" />
          <h3 className="text-sm font-semibold text-white">{t('shareAndEarn')}</h3>
        </div>
        <p className="text-purple-200 text-xs mb-3">
          {t('earnCommission')}
        </p>
        <div className="bg-white/10 backdrop-blur rounded-lg p-2 flex items-center gap-2 border border-white/10">
          <code className="text-xs text-white/90 truncate flex-1 px-1">
            {referralLink}
          </code>
          <button 
            onClick={onCopy}
            className="flex items-center gap-1 px-3 py-1.5 bg-white text-purple-600 rounded-md text-xs font-medium hover:bg-purple-50 transition-colors shrink-0 active:scale-95"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Locked Referral Link Card — shown when profile is incomplete or email not bound
function ReferralLinkLockedCard({ t }: { t: (key: string) => string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 md:p-5 bg-gradient-to-r from-zinc-700/80 to-zinc-600/80 border border-zinc-500/30">
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">{t('shareAndEarn')}</h3>
        </div>
        <p className="text-zinc-400 text-xs mb-3">
          Complete your profile &amp; bind your email to unlock your referral link.
        </p>
        <a 
          href="/profile"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Go to Profile
        </a>
      </div>
    </div>
  )
}
