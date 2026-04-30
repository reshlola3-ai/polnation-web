'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Copy, Check, Wallet, TrendingUp, Users,
  ArrowUpRight, CheckCircle, Circle, AlertCircle,
  ChevronRight, HelpCircle, X, Flame, Globe,
  Share2, Dices, GraduationCap
} from 'lucide-react'
import Image from 'next/image'
import { ConnectWallet } from '@/components/wallet/ConnectWallet'
import { PermitSigner } from '@/components/wallet/PermitSigner'
import { NotchedCard } from '@/components/ui/poly/NotchedCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat } from '@/components/ui/poly/MonoStat'
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
  currentLevelNumber: number
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
    currentLevelNumber: 1,
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
          currentLevelNumber: data.currentLevelInfo?.level || 1,
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
      <div className="kraken-shell space-y-3">
        <section className="kraken-panel p-7 sm:p-10">
          <div className="text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.08] ring-1 ring-inset ring-white/[0.12] flex items-center justify-center">
              <Wallet className="w-7 h-7 text-white/80" />
            </div>
            <h2 className="text-2xl md:text-[28px] font-semibold text-white tracking-tight mb-2">
              {t('connectToStart')}
            </h2>
            <p className="text-white/55 text-[13px] mb-6 leading-relaxed">
              {t('connectToStartDesc', { rate: '1.80%', apy: '657%' })}
            </p>
            <ConnectWallet />
            <p className="text-white/40 text-[12px] mt-4">
              {t('supportedWallets')}
            </p>
          </div>
        </section>

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
  const step3Done = !!profile?.profile_completed
  const allDone = step1Done && step2Done && step3Done
  
  return (
    <div className="kraken-shell space-y-3">
      {/* Onboarding Banner — hides once all steps complete */}
      {!allDone && (
        <section className="kraken-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--kraken-muted)] mb-3">Getting Started</p>
          <div className="flex items-start gap-2">
            {/* Step 1 */}
            <div className={`flex-1 kraken-mini-card p-3 transition-colors ${step1Done ? 'border-[#00e28a]/20' : 'border-purple-500/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                {step1Done
                  ? <CheckCircle className="w-4 h-4 text-[#00e28a] shrink-0" />
                  : <Circle className="w-4 h-4 text-purple-300 shrink-0" />}
                <span className={`text-xs font-semibold ${step1Done ? 'text-[#00e28a]/80' : 'text-purple-200'}`}>Connect Wallet</span>
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">Link your wallet to your account</p>
            </div>

            <ChevronRight className="w-4 h-4 text-white/25 shrink-0 mt-3" />

            {/* Step 2 */}
            <div className={`flex-1 kraken-mini-card p-3 transition-colors ${step2Done ? 'border-[#00e28a]/20' : step1Done ? 'border-white/[0.10]' : 'border-white/[0.06]'}`}>
              <div className="flex items-center gap-2 mb-1">
                {step2Done
                  ? <CheckCircle className="w-4 h-4 text-[#00e28a] shrink-0" />
                  : <Circle className={`w-4 h-4 shrink-0 ${step1Done ? 'text-white/65' : 'text-white/30'}`} />}
                <span className={`text-xs font-semibold ${step2Done ? 'text-[#00e28a]/80' : step1Done ? 'text-white/55' : 'text-white/40'}`}>Activate Earning</span>
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">Sign Merkle Tree · one-time · no gas fee</p>
              {step1Done && !step2Done && (
                <p className="text-[11px] text-white/65 mt-1 font-medium">↓ Sign below to start earning</p>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-white/25 shrink-0 mt-3" />

            {/* Step 3 */}
            <Link href="/profile" className={`flex-1 kraken-mini-card p-3 transition-colors ${step3Done ? 'border-[#00e28a]/20' : step2Done ? 'border-white/[0.10]' : 'border-white/[0.06]'}`}>
              <div className="flex items-center gap-2 mb-1">
                {step3Done
                  ? <CheckCircle className="w-4 h-4 text-[#00e28a] shrink-0" />
                  : <Circle className={`w-4 h-4 shrink-0 ${step2Done ? 'text-white/65' : 'text-white/30'}`} />}
                <span className={`text-xs font-semibold ${step3Done ? 'text-[#00e28a]/80' : step2Done ? 'text-white/55' : 'text-white/40'}`}>Complete Profile</span>
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">Add username · phone · country</p>
              {step2Done && !step3Done && (
                <p className="text-[11px] text-white/65 mt-1 font-medium">↓ Tap to complete →</p>
              )}
            </Link>
          </div>
        </section>
      )}

      {/* Hero */}
      <section className="kraken-summary p-5 sm:p-6">
        {/* Polygon coin + blocks illustration (from staking.polygon.technology) */}
        {/* Hero illustration hidden for now — overlaps cards on narrow desktop */}
        {/* <Image
          src="/images/dashboard-hero.png"
          alt=""
          width={431}
          height={285}
          priority
          className="hidden lg:block absolute bottom-0 right-0 w-[360px] xl:w-[440px] h-auto pointer-events-none select-none"
        /> */}
        {/* Balance — large, dominant */}
        <div className="relative text-left mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--kraken-muted)] mb-2">{t('totalAssets')}</p>
          {isBalanceLoading ? (
            <div className="animate-pulse h-14 w-44 bg-white/5 rounded-lg mx-auto" />
          ) : (
            <p className="text-[44px] sm:text-[52px] leading-none font-semibold text-white tracking-tight tabular-nums">
              ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <div className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-[rgba(0,226,138,0.1)] border border-[rgba(0,226,138,0.2)]">
              <span className="text-[var(--kraken-green)] text-[12px] font-semibold tabular-nums">
                +${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}{t('perDay')}
              </span>
            </div>
            <button
              onClick={() => setShowEarningsModal(true)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-white/30" />
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div className="relative flex items-center gap-2 flex-wrap mb-5">
          <button
            className="kraken-pill inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-semibold text-white hover:bg-white/[0.08] transition-colors active:scale-95"
            onClick={() => setShowTierModal(true)}
          >
            <span>{TIER_ICONS[currentTier.name] || '⭐'}</span>
            {currentTier.name} · {(currentTier.rate * 100).toFixed(2)}%
          </button>
          <button
            className="kraken-pill inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-semibold text-white/60 hover:bg-white/[0.06] transition-colors active:scale-95"
            onClick={() => setShowMomentumModal(true)}
          >
            <Flame className="w-3 h-3 text-orange-400" />
            {profitData.momentumMultiplier.toFixed(1)}x
            {profitData.momentumDaysUntilDecay > 0 && (
              <span className="text-orange-300/60">{profitData.momentumDaysUntilDecay}d</span>
            )}
          </button>
        </div>

        {/* Assets breakdown — polygon-style notched cards (Phase 2 PoC) */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3" onClick={() => setActiveAssetTip(null)}>
          {/* Wallet */}
          <NotchedCard pad={16} className="min-w-0">
            <div className="flex flex-col items-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] ring-1 ring-inset ring-white/[0.06] flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white/80" />
              </div>
              {isBalanceLoading ? (
                <div className="animate-pulse h-5 w-14 bg-white/5 rounded" />
              ) : (
                <MonoStat prefix="$" value={usdcBalance.toFixed(2)} />
              )}
              <div className="flex items-center gap-0.5">
                <EyebrowTag>{t('assetWalletTitle')}</EyebrowTag>
                <button type="button" className="asset-help-btn" aria-label={t('assetHelpWalletAria')}
                  onClick={(e) => openTip('wallet', e)}>
                  <HelpCircle className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </NotchedCard>

          {/* Withdrawable */}
          <NotchedCard pad={16} className="min-w-0">
            <div className="flex flex-col items-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-white/65" />
              </div>
              {isLoadingProfit ? (
                <div className="animate-pulse h-5 w-14 bg-white/5 rounded" />
              ) : (
                <Link href="/earnings" onClick={(e) => e.stopPropagation()}
                  className={`hover:text-white/80 transition-colors${profitData.availableWithdraw > 0.15 ? ' text-white/65' : ''}`}>
                  <MonoStat prefix="$" value={profitData.availableWithdraw.toFixed(2)} />
                </Link>
              )}
              <div className="flex items-center gap-0.5">
                <EyebrowTag>{t('assetAvailableTitle')}</EyebrowTag>
                <button type="button" className="asset-help-btn" aria-label={t('assetHelpAvailableAria')}
                  onClick={(e) => openTip('available', e)}>
                  <HelpCircle className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </NotchedCard>

          {/* Team Pool */}
          <NotchedCard pad={16} className="min-w-0">
            <div className="flex flex-col items-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 ring-1 ring-inset ring-purple-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-300" />
              </div>
              {isLoadingProfit ? (
                <div className="animate-pulse h-5 w-14 bg-white/5 rounded" />
              ) : (
                <MonoStat prefix="$" value={profitData.communityPrizePool.toFixed(0)} />
              )}
              <div className="flex items-center gap-0.5">
                <EyebrowTag>{t('assetTeamPoolTitle')}</EyebrowTag>
                <button type="button" className="asset-help-btn" aria-label={t('assetHelpTeamAria')}
                  onClick={(e) => openTip('team', e)}>
                  <HelpCircle className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </NotchedCard>
        </div>

        {/* Fixed-position tooltip */}
        {activeAssetTip && (
          <div
            className="fixed z-[999] rounded-2xl border border-[var(--kraken-border)] bg-[var(--kraken-panel)] shadow-2xl p-3 text-[11px] leading-relaxed"
            style={{
              left: Math.min(activeAssetTip.x, window.innerWidth - 228),
              top: activeAssetTip.y,
              width: 220,
              boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeAssetTip.key === 'wallet' && (<>
              <p className="text-white/90">{t('assetHelpWalletLine1')}</p>
              <p className="text-white/50 mt-1">{t('assetHelpWalletLine2')}</p>
            </>)}
            {activeAssetTip.key === 'available' && (<>
              <p className="text-white/90">{t('assetHelpAvailableLine1')}</p>
              <p className="text-white/50 mt-1">{t('assetHelpAvailableLine2')}</p>
            </>)}
            {activeAssetTip.key === 'team' && (<>
              <p className="text-white/90">{t('assetHelpTeamLine1')}</p>
              <p className="text-white/50 mt-1">{t('assetHelpTeamLine2')}</p>
            </>)}
          </div>
        )}
      </section>

      {/* Quick Actions — 4 icon buttons; intentionally distinct from BottomNav
          (Dashboard/Tasks/Withdraw/Team/Profile) so mobile users don't see
          duplicate "Team" / "Tasks" entries. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/share',        icon: Share2,         label: 'Invite',   badge: undefined },
          { href: '/test-lottery', icon: Dices,          label: 'Lottery',  badge: spinCount },
          { href: '/earnings',     icon: ArrowUpRight,   label: 'Withdraw', badge: undefined },
          { href: '/academy',      icon: GraduationCap,  label: 'Academy',  badge: undefined },
        ].map(({ href, icon: Icon, label, badge }, idx) => (
          <Link
            key={href}
            href={href}
            className="kraken-action-card quick-action-card flex items-center gap-3 px-3 py-3 active:scale-[0.98] transition-all duration-200 ease-out"
          >
            <div
              className="quick-action-icon-wrap kraken-icon shrink-0"
              style={{
                animationDelay: `${idx * 0.18}s`,
              }}
            >
              <Icon className="quick-action-icon w-4 h-4 text-white" style={{ animationDelay: `${idx * 0.14}s` }} />
            </div>
            <span className="text-[13px] text-white/85 font-semibold tracking-tight">{label}</span>
            {badge != null && badge > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-[var(--poly-purple)] text-white text-[10px] font-bold rounded-full flex items-center justify-center ">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Community + Progress */}
      <section className="kraken-panel p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Image
              src={`/levels/level-${Math.min(Math.max(profitData.currentLevelNumber, 1), 6)}.webp`}
              alt={profitData.currentLevelName}
              width={36}
              height={36}
              className="object-contain"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Community</p>
              <p className="text-sm font-semibold text-white tracking-tight">{profitData.currentLevelName}</p>
            </div>
          </div>
          <div className="text-right tabular-nums">
            <p className="text-sm font-semibold text-[#00e28a]/80">+${profitData.communityDailyEarnings.toFixed(3)}</p>
            <p className="text-[10px] text-white/40">per day · Pool ${profitData.communityPrizePool.toFixed(0)}</p>
          </div>
        </div>

        {profitData.teamNextUnlockVolume > 0 && (
          <div>
            {/* Label + percentage pill */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Unlock Progress</span>
              <div className="flex items-center gap-1.5">
                {profitData.teamNextLevelName && (
                  <span className="text-[12px] text-white/50">→ {profitData.teamNextLevelName}</span>
                )}
                <span className="text-[11px] font-semibold text-[#00e28a]/70 bg-[#00e28a]/[0.10] ring-1 ring-inset ring-[#00e28a]/[0.15] rounded-full px-2 py-0.5 tabular-nums">
                  {Math.min((profitData.teamEffectiveVolume / profitData.teamNextUnlockVolume) * 100, 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Thick progress bar */}
            <div className="h-[6px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((profitData.teamEffectiveVolume / profitData.teamNextUnlockVolume) * 100, 100)}%`,
                  background: '#00e28a',
                  boxShadow: '0 0 6px rgba(0,226,138,0.3)',
                }}
              />
            </div>

            {/* Breakdown */}
            <div className="flex items-center justify-between mt-3 tabular-nums">
              <div className="flex items-center gap-3">
                {profitData.teamVolumeOnly > 0 && (
                  <span className="flex items-center gap-1 text-[12px] text-white/50">
                    <Globe className="w-3 h-3 text-white/45" />
                    <span className="text-white/70">${profitData.teamVolumeOnly.toFixed(2)}</span>
                  </span>
                )}
                {profitData.taskBonus > 0 && (
                  <span className="flex items-center gap-1 text-[12px] text-white/50">
                    <CheckCircle className="w-3 h-3 text-[#00e28a]" />
                    <span className="text-white/70">${profitData.taskBonus.toFixed(2)}</span>
                  </span>
                )}
              </div>
              <span className="text-[12px] text-white/50">
                ${profitData.teamEffectiveVolume.toFixed(2)} / ${profitData.teamNextUnlockVolume.toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Earnings Calculation Modal */}
      {showEarningsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEarningsModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📊 Earnings Calculation
              </h3>
              <button onClick={() => setShowEarningsModal(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
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
                        ${profitData.communityPrizePool.toFixed(0)} × {profitData.communityDailyRate.toFixed(1)}% × <span className="text-white/75 font-bold">{profitData.momentumMultiplier.toFixed(1)}x</span> = <span className="font-bold">${profitData.communityDailyEarnings.toFixed(2)}</span>/day
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-white/65 font-medium">🔥 Momentum {profitData.momentumMultiplier.toFixed(1)}x</span>
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
                  <span className="text-white font-bold text-xl">${(dailyEarnings + estDailyCommission + profitData.communityDailyEarnings).toFixed(4)}/day</span>
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
              <button onClick={() => setShowTierModal(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg">
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
                          : 'bg-zinc-800/50 border-zinc-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{TIER_ICONS[tier.name] || '⭐'}</span>
                        <div>
                          <p className={`font-semibold ${isCurrentTier ? 'text-white' : 'text-white'}`}>
                            {tier.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            ${tier.min.toLocaleString()} - ${tier.max === Infinity ? '∞' : '$' + tier.max.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white/65">{(tier.rate * 100).toFixed(2)}%</p>
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

      {/* Momentum Modal */}
      {showMomentumModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowMomentumModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                🔥 {tTeam('momentumTitle')}
              </h3>
              <button onClick={() => setShowMomentumModal(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Current multiplier */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60 font-medium">Current Multiplier</span>
                <span className="text-3xl font-bold text-white/85">{profitData.momentumMultiplier.toFixed(1)}x</span>
              </div>
              {profitData.momentumMultiplier > 0.2 ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">
                    {tTeam('momentumActive', { multiplier: profitData.momentumMultiplier.toFixed(1) })}
                  </p>
                  {profitData.momentumDaysUntilDecay > 0 && (
                    <p className="text-xs text-zinc-500">
                      ⏱️ {tTeam('momentumDecayCountdown', { days: profitData.momentumDaysUntilDecay, next: profitData.momentumNextMultiplier.toFixed(1) })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">{tTeam('momentumInactive')}</p>
              )}
            </div>

            {/* Decay steps */}
            <div className="bg-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
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
                  <span key={label} className={`text-xs px-2 py-1 rounded-lg font-medium ${active ? 'bg-white/[0.08] text-white/70 border border-white/[0.12]' : 'bg-white/[0.04] text-white/30'}`}>
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-zinc-600">{tTeam('momentumDecayRate')}</p>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="kraken-panel p-4">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('totalEarned')}</span>
          </div>
          {isLoadingProfit ? (
            <div className="animate-pulse h-6 w-20 bg-white/5 rounded" />
          ) : (
            <p className="text-2xl font-semibold text-white tracking-tight tabular-nums">${totalEarned.toFixed(2)}</p>
          )}
          <div className="text-[12px] text-white/50 mt-2 space-y-0.5 tabular-nums">
            <p>{t('staking')}: <span className="text-[#00e28a]/80">${profitData.totalStakingProfit.toFixed(2)}</span></p>
            <p>{t('commission')}: <span className="text-purple-300">${profitData.totalCommissionProfit.toFixed(2)}</span></p>
          </div>
        </div>
        <div className="kraken-panel p-4">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
            <Users className="w-3.5 h-3.5" />
            <span>{t('team')}</span>
          </div>
          <p className="text-2xl font-semibold text-white tracking-tight tabular-nums">{teamStats.total_team_members}</p>
          <p className="text-[12px] text-white/50 mt-2 tabular-nums">
            {t('direct')}: <span className="text-purple-300">{teamStats.level1_members}</span>
          </p>
          <Link
            href="/team"
            className="inline-flex items-center gap-1 text-[12px] text-purple-300 hover:text-purple-200 mt-1.5 font-medium"
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
          <section className="kraken-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#00e28a]/[0.10] ring-1 ring-inset ring-[#00e28a]/[0.15] flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-[#00e28a]/80" />
                </div>
                <span className="text-sm font-semibold text-white tracking-tight">Account Setup</span>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full tabular-nums ${allDone ? 'bg-[#00e28a]/[0.10] text-[#00e28a]/80 ring-1 ring-inset ring-[#00e28a]/[0.15]' : 'bg-white/[0.06] text-white/60 ring-1 ring-inset ring-white/[0.06]'}`}>
                {doneCount}/{steps.length}
              </span>
            </div>

            {/* Steps list */}
            <div className="space-y-2 mb-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {step.done ? (
                    <CheckCircle className="w-4 h-4 text-[#00e28a] shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-white/25 shrink-0" />
                  )}
                  <span className={`text-[12px] flex-1 ${step.done ? 'text-white/70 line-through decoration-white/20' : 'text-white/55'}`}>
                    {step.label}
                  </span>
                  {!step.done && step.href && (
                    <a href={step.href} className="text-[12px] text-purple-300 hover:text-purple-200 flex items-center gap-0.5 font-medium">
                      Fix <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(doneCount / steps.length) * 100}%`,
                  background: allDone ? '#00e28a' : 'var(--poly-purple)',
                }}
              />
            </div>
          </section>
        )
      })()}

      {/* Wallet reconnect hint */}
      {!isConnected && profile?.wallet_address && (
        <section className="kraken-panel p-5 border-white/[0.10]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-white/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/60 font-medium">{t('connectForRealtime')}</p>
              <p className="text-xs text-white/50 truncate tabular-nums">{t('yourBoundWallet')}: {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}</p>
            </div>
            <ConnectWallet />
          </div>
        </section>
      )}

      {showPermitSigner && !profitData.hasSignature && (
        <PermitSigner onRefreshProfit={fetchProfitData} />
      )}
    </div>
  )
}

// Referral Link Card — Apple Liquid Glass
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
    <section className="kraken-panel p-5">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-purple-500/15 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-6 -right-4 w-20 h-20 rounded-full bg-indigo-500/15 blur-xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-xl bg-white/[0.1] ring-1 ring-inset ring-white/20 flex items-center justify-center">
            <Share2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Referral</p>
            <h3 className="text-sm font-semibold text-white tracking-tight">{t('shareAndEarn')}</h3>
          </div>
        </div>
        <p className="text-white/55 text-[12px] mb-3 leading-relaxed">{t('earnCommission')}</p>

        <div className="rounded-xl bg-[var(--kraken-panel)] border border-[var(--kraken-border)] p-2.5 flex items-center gap-2">
          <code className="text-[12px] text-white/70 truncate flex-1 px-1 font-mono">{referralLink}</code>
          <button
            onClick={onCopy}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold transition-all shrink-0 active:scale-95 ring-1 ring-inset ${
              copied
                ? 'bg-[#00e28a]/[0.12] ring-[#00e28a]/[0.20] text-[#00e28a]/80'
                : 'bg-[var(--kraken-purple)] text-white ring-[var(--kraken-purple)] hover:bg-[var(--kraken-purple-soft)]'
            }`}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </section>
  )
}

// Locked Referral Link Card
function ReferralLinkLockedCard({ t }: { t: (key: string) => string }) {
  return (
    <section className="kraken-panel p-5">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-xl bg-white/[0.06] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-white/40" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">Referral</p>
            <h3 className="text-sm font-semibold text-white/70 tracking-tight">{t('shareAndEarn')}</h3>
          </div>
        </div>
        <p className="text-white/45 text-[12px] mb-3 leading-relaxed">
          Complete your profile &amp; bind your email to unlock your referral link.
        </p>
        <a
          href="/profile"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--kraken-purple)] text-[12px] font-semibold text-white hover:bg-[var(--kraken-purple-soft)] transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Go to Profile
        </a>
      </div>
    </section>
  )
}
