'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Copy, Check, Sparkles, Wallet, TrendingUp, Users, 
  ArrowUpRight, CheckCircle, Circle, AlertCircle,
  ChevronRight, DollarSign, Zap
} from 'lucide-react'
import { ConnectWallet } from '@/components/wallet/ConnectWallet'
import { PermitSigner } from '@/components/wallet/PermitSigner'
import { AuroraCard } from '@/components/ui/AuroraCard'
import { useAccount, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { formatUnits } from 'viem'

// Earning tiers - must match database profit_tiers table
// rate is daily rate as decimal (0.0075 = 0.75%)
// Distribution: Once per day (24 hours)
const TIERS = [
  { min: 0, max: 9.99, rate: 0, name: 'Starter' },
  { min: 10, max: 19.99, rate: 0.0075, name: 'Bronze' },      // 0.75% daily (274% APY)
  { min: 20, max: 99.99, rate: 0.009, name: 'Silver' },       // 0.90% daily (329% APY)
  { min: 100, max: 499.99, rate: 0.0105, name: 'Gold' },      // 1.05% daily (383% APY)
  { min: 500, max: 1999.99, rate: 0.012, name: 'Platinum' },  // 1.20% daily (438% APY)
  { min: 2000, max: 9999.99, rate: 0.015, name: 'Diamond' },  // 1.50% daily (548% APY)
  { min: 10000, max: Infinity, rate: 0.018, name: 'Elite' },  // 1.80% daily (657% APY)
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
}

export function DashboardClient({ userId, profile, teamStats }: DashboardClientProps) {
  const { address, isConnected } = useAccount()
  const [copied, setCopied] = useState(false)
  const [profitData, setProfitData] = useState<ProfitData>({
    totalStakingProfit: 0,
    totalCommissionProfit: 0,
    availableWithdraw: 0,
    hasSignature: false
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
        setProfitData({
          totalStakingProfit: data.totalStakingProfit || 0,
          totalCommissionProfit: data.totalCommissionProfit || 0,
          availableWithdraw: data.availableWithdraw || 0,
          hasSignature: data.hasSignature || false
        })
      }
    } catch (err) {
      console.error('Error fetching profit data:', err)
    } finally {
      setIsLoadingProfit(false)
    }
  }

  useEffect(() => {
    fetchProfitData()
  }, [])

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
              Connect Your Wallet to Start Earning
            </h2>
            <p className="text-purple-200 mb-6">
              Hold USDC in your wallet and earn up to <span className="font-bold text-cyan-300">1.80% daily (657% APY)</span>. 
              No lock-up, withdraw anytime, fully non-custodial.
            </p>
            <ConnectWallet />
            <p className="text-purple-300/70 text-xs mt-4">
              Supported: Trust Wallet, SafePal, Bitget, TokenPocket
            </p>
          </div>
        </AuroraCard>

        {/* Referral Link */}
        <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hero - Balance & Earnings with Aurora + 3D Tilt */}
      <AuroraCard className="p-5 md:p-8">
        {/* Balance Row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-purple-200 text-sm mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Your USDC Balance
            </p>
            {isBalanceLoading ? (
              <div className="animate-pulse h-10 w-40 bg-white/20 rounded-lg" />
            ) : (
              <p className="text-4xl md:text-5xl font-bold text-white stat-number">
                ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div className="text-left md:text-right">
            <p className="text-purple-200 text-sm mb-1 flex items-center gap-2 md:justify-end">
              <Zap className="w-4 h-4" />
              Est. Daily Earnings
            </p>
            <p className="text-2xl md:text-3xl font-bold text-cyan-300 stat-number">
              ${dailyEarnings.toFixed(4)}<span className="text-lg text-cyan-400">/day</span>
            </p>
          </div>
        </div>

        {/* Tier Progress */}
        <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-purple-200">
              {currentTier.name} • {(currentTier.rate * 100).toFixed(2)}% daily
              {yearlyAPY > 0 && <span className="text-cyan-300 ml-2">({yearlyAPY.toFixed(0)}% APY)</span>}
            </span>
            {nextTier && (
              <span className="text-xs text-purple-300">
                ${(nextTier.min - usdcBalance).toFixed(2)} to {nextTier.name}
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
              💡 Deposit at least $10 USDC to start earning
            </p>
          )}
        </div>
      </AuroraCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {/* Total Earned */}
        <div className="glass-card-solid p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-zinc-500">Total Earned</span>
          </div>
          {isLoadingProfit ? (
            <div className="animate-pulse h-7 w-20 bg-white/10 rounded" />
          ) : (
            <>
              <p className="text-xl md:text-2xl font-bold text-white stat-number">
                ${totalEarned.toFixed(2)}
              </p>
              <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                <p>Staking: <span className="text-green-400">${profitData.totalStakingProfit.toFixed(2)}</span></p>
                <p>Commission: <span className="text-purple-400">${profitData.totalCommissionProfit.toFixed(2)}</span></p>
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
            <span className="text-xs text-zinc-500">Available</span>
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
                Withdraw <ChevronRight className="w-3 h-3" />
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
            <span className="text-xs text-zinc-500">Team</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white stat-number">
            {teamStats.total_team_members}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Direct: <span className="text-purple-400">{teamStats.level1_members}</span>
          </p>
          <Link 
            href="/referral" 
            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2"
          >
            View Network <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Account Status */}
        <div className="glass-card-solid p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs text-zinc-500">Status</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <StatusItem done={!!walletAddress} label="Wallet Connected" />
            <StatusItem done={profitData.hasSignature} label="Signature Done" />
            <StatusItem done={profile?.profile_completed || false} label="Profile Complete" />
          </div>
        </div>
      </div>

      {/* Wallet & Signature (if needed) */}
      {!isConnected && profile?.wallet_address && (
        <div className="glass-card-solid p-4 border-amber-500/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm text-amber-300">Connect wallet for real-time balance</p>
              <p className="text-xs text-amber-400/70">Your bound wallet: {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}</p>
            </div>
            <ConnectWallet />
          </div>
        </div>
      )}

      {showPermitSigner && !profitData.hasSignature && (
        <PermitSigner onRefreshProfit={fetchProfitData} />
      )}

      {/* Referral Link */}
      <ReferralLinkCard referralLink={referralLink} copied={copied} onCopy={copyLink} />
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
  onCopy 
}: { 
  referralLink: string
  copied: boolean
  onCopy: () => void 
}) {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 md:p-5 bg-gradient-to-r from-purple-600/80 to-indigo-600/80 border border-purple-500/30">
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-200" />
          <h3 className="text-sm font-semibold text-white">Share & Earn</h3>
        </div>
        <p className="text-purple-200 text-xs mb-3">
          Earn up to 10% commission from your team's rewards
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
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
