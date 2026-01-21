'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Copy, Check, Sparkles, Wallet, TrendingUp, Users, 
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

interface DashboardClientProps {
  userId: string
  profile: {
    username: string | null
    wallet_address: string | null
    profile_completed: boolean
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
  const [profitData, setProfitData] = useState<ProfitData>({
    totalStakingProfit: 0,
    totalCommissionProfit: 0,
    availableWithdraw: 0,
    hasSignature: false,
    communityPrizePool: 10, // 默认 Level 1 奖池
    currentLevelName: 'Bronze',
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

  // Fetch profit data
  const fetchProfitData = async () => {
    try {
      const res = await fetch('/api/profits/user')
      if (res.ok) {
        const data = await res.json()
        const profits = data.profits || {}
        setProfitData(prev => ({
          ...prev,
          totalStakingProfit: profits.total_earned_usdc || 0,
          totalCommissionProfit: profits.total_commission_earned || 0,
          availableWithdraw: profits.available_usdc || 0,
          hasSignature: data.hasSignature || false
        }))
      }
    } catch (err) {
      console.error('Error fetching profit data:', err)
    } finally {
      setIsLoadingProfit(false)
    }
  }

  // Fetch community status for prize pool
  const fetchCommunityStatus = async () => {
    try {
      const res = await fetch('/api/community/status')
      if (res.ok) {
        const data = await res.json()
        setProfitData(prev => ({
          ...prev,
          communityPrizePool: data.currentLevelInfo?.reward_pool || 10,
          currentLevelName: data.currentLevelInfo?.name || 'Bronze',
        }))
      }
    } catch (err) {
      console.error('Error fetching community status:', err)
    }
  }

  useEffect(() => {
    fetchProfitData()
    fetchCommunityStatus()
  }, [])

  // Calculate total assets = community prize pool + wallet usdc balance
  const totalAssets = profitData.communityPrizePool + usdcBalance
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?ref=${userId}`
    : `https://polnation.com/register?ref=${userId}`

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
        <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} t={t} />
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
                ${dailyEarnings.toFixed(4)}<span className="text-lg text-cyan-400">{t('perDay')}</span>
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

        {/* Asset Details - Two Columns */}
        <div className="grid grid-cols-2 gap-4">
          {/* Wallet Balance */}
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-200 mb-1">{t('walletBalance')}</p>
                {isBalanceLoading ? (
                  <div className="animate-pulse h-8 w-24 bg-white/10 rounded" />
                ) : (
                  <p className="text-2xl md:text-3xl font-bold text-white stat-number">
                    ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
                <p className="text-xs text-white/70 mt-1">{t('usdcOnPolygon')}</p>
              </div>
              <img src="/usdc.png" alt="USDC" className="w-10 h-10 md:w-12 md:h-12" />
            </div>
          </div>

          {/* Community Prize Pool */}
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-200 mb-1">{t('communityPrizePool')}</p>
                {isLoadingProfit ? (
                  <div className="animate-pulse h-8 w-24 bg-white/10 rounded" />
                ) : (
                  <p className="text-2xl md:text-3xl font-bold text-white stat-number">
                    ${profitData.communityPrizePool.toFixed(2)}
                  </p>
                )}
                <p className="text-xs text-white/70 mt-1">{t('level', { name: profitData.currentLevelName })}</p>
              </div>
              <img src="/crowdfunding.png" alt="Community" className="w-10 h-10 md:w-12 md:h-12" />
            </div>
          </div>
        </div>

        {/* Tier Progress */}
        <div 
          className="bg-white/10 rounded-xl p-4 backdrop-blur cursor-pointer hover:bg-white/15 transition-colors"
          onClick={() => setShowTierModal(true)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm flex items-center gap-2">
              <span className="text-lg">{TIER_ICONS[currentTier.name] || '⭐'}</span>
              <span className="font-semibold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                {currentTier.name}
              </span>
              <span className="text-purple-200">• {(currentTier.rate * 100).toFixed(2)}% daily</span>
              {yearlyAPY > 0 && <span className="text-cyan-300">({yearlyAPY.toFixed(0)}% APY)</span>}
            </span>
            {nextTier && (
              <span className="text-xs text-purple-300">
                {t('toNextTier', { amount: (nextTier.min - usdcBalance).toFixed(2), name: nextTier.name })}
              </span>
            )}
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressToNext, 100)}%` }}
            />
          </div>
          {usdcBalance < 10 && (
            <p className="text-amber-300 text-xs mt-2">
              {t('depositToStart')}
            </p>
          )}
          <p className="text-xs text-purple-300/60 mt-2 text-center">Tap to view all tiers</p>
        </div>
      </AuroraCard>

      {/* Earnings Calculation Modal */}
      {showEarningsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEarningsModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
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
              
              <div className="border-t border-zinc-700 pt-4">
                <p className="text-zinc-400 text-xs mb-2">Calculation Formula:</p>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <p className="text-purple-300 font-mono text-sm">
                    ${usdcBalance.toFixed(2)} × {(currentTier.rate * 100).toFixed(2)}% = <span className="text-cyan-300 font-bold">${dailyEarnings.toFixed(4)}</span>
                  </p>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-400">Staking Earnings</span>
                  <span className="text-green-400 font-medium">${dailyEarnings.toFixed(4)}/day</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Team Commission</span>
                  <span className="text-orange-400 font-medium">Up to 10% of team earnings</span>
                </div>
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

      {/* Stats Grid */}
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

        {/* Available to Withdraw */}
        <div className="glass-card-solid p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xs text-zinc-500">{t('available')}</span>
          </div>
          {isLoadingProfit ? (
            <div className="animate-pulse h-7 w-20 bg-white/10 rounded" />
          ) : (
            <>
              <p className="text-xl md:text-2xl font-bold text-white stat-number">
                ${profitData.availableWithdraw.toFixed(2)}
              </p>
              <Link 
                href="/earnings" 
                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-2"
              >
                {t('withdraw')} <ChevronRight className="w-3 h-3" />
              </Link>
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
            href="/referral" 
            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2"
          >
            {t('viewNetwork')} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Account Status */}
        <div className="glass-card-solid p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs text-zinc-500">{t('status')}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <StatusItem done={!!walletAddress} label={t('walletConnected')} />
            <StatusItem done={profitData.hasSignature} label={t('signatureDone')} />
            <StatusItem done={profile?.profile_completed || false} label={t('profileComplete')} />
          </div>
        </div>
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

      {/* Referral Link */}
      <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} t={t} />
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
