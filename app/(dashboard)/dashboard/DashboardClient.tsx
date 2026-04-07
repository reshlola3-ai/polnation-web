'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Copy, Check, Wallet, TrendingUp, Users, DollarSign,
  ArrowUpRight, CheckCircle, Circle, AlertCircle,
  ChevronRight, HelpCircle, X, Flame, Award, Globe
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
  const tTeam = useTranslations('team')
  const { address, isConnected } = useAccount()
  const [copied, setCopied] = useState(false)
  const [showEarningsModal, setShowEarningsModal] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [showMomentumModal, setShowMomentumModal] = useState(false)
  const [activeAssetTip, setActiveAssetTip] = useState<{ key: 'wallet' | 'available' | 'team'; x: number; y: number } | null>(null)

  const openTip = (key: 'wallet' | 'available' | 'team', e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (activeAssetTip?.key === key) { setActiveAssetTip(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setActiveAssetTip({ key, x: rect.left, y: rect.bottom + 6 })
  }

  useEffect(() => {
    if (!activeAssetTip) return
    const close = () => setActiveAssetTip(null)
    window.addEventListener('click', close)
    window.addEventListener('touchstart', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('touchstart', close)
    }
  }, [activeAssetTip])
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
  // Referral link: show as long as user has a referral_code (all wallet users have one)
  const canShowReferralLink = !!profile?.referral_code
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
      <div className="space-y-3">
        <AuroraCard className="p-6 md:p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-7 h-7 text-gray-400" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              {t('connectToStart')}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {t('connectToStartDesc', { rate: '1.80%', apy: '657%' })}
            </p>
            <ConnectWallet />
            <p className="text-gray-400 text-xs mt-4">
              {t('supportedWallets')}
            </p>
          </div>
        </AuroraCard>

        {canShowReferralLink ? (
          <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} t={t} />
        ) : (
          <ReferralLinkLockedCard t={t} />
        )}
      </div>
    )
  }

  // Onboarding steps
  const step1Done = !!walletAddress
  const step2Done = profitData.hasSignature
  const allDone = step1Done && step2Done
  
  return (
    <div className="space-y-3">
      {/* Onboarding Banner — hides once all steps complete */}
      {!allDone && (
        <div className="glass-card-solid p-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Getting Started</p>
          <div className="flex items-start gap-2">
            {/* Step 1 */}
            <div className={`flex-1 rounded-xl p-3 border transition-colors ${step1Done ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {step1Done
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <Circle className="w-4 h-4 text-gray-400 shrink-0" />}
                <span className={`text-xs font-semibold ${step1Done ? 'text-emerald-700' : 'text-gray-600'}`}>Connect Wallet</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">Link your wallet to your account</p>
            </div>

            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-3" />

            {/* Step 2 */}
            <div className={`flex-1 rounded-xl p-3 border transition-colors ${step2Done ? 'border-emerald-200 bg-emerald-50' : step1Done ? 'border-[#16A34A]/30 bg-[#F0FDF4]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {step2Done
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <Circle className={`w-4 h-4 shrink-0 ${step1Done ? 'text-[#16A34A]' : 'text-gray-400'}`} />}
                <span className={`text-xs font-semibold ${step2Done ? 'text-emerald-700' : step1Done ? 'text-[#16A34A]' : 'text-gray-500'}`}>Authorize USDC</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">One-time off-chain signature · no gas fee</p>
              {step1Done && !step2Done && (
                <p className="text-[11px] text-[#16A34A] mt-1 font-medium">↓ Sign below to start earning</p>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-3" />

            {/* Step 3 */}
            <div className="flex-1 rounded-xl p-3 border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <Circle className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-xs font-semibold text-gray-500">Start Earning</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">Receive daily USDC distributions</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero — balance centered, premium grain gradient */}
      <AuroraCard className="p-5 md:p-7">
        {/* Balance — large, dominant */}
        <div className="text-center mb-5">
          <p className="text-gray-400 text-xs tracking-widest uppercase mb-2">{t('totalAssets')}</p>
          {isBalanceLoading ? (
            <div className="animate-pulse h-14 w-44 bg-gray-200 rounded-lg mx-auto" />
          ) : (
            <p className="text-5xl md:text-6xl font-bold text-gray-900 stat-number tracking-tight">
              ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400 text-xs font-medium stat-number">
                +${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}{t('perDay')}
              </span>
            </div>
            <button
              onClick={() => setShowEarningsModal(true)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
          <button
            className="text-xs px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors active:scale-95"
            onClick={() => setShowTierModal(true)}
          >
            {TIER_ICONS[currentTier.name] || '⭐'} {currentTier.name} · {(currentTier.rate * 100).toFixed(2)}%
          </button>
          <button
            className="momentum-fire-pill text-xs px-2.5 py-1 rounded-full font-medium active:scale-95"
            onClick={() => setShowMomentumModal(true)}
          >
            <span className="fire-icon"><Flame className="w-3 h-3 inline -mt-0.5 text-orange-400" /></span>
            {' '}{profitData.momentumMultiplier.toFixed(1)}x
            {profitData.momentumDaysUntilDecay > 0 && (
              <span className="text-orange-300/50 ml-1">{profitData.momentumDaysUntilDecay}d</span>
            )}
          </button>
        </div>

        {/* Assets breakdown (3 parts) */}
        <div
          className="rounded-xl p-2.5"
          style={{
            background: '#F9FAFB',
            border: '1px solid #E4E4E7',
          }}
          onClick={() => setActiveAssetTip(null)}
        >
          <div className="grid grid-cols-3 gap-2">
            {/* Wallet card */}
            <div className="asset-split-card asset-split-wallet rounded-lg bg-white border border-gray-200 px-2.5 py-2.5 min-w-0 h-[84px] flex flex-col">
              <div className="flex items-center gap-1 mb-0.5 min-w-0">
                <p className="text-xs text-gray-500 truncate">{t('assetWalletTitle')}</p>
                <button type="button" className="asset-help-btn" aria-label={t('assetHelpWalletAria')}
                  onClick={(e) => openTip('wallet', e)}>
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              {isBalanceLoading ? (
                <div className="animate-pulse h-5 w-14 bg-gray-200 rounded mt-auto" />
              ) : (
                <p className="text-sm font-semibold text-gray-900 stat-number truncate mt-auto">${usdcBalance.toFixed(2)}</p>
              )}
            </div>

            {/* Available card */}
            <div className="asset-split-card asset-split-available rounded-lg bg-white border border-gray-200 px-2.5 py-2.5 min-w-0 h-[84px] flex flex-col">
              <div className="flex items-center gap-1 mb-0.5 min-w-0">
                <p className="text-xs text-gray-500 truncate">{t('assetAvailableTitle')}</p>
                <button type="button" className="asset-help-btn" aria-label={t('assetHelpAvailableAria')}
                  onClick={(e) => openTip('available', e)}>
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between gap-1.5">
                {isLoadingProfit ? (
                  <div className="animate-pulse h-5 w-14 bg-gray-200 rounded" />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 stat-number truncate">${profitData.availableWithdraw.toFixed(2)}</p>
                )}
                <Link href="/earnings"
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 asset-withdraw-btn shrink-0${profitData.availableWithdraw > 0.15 ? ' withdraw-pulse' : ''}`}
                  onClick={(e) => e.stopPropagation()}>
                  <span className="hidden sm:inline">{t('withdraw')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Team Pool card */}
            <div className="asset-split-card asset-split-team rounded-lg bg-white border border-gray-200 px-2.5 py-2.5 min-w-0 h-[84px] flex flex-col">
              <div className="flex items-center gap-1 mb-0.5 min-w-0">
                <p className="text-xs text-gray-500 truncate">{t('assetTeamPoolTitle')}</p>
                <button type="button" className="asset-help-btn" aria-label={t('assetHelpTeamAria')}
                  onClick={(e) => openTip('team', e)}>
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              {isLoadingProfit ? (
                <div className="animate-pulse h-5 w-14 bg-gray-200 rounded mt-auto" />
              ) : (
                <p className="text-sm font-semibold text-gray-900 stat-number truncate mt-auto">${profitData.communityPrizePool.toFixed(0)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Fixed-position tooltip — escapes overflow:hidden on AuroraCard */}
        {activeAssetTip && (
          <div
            className="fixed z-[999] rounded-xl border border-gray-200 shadow-lg p-3 text-[11px] leading-relaxed"
            style={{
              left: Math.min(activeAssetTip.x, window.innerWidth - 228),
              top: activeAssetTip.y,
              width: 220,
              background: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeAssetTip.key === 'wallet' && (<>
              <p className="text-gray-900">{t('assetHelpWalletLine1')}</p>
              <p className="text-gray-500 mt-1">{t('assetHelpWalletLine2')}</p>
            </>)}
            {activeAssetTip.key === 'available' && (<>
              <p className="text-gray-900">{t('assetHelpAvailableLine1')}</p>
              <p className="text-gray-500 mt-1">{t('assetHelpAvailableLine2')}</p>
            </>)}
            {activeAssetTip.key === 'team' && (<>
              <p className="text-gray-900">{t('assetHelpTeamLine1')}</p>
              <p className="text-gray-500 mt-1">{t('assetHelpTeamLine2')}</p>
            </>)}
          </div>
        )}
      </AuroraCard>

      {/* Quick Actions — 4 icon buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { href: '/share', icon: Copy, label: 'Share', iconColor: 'text-green-600', bgColor: 'bg-green-50' },
          { href: '/test-lottery', icon: Award, label: 'Wheel', iconColor: 'text-amber-600', bgColor: 'bg-amber-50', badge: spinCount },
          { href: '/team', icon: Users, label: 'Team', iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
          { href: '/tasks', icon: CheckCircle, label: 'Tasks', iconColor: 'text-green-600', bgColor: 'bg-green-50' },
        ].map(({ href, icon: Icon, label, iconColor, bgColor, badge }, idx) => (
          <Link
            key={href}
            href={href}
            className="quick-action-card glass-card-solid flex flex-col items-center gap-1.5 py-3.5 relative active:scale-95 transition-transform"
          >
            <div
              className={`quick-action-icon-wrap w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}
              style={{ animationDelay: `${idx * 0.18}s` }}
            >
              <Icon className={`quick-action-icon w-5 h-5 ${iconColor}`} style={{ animationDelay: `${idx * 0.14}s` }} />
            </div>
            <span className="text-xs text-gray-500">{label}</span>
            {badge != null && badge > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow shadow-amber-500/40">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Community + Progress — Plan A: left accent border + thick bar */}
      <div
        className="glass-card-solid p-4"
        style={{ borderLeft: '3px solid rgba(22,163,74,0.7)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Award className="w-4 h-4 text-[#16A34A]" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">{profitData.currentLevelName}</span>
              <span className="text-xs text-gray-400 ml-2">Community</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-emerald-400">+${profitData.communityDailyEarnings.toFixed(3)}</p>
            <p className="text-[10px] text-gray-400">per day · Pool ${profitData.communityPrizePool.toFixed(0)}</p>
          </div>
        </div>

        {profitData.teamNextUnlockVolume > 0 && (
          <div>
            {/* Label + percentage pill */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Unlock Progress</span>
              <div className="flex items-center gap-1.5">
                {profitData.teamNextLevelName && (
                  <span className="text-xs text-gray-400">→ {profitData.teamNextLevelName}</span>
                )}
                <span className="text-xs font-bold text-[#16A34A] bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  {Math.min((profitData.teamEffectiveVolume / profitData.teamNextUnlockVolume) * 100, 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Thick progress bar */}
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((profitData.teamEffectiveVolume / profitData.teamNextUnlockVolume) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #16A34A 0%, #22C55E 100%)',
                  boxShadow: 'none',
                }}
              />
            </div>

            {/* Breakdown */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                {profitData.teamVolumeOnly > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Globe className="w-3 h-3 text-[#16A34A]" />
                    <span className="text-gray-500">${profitData.teamVolumeOnly.toFixed(2)}</span>
                  </span>
                )}
                {profitData.taskBonus > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-[#16A34A]" />
                    <span className="text-gray-500">${profitData.taskBonus.toFixed(2)}</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                ${profitData.teamEffectiveVolume.toFixed(2)} / ${profitData.teamNextUnlockVolume.toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Earnings Calculation Modal */}
      {showEarningsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEarningsModal(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                📊 Earnings Calculation
              </h3>
              <button onClick={() => setShowEarningsModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Wallet Balance</span>
                  <span className="text-gray-900 font-medium">${usdcBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Current Tier</span>
                  <span className="text-gray-900 font-medium">{TIER_ICONS[currentTier.name]} {currentTier.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Daily Rate</span>
                  <span className="text-gray-900 font-medium">{(currentTier.rate * 100).toFixed(2)}%</span>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Staking Earnings</p>
                  <p className="text-green-700 font-mono text-sm">
                    ${usdcBalance.toFixed(2)} × {(currentTier.rate * 100).toFixed(2)}% = <span className="font-bold">${dailyEarnings.toFixed(4)}</span>/day
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Est. Team Commission</p>
                  <p className="text-amber-700 font-bold text-lg">${estDailyCommission.toFixed(4)}/day</p>
                  <p className="text-gray-400 text-xs mt-1">Based on your downlines&apos; balances (L1: 10%, L2: 5%...)</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Community Pool Revenue</p>
                  {profitData.momentumMultiplier > 1.0 ? (
                    <>
                      <p className="text-blue-700 font-mono text-sm">
                        ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% × <span className="text-amber-600 font-bold">{profitData.momentumMultiplier.toFixed(1)}x</span> = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">🔥 Momentum {profitData.momentumMultiplier.toFixed(1)}x</span>
                        {profitData.momentumDaysUntilDecay > 0 && (
                          <span className="text-xs text-gray-400">⏱️ {profitData.momentumDaysUntilDecay}d until {profitData.momentumNextMultiplier.toFixed(1)}x</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-blue-700 font-mono text-sm">
                        ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                      </p>
                      <p className="text-gray-400 text-xs mt-1">Recruit referrals to unlock up to 5x Momentum!</p>
                    </>
                  )}
                  <p className="text-gray-400 text-xs mt-1">From {profitData.currentLevelName} community pool</p>
                </div>
              </div>

              <div className="bg-[#F0FDF4] border border-[#16A34A]/20 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-[#15803D] font-medium">Est. Daily Total</span>
                  <span className="text-[#16A34A] font-bold text-xl">${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}/day</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                🏛️ Personal Tier Levels
              </h3>
              <button onClick={() => setShowTierModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
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
                        ? 'bg-[#F0FDF4] border-[#16A34A]/40'
                        : isPastTier
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{TIER_ICONS[tier.name] || '⭐'}</span>
                        <div>
                          <p className={`font-semibold ${isCurrentTier ? 'text-[#16A34A]' : 'text-gray-900'}`}>
                            {tier.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            ${tier.min.toLocaleString()} - ${tier.max === Infinity ? '∞' : '$' + tier.max.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#16A34A]">{(tier.rate * 100).toFixed(2)}%</p>
                        <p className="text-xs text-gray-400">daily</p>
                      </div>
                    </div>
                    {isCurrentTier && (
                      <div className="mt-2 pt-2 border-t border-[#16A34A]/20">
                        <p className="text-xs text-[#16A34A]">✨ You are here</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Momentum Modal */}
      {showMomentumModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowMomentumModal(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                🔥 {tTeam('momentumTitle')}
              </h3>
              <button onClick={() => setShowMomentumModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Current multiplier */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-700 font-medium">Current Multiplier</span>
                <span className="text-3xl font-bold text-amber-600">{profitData.momentumMultiplier.toFixed(1)}x</span>
              </div>
              {profitData.momentumMultiplier > 0.2 ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">
                    {tTeam('momentumActive', { multiplier: profitData.momentumMultiplier.toFixed(1) })}
                  </p>
                  {profitData.momentumDaysUntilDecay > 0 && (
                    <p className="text-xs text-gray-400">
                      ⏱️ {tTeam('momentumDecayCountdown', { days: profitData.momentumDaysUntilDecay, next: profitData.momentumNextMultiplier.toFixed(1) })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">{tTeam('momentumInactive')}</p>
              )}
            </div>

            {/* Decay steps */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                {tTeam('momentumDecayExplain')}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { label: '0–2d: 1.0×', active: profitData.momentumMultiplier >= 1.0 },
                  { label: '3–5d: 0.8×', active: profitData.momentumMultiplier >= 0.8 && profitData.momentumMultiplier < 1.0 },
                  { label: '6–8d: 0.6×', active: profitData.momentumMultiplier >= 0.6 && profitData.momentumMultiplier < 0.8 },
                  { label: '9–11d: 0.4×', active: profitData.momentumMultiplier >= 0.4 && profitData.momentumMultiplier < 0.6 },
                  { label: '12+d: 0.2×', active: profitData.momentumMultiplier < 0.4 },
                ].map(({ label, active }) => (
                  <span key={label} className={`text-xs px-2 py-1 rounded-lg font-medium ${active ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-gray-400 border border-gray-200'}`}>
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400">{tTeam('momentumDecayRate')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Referral Link */}
      {canShowReferralLink ? (
        <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} t={t} />
      ) : (
        <ReferralLinkLockedCard t={t} />
      )}

      {/* Stats — 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card-solid p-3.5" style={{ borderLeft: '3px solid rgba(22,163,74,0.5)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-green-50 flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-[#16A34A]" />
            </div>
            <p className="text-xs text-gray-500 font-medium">{t('totalEarned')}</p>
          </div>
          {isLoadingProfit ? (
            <div className="animate-pulse h-6 w-20 bg-gray-200 rounded" />
          ) : (
            <p className="text-xl font-bold text-gray-900 stat-number">${totalEarned.toFixed(2)}</p>
          )}
          <div className="text-xs text-gray-400 mt-1.5 space-y-0.5">
            <p>{t('staking')}: <span className="text-[#16A34A]">${profitData.totalStakingProfit.toFixed(2)}</span></p>
            <p>{t('commission')}: <span className="text-[#16A34A]">${profitData.totalCommissionProfit.toFixed(2)}</span></p>
          </div>
        </div>
        <div className="glass-card-solid p-3.5" style={{ borderLeft: '3px solid rgba(22,163,74,0.5)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-green-50 flex items-center justify-center">
              <Users className="w-3 h-3 text-[#16A34A]" />
            </div>
            <p className="text-xs text-gray-500 font-medium">{t('team')}</p>
          </div>
          <p className="text-xl font-bold text-gray-900 stat-number">{teamStats.total_team_members}</p>
          <p className="text-xs text-gray-400 mt-1.5">
            {t('direct')}: <span className="text-[#16A34A]">{teamStats.level1_members}</span>
          </p>
          <Link
            href="/team"
            className="inline-flex items-center gap-1 text-xs text-[#16A34A] hover:text-[#15803D] mt-1.5"
          >
            {t('viewNetwork')} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Account Setup — Plan C: onboarding progress card */}
      {(() => {
        const steps = [
          { done: !!walletAddress,                     label: t('walletConnected'),  href: null },
          { done: profitData.hasSignature,             label: t('signatureDone'),    href: null },
          { done: profile?.profile_completed || false, label: t('profileComplete'),  href: '/profile' },
        ]
        const doneCount = steps.filter(s => s.done).length
        const allDone = doneCount === steps.length
        return (
          <div
            className="glass-card-solid p-4"
            style={{ borderLeft: '3px solid rgba(22,163,74,0.5)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16A34A]" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Account Setup</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allDone ? 'bg-green-50 text-[#16A34A] border border-[#16A34A]/20' : 'bg-gray-100 text-gray-500'}`}>
                {doneCount}/{steps.length}
              </span>
            </div>

            {/* Steps list */}
            <div className="space-y-2 mb-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {step.done ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                  )}
                  <span className={`text-xs flex-1 ${step.done ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                  {!step.done && step.href && (
                    <a href={step.href} className="text-xs text-[#16A34A] hover:text-[#15803D] flex items-center gap-0.5">
                      Fix <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(doneCount / steps.length) * 100}%`,
                  background: 'linear-gradient(90deg, #16A34A, #22C55E)',
                }}
              />
            </div>
          </div>
        )
      })()}

      {/* Wallet reconnect hint */}
      {!isConnected && profile?.wallet_address && (
        <div className="glass-card-solid p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-700">{t('connectForRealtime')}</p>
              <p className="text-xs text-gray-400 truncate">{t('yourBoundWallet')}: {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}</p>
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
        <Circle className="w-3.5 h-3.5 text-gray-300" />
      )}
      <span className={done ? 'text-gray-600' : 'text-gray-400'}>{label}</span>
    </div>
  )
}

// Referral Link Card — Plan B: gradient invite card
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
    <div
      className="relative overflow-hidden rounded-xl p-4 border border-[#16A34A]/20"
      style={{
        background: '#F0FDF4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-green-100 pointer-events-none" />
      <div className="absolute -bottom-4 -right-2 w-14 h-14 rounded-full bg-green-50 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-[#16A34A]" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{t('shareAndEarn')}</h3>
        </div>
        <p className="text-gray-500 text-xs mb-3">{t('earnCommission')}</p>

        <div className="bg-white rounded-xl p-2.5 flex items-center gap-2 border border-gray-200">
          <code className="text-xs text-gray-600 truncate flex-1 px-1">{referralLink}</code>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95"
            style={{
              background: copied ? 'rgba(22,163,74,0.12)' : '#16A34A',
              border: `1px solid ${copied ? 'rgba(22,163,74,0.3)' : '#16A34A'}`,
              color: copied ? '#15803D' : '#FFFFFF',
            }}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Locked Referral Link Card
function ReferralLinkLockedCard({ t }: { t: (key: string) => string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-4 border border-gray-200"
      style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gray-50 pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">{t('shareAndEarn')}</h3>
        </div>
        <p className="text-gray-400 text-xs mb-3">
          Complete your profile &amp; bind your email to unlock your referral link.
        </p>
        <a
          href="/profile"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Go to Profile
        </a>
      </div>
    </div>
  )
}
