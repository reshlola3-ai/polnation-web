'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import { ArrowLeft, Download, Share2, Loader2, ImagePlus, X } from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase'
import { createPublicClient, http, formatUnits, parseAbi } from 'viem'
import { polygon } from 'viem/chains'
import { useTranslations } from 'next-intl'

// Personal staking tiers
const TIERS = [
  { min: 0, max: 9.99, rate: 0, name: 'Visitor' },
  { min: 10, max: 19.99, rate: 0.0075, name: 'Resident' },
  { min: 20, max: 99.99, rate: 0.009, name: 'Citizen' },
  { min: 100, max: 499.99, rate: 0.0105, name: 'Representative' },
  { min: 500, max: 1999.99, rate: 0.012, name: 'Senator' },
  { min: 2000, max: 9999.99, rate: 0.015, name: 'Ambassador' },
  { min: 10000, max: Infinity, rate: 0.018, name: 'Chancellor' },
]

function getTier(balance: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].min) return TIERS[i]
  }
  return TIERS[0]
}

// Tier visual config: color scheme + icon per personal tier
const TIER_VISUALS: Record<string, { emoji: string; color: string; glow: string; gradientFrom: string; gradientTo: string }> = {
  'Visitor':        { emoji: '👁️', color: '#999999', glow: 'rgba(150,150,150,0.12)', gradientFrom: '#1a1a2e', gradientTo: '#16162a' },
  'Resident':       { emoji: '🏠', color: '#22c55e', glow: 'rgba(34,197,94,0.15)', gradientFrom: '#0a1a12', gradientTo: '#0D0B21' },
  'Citizen':        { emoji: '🎖️', color: '#3b82f6', glow: 'rgba(59,130,246,0.15)', gradientFrom: '#0a1225', gradientTo: '#0D0B21' },
  'Representative': { emoji: '📋', color: '#9333ea', glow: 'rgba(147,51,234,0.18)', gradientFrom: '#150a28', gradientTo: '#0D0B21' },
  'Senator':        { emoji: '🏛️', color: '#f59e0b', glow: 'rgba(245,158,11,0.18)', gradientFrom: '#1a1408', gradientTo: '#0D0B21' },
  'Ambassador':     { emoji: '🌐', color: '#06b6d4', glow: 'rgba(6,182,212,0.18)', gradientFrom: '#081a1e', gradientTo: '#0D0B21' },
  'Chancellor':     { emoji: '👑', color: '#ef4444', glow: 'rgba(239,68,68,0.15)', gradientFrom: '#1a0a0a', gradientTo: '#0D0B21' },
}

// Community level visual config
const COMMUNITY_VISUALS: Record<string, { emoji: string; color: string; level: number }> = {
  'None':     { emoji: '—', color: '#666666', level: 1 },
  'Bronze':   { emoji: '🥉', color: '#cd7f32', level: 1 },
  'Silver':   { emoji: '🥈', color: '#c0c0c0', level: 2 },
  'Gold':     { emoji: '🥇', color: '#ffd700', level: 3 },
  'Platinum': { emoji: '💎', color: '#e5e4e2', level: 4 },
  'Diamond':  { emoji: '💠', color: '#00d4ff', level: 5 },
  'Elite':    { emoji: '⚡', color: '#ff6b35', level: 6 },
}

// Get community level image path
function getLevelImagePath(levelName: string): string {
  const visual = COMMUNITY_VISUALS[levelName] || COMMUNITY_VISUALS['Bronze']
  return `/levels/level-${visual.level}.webp`
}

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

interface ShareData {
  username: string
  referralCode: string | null
  joinDate: string
  totalEarned: number
  dailyEarnings: number
  teamMembers: number
  tier: string
  dailyRate: number
  walletBalance: number
  communityLevel: string
  communityPrizePool: number
}

export default function SharePage() {
  const t = useTranslations('dashboard')
  const cardRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<ShareData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userBgImage, setUserBgImage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch profile (including wallet_address)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, referral_code, created_at, wallet_address')
        .eq('id', user.id)
        .single()

      // Fetch profits
      const profitRes = await fetch('/api/profits/user')
      const profitData = profitRes.ok ? await profitRes.json() : { profits: {} }
      const profits = profitData.profits || {}

      // Fetch team stats
      const refRes = await fetch('/api/referral/balances')
      const refData = refRes.ok ? await refRes.json() : { stats: {} }

      // Fetch community status for community level
      const communityRes = await fetch('/api/community/status')
      const communityData = communityRes.ok ? await communityRes.json() : {}
      const communityLevel = communityData.currentLevelInfo?.name || 'Bronze'
      const communityPrizePool = communityData.currentLevelInfo?.reward_pool || 10

      // Read on-chain USDC balance
      let walletBalance = 0
      const walletAddr = profile?.wallet_address || profitData.wallet_address
      console.log('[Share] wallet_address from profile:', profile?.wallet_address)
      console.log('[Share] wallet_address from profitData:', profitData.wallet_address)
      console.log('[Share] final walletAddr:', walletAddr)
      if (walletAddr) {
        try {
          const publicClient = createPublicClient({
            chain: polygon,
            transport: http('https://polygon-rpc.com'),
          })
          const rawBalance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [walletAddr as `0x${string}`],
          })
          walletBalance = Number(formatUnits(rawBalance, 6))
          console.log('[Share] on-chain USDC balance:', walletBalance)
        } catch (err) {
          console.error('[Share] Failed to read on-chain balance:', err)
        }
      } else {
        console.warn('[Share] No wallet address found - balance will be 0')
      }

      const totalEarned = (profits.total_earned_usdc || 0) + (profits.total_commission_earned || 0)
      const tier = getTier(walletBalance)
      const dailyEarnings = walletBalance * tier.rate

      setData({
        username: profile?.username || 'Polnation User',
        referralCode: profile?.referral_code || null,
        joinDate: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
        totalEarned,
        dailyEarnings,
        teamMembers: refData.stats?.totalMembers || 0,
        tier: tier.name,
        dailyRate: tier.rate * 100,
        walletBalance,
        communityLevel,
        communityPrizePool,
      })
    } catch (err) {
      console.error('Error fetching share data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveImage = async () => {
    if (!cardRef.current) return
    setIsSaving(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#0D0B21',
      })
      const link = document.createElement('a')
      link.download = `polnation-${data?.username || 'share'}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to save image:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleShare = async () => {
    if (!cardRef.current) return
    setIsSaving(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#0D0B21',
      })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'polnation-share.png', { type: 'image/png' })
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Polnation Earnings',
          text: `Join me on Polnation! I'm earning daily rewards. 🚀`,
        })
      } else {
        handleSaveImage()
      }
    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setUserBgImage(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeUserBg = () => {
    setUserBgImage(null)
  }

  const referralLink = data?.referralCode
    ? `https://polnation.com/register?ref=${data.referralCode}`
    : 'https://polnation.com'

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  // Get tier visuals
  const tierVisual = TIER_VISUALS[data?.tier || 'Visitor'] || TIER_VISUALS['Visitor']
  const communityVisual = COMMUNITY_VISUALS[data?.communityLevel || 'Bronze'] || COMMUNITY_VISUALS['Bronze']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
            title="Upload background image"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={handleSaveImage}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Save Image
          </button>
        </div>
      </div>

      {/* Remove background hint */}
      {userBgImage && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <span className="text-xs text-purple-300">Custom background applied</span>
          <button onClick={removeUserBg} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===== SHARE CARD ===== */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: userBgImage
            ? '#0D0B21'
            : `linear-gradient(160deg, ${tierVisual.gradientFrom} 0%, #0D0B21 40%, ${tierVisual.gradientFrom} 80%, #0D0B21 100%)`,
          width: '100%',
          aspectRatio: '9/16',
        }}
      >
        {/* User uploaded background image */}
        {userBgImage && (
          <div
            className="absolute inset-0 z-[1]"
            style={{
              backgroundImage: `url(${userBgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-transparent to-purple-950/60" />
          </div>
        )}

        {/* Tier-specific glow effects */}
        <div className={`absolute inset-0 ${userBgImage ? 'z-[2] opacity-40' : 'z-[0]'}`}>
          {/* Large tier glow - top right */}
          <div
            className="absolute -top-[15%] -right-[5%] w-[70%] h-[55%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${tierVisual.glow} 0%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />
          {/* Community level glow - bottom left */}
          <div
            className="absolute -bottom-[10%] -left-[5%] w-[55%] h-[45%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${communityVisual.color}18 0%, transparent 70%)`,
              filter: 'blur(50px)',
            }}
          />
          {/* Center subtle glow */}
          <div
            className="absolute top-[35%] left-[25%] w-[55%] h-[40%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${tierVisual.glow} 0%, transparent 70%)`,
              filter: 'blur(50px)',
            }}
          />
        </div>

        {/* Community level trophy image - large watermark */}
        <div
          className={`absolute top-[2%] right-[-8%] ${userBgImage ? 'z-[3]' : 'z-[1]'} select-none pointer-events-none`}
          style={{
            width: '65%',
            height: '50%',
            opacity: userBgImage ? 0.12 : 0.18,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getLevelImagePath(data?.communityLevel || 'Bronze')}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'top right',
              filter: `drop-shadow(0 0 40px ${communityVisual.color}40)`,
            }}
          />
        </div>

        {/* Content */}
        <div className={`relative flex flex-col h-full p-6 sm:p-8 ${userBgImage ? 'z-[5]' : 'z-10'}`}>
          
          {/* Top: User info + date */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${tierVisual.color}, ${communityVisual.color})`,
                boxShadow: `0 4px 15px ${tierVisual.color}40`,
              }}
            >
              {data?.username?.charAt(0)?.toUpperCase() || 'P'}
            </div>
            <div>
              <p className="text-white font-bold text-base sm:text-lg leading-tight drop-shadow-lg">{data?.username}</p>
              <p className="text-zinc-400 text-xs sm:text-sm drop-shadow-md">{dateStr}</p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 flex flex-col justify-center">
            
            {/* Dual badge row: Personal Tier + Community Level */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Personal staking tier badge */}
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm shadow-lg"
                style={{
                  background: `${tierVisual.color}20`,
                  border: `1px solid ${tierVisual.color}40`,
                  color: tierVisual.color,
                  boxShadow: `0 2px 10px ${tierVisual.color}15`,
                }}
              >
                {tierVisual.emoji} {data?.tier} • {data?.dailyRate.toFixed(2)}% daily
              </span>
              {/* Community level badge with trophy icon */}
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm shadow-lg"
                style={{
                  background: `${communityVisual.color}20`,
                  border: `1px solid ${communityVisual.color}40`,
                  color: communityVisual.color,
                  boxShadow: `0 2px 10px ${communityVisual.color}15`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getLevelImagePath(data?.communityLevel || 'Bronze')}
                  alt=""
                  style={{ width: 18, height: 18, objectFit: 'contain' }}
                />
                {data?.communityLevel} Community
              </span>
            </div>

            {/* Title */}
            <p className="text-zinc-400 text-sm sm:text-base font-medium mb-1 tracking-wide drop-shadow-md">
              My Polnation Earnings
            </p>
            <p className="text-zinc-500 text-xs mb-4 drop-shadow-sm">
              Member since {data?.joinDate}
            </p>

            {/* Main profit number */}
            <div className="mb-6">
              <span
                className="font-extrabold tracking-tight drop-shadow-lg"
                style={{
                  fontSize: 'clamp(2.5rem, 10vw, 4rem)',
                  lineHeight: 1,
                  color: (data?.totalEarned || 0) >= 0 ? '#22c55e' : '#ef4444',
                  textShadow: '0 2px 20px rgba(34, 197, 94, 0.3)',
                }}
              >
                {(data?.totalEarned || 0) >= 0 ? '+' : ''}{(data?.totalEarned || 0).toFixed(2)}
              </span>
              <span className="text-zinc-300 text-lg sm:text-xl font-semibold ml-2 drop-shadow-md">USDC</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Est. Daily</p>
                <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">
                  ${(data?.dailyEarnings || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Wallet Balance</p>
                <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">
                  ${(data?.walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Team</p>
                <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">
                  {data?.teamMembers || 0} <span className="text-zinc-400 text-sm font-normal">members</span>
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Prize Pool</p>
                <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">
                  ${(data?.communityPrizePool || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom: Divider + branding + QR */}
          <div>
            {/* Gradient accent line using tier colors */}
            <div
              className="w-full h-[2px] mb-5 rounded-full"
              style={{
                background: `linear-gradient(to right, ${tierVisual.color}, ${communityVisual.color}, ${tierVisual.color})`,
                boxShadow: `0 0 8px ${tierVisual.color}40`,
              }}
            />

            <div className="flex items-end justify-between">
              {/* Brand */}
              <div>
                <p className="text-white text-xl sm:text-2xl font-extrabold tracking-tight leading-none drop-shadow-lg">
                  POLNATION
                </p>
                <p className="text-purple-300 text-xs font-medium mt-0.5 drop-shadow-md">
                  Soft Staking Platform
                </p>
                {data?.referralCode && (
                  <p className="text-zinc-500 text-[10px] mt-1.5">
                    Referral Code: {data.referralCode}
                  </p>
                )}
              </div>

              {/* QR Code */}
              <div className="bg-white rounded-lg p-1.5 sm:p-2 shadow-lg" style={{ boxShadow: `0 4px 15px ${tierVisual.color}30` }}>
                <QRCodeSVG
                  value={referralLink}
                  size={72}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tip */}
      <p className="text-center text-zinc-600 text-xs">
        {t('shareAndEarn')} — Save and share this card to invite friends
      </p>
    </div>
  )
}
