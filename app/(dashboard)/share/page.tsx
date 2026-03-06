'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import { ArrowLeft, Download, Share2, Loader2, X, Plus, Phone, Mail, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase'
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
  phone: string | null
  email: string | null
  profileCompleted: boolean
}

export default function SharePage() {
  const t = useTranslations('dashboard')
  const cardRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ShareData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [trophyDataUrl, setTrophyDataUrl] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch profile (including wallet_address, phone, email, profile_completed)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, referral_code, created_at, wallet_address, phone_country_code, phone_number, email, profile_completed')
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

      // Read on-chain USDC balance via server-side API (uses Alchemy RPC)
      let walletBalance = 0
      const walletAddr = profile?.wallet_address || profitData.wallet_address
      if (walletAddr) {
        try {
          const balRes = await fetch(`/api/wallet/balance?address=${walletAddr}`)
          const balData = balRes.ok ? await balRes.json() : { balance: 0 }
          walletBalance = balData.balance || 0
        } catch (err) {
          console.error('[Share] Failed to fetch wallet balance:', err)
        }
      }

      const totalEarned = (profits.total_earned_usdc || 0) + (profits.total_commission_earned || 0)
      const tier = getTier(walletBalance)
      const dailyEarnings = walletBalance * tier.rate

      // Build phone string
      const phoneStr = profile?.phone_number
        ? `${profile.phone_country_code || ''}${profile.phone_number}`
        : null
      // Filter out wallet placeholder emails
      const emailStr = profile?.email && !profile.email.endsWith('@wallet.polnation.com')
        ? profile.email
        : null

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
        phone: phoneStr,
        email: emailStr,
        profileCompleted: !!profile?.profile_completed,
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

  // Preload trophy image as data URL via fetch (works on all browsers including Safari)
  useEffect(() => {
    if (!data?.communityLevel) return
    const imgPath = getLevelImagePath(data.communityLevel)
    fetch(imgPath)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setTrophyDataUrl(reader.result)
          }
        }
        reader.readAsDataURL(blob)
      })
      .catch(() => { /* fallback to URL path */ })
  }, [data?.communityLevel])

  const referralLink = data?.referralCode
    ? `https://polnation.com/register?ref=${data.referralCode}`
    : 'https://polnation.com'

  const pngOptions = {
    quality: 1,
    pixelRatio: 3,
    backgroundColor: '#0D0B21',
    cacheBust: true,
  }

  const handleSaveImage = async () => {
    if (!cardRef.current) return
    setIsSaving(true)
    try {
      const dataUrl = await toPng(cardRef.current, pngOptions)
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
      const dataUrl = await toPng(cardRef.current, pngOptions)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'polnation-share.png', { type: 'image/png' })
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Polnation Earnings',
          text: data?.referralCode
            ? `🚀 Join me on Polnation! I'm earning ${data?.dailyRate.toFixed(2)}% daily on USDC.\n\n👉 ${referralLink}`
            : `🚀 Check out Polnation - earn daily USDC rewards!\n\n👉 https://polnation.com`,
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

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setUserPhoto(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeUserPhoto = () => {
    setUserPhoto(null)
  }

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

      {/* Profile incomplete warning */}
      {data && (!data.profileCompleted || !data.referralCode) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-300 font-medium">Complete your profile to share</p>
            <p className="text-xs text-amber-400/70">Your referral link will be generated after you complete your profile and bind your email.</p>
          </div>
          <Link href="/profile" className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-400 transition-colors flex-shrink-0">
            Go to Profile
          </Link>
        </div>
      )}

      {/* ===== SHARE CARD ===== */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(160deg, ${tierVisual.gradientFrom} 0%, #0D0B21 40%, ${tierVisual.gradientFrom} 80%, #0D0B21 100%)`,
          width: '100%',
          aspectRatio: '9/16',
        }}
      >
        {/* Hidden photo input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />

        {/* Tier-specific glow effects */}
        <div className="absolute inset-0 z-[0] pointer-events-none">
          <div
            className="absolute -top-[15%] -right-[5%] w-[70%] h-[55%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${tierVisual.glow} 0%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />
          <div
            className="absolute -bottom-[10%] -left-[5%] w-[55%] h-[45%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${communityVisual.color}18 0%, transparent 70%)`,
              filter: 'blur(50px)',
            }}
          />
          <div
            className="absolute top-[35%] left-[25%] w-[55%] h-[40%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${tierVisual.glow} 0%, transparent 70%)`,
              filter: 'blur(50px)',
            }}
          />
        </div>

        {/* Content - everything in normal flow, z-10 */}
        <div className="relative flex flex-col h-full p-6 sm:p-8 z-10">
          
          {/* Top: User info + date */}
          <div className="flex items-center gap-3 mb-4">
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

          {/* ===== MAIN VISUAL: User Photo + Trophy (in flow) ===== */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 mb-4" style={{ minHeight: '32%' }}>
            {/* User Photo Frame */}
            <div className="relative flex-shrink-0" style={{ width: '38%', maxWidth: 150 }}>
              {userPhoto ? (
                <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={userPhoto}
                    alt="My photo"
                    className="w-full h-full object-cover rounded-2xl"
                    style={{
                      border: `2px solid ${tierVisual.color}60`,
                      boxShadow: `0 8px 30px ${tierVisual.color}30, 0 0 60px ${tierVisual.color}10`,
                    }}
                  />
                  {/* Remove photo button (won't appear in export) */}
                  <button
                    onClick={removeUserPhoto}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-red-500/80 transition-colors z-20 print:hidden"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {/* Bottom gradient blend */}
                  <div className="absolute bottom-0 left-0 right-0 h-[30%] rounded-b-2xl"
                    style={{ background: `linear-gradient(to top, #0D0B21 0%, transparent 100%)` }}
                  />
                </div>
              ) : (
                <div
                  className="w-full flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-all hover:border-purple-400/60 hover:bg-purple-500/10"
                  style={{
                    aspectRatio: '3/4',
                    border: `2px dashed ${tierVisual.color}40`,
                    background: `${tierVisual.color}08`,
                  }}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Plus className="w-8 h-8 sm:w-10 sm:h-10 mb-2" style={{ color: `${tierVisual.color}70` }} />
                  <span className="text-[10px] sm:text-xs font-medium text-center px-2 leading-tight" style={{ color: `${tierVisual.color}90` }}>
                    Add Your Photo
                  </span>
                </div>
              )}
            </div>

            {/* Community Trophy - Main Visual */}
            <div className="relative flex-shrink-0" style={{ width: '45%', maxWidth: 190 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trophyDataUrl || getLevelImagePath(data?.communityLevel || 'Bronze')}
                alt={`${data?.communityLevel} Trophy`}
                className="w-full h-auto pointer-events-none"
                style={{
                  filter: `drop-shadow(0 0 50px ${communityVisual.color}50) drop-shadow(0 10px 30px rgba(0,0,0,0.4))`,
                }}
              />
              {/* Bottom gradient blend into background */}
              <div className="absolute bottom-0 left-[-10%] right-[-10%] h-[35%] pointer-events-none"
                style={{ background: `linear-gradient(to top, #0D0B21 0%, transparent 100%)` }}
              />
            </div>
          </div>

          {/* Lower content area */}
          <div className="flex-1 flex flex-col justify-center">
            
            {/* Dual badge row: Personal Tier + Community Level */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
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
                  src={trophyDataUrl || getLevelImagePath(data?.communityLevel || 'Bronze')}
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
            <p className="text-zinc-500 text-xs mb-3 drop-shadow-sm">
              Member since {data?.joinDate}
            </p>

            {/* Main profit number + Daily Rate */}
            <div className="mb-4 flex flex-wrap items-end gap-x-3">
              <div>
                <span
                  className="font-extrabold tracking-tight drop-shadow-lg"
                  style={{
                    fontSize: 'clamp(2.2rem, 9vw, 3.5rem)',
                    lineHeight: 1,
                    color: (data?.totalEarned || 0) >= 0 ? '#22c55e' : '#ef4444',
                    textShadow: '0 2px 20px rgba(34, 197, 94, 0.3)',
                  }}
                >
                  {(data?.totalEarned || 0) >= 0 ? '+' : ''}{(data?.totalEarned || 0).toFixed(2)}
                </span>
                <span className="text-zinc-300 text-lg sm:text-xl font-semibold ml-2 drop-shadow-md">USDC</span>
              </div>
              {/* Daily Rate - large green callout */}
              {(data?.dailyRate || 0) > 0 && (
                <div className="flex items-center gap-1 pb-1">
                  <span className="text-[#22c55e] font-extrabold drop-shadow-lg" style={{ fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', lineHeight: 1, textShadow: '0 2px 15px rgba(34,197,94,0.4)' }}>
                    📈 {data?.dailyRate.toFixed(2)}%
                  </span>
                  <span className="text-emerald-400/70 text-xs font-medium">/day</span>
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
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

          {/* Bottom: Contact + Divider + branding + QR */}
          <div>
            {/* Contact info (if available) */}
            {(data?.phone || data?.email) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                {data.email && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-400 text-xs drop-shadow-sm">
                    <Mail className="w-3 h-3 text-zinc-500" />
                    {data.email}
                  </span>
                )}
                {data.phone && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-400 text-xs drop-shadow-sm">
                    <Phone className="w-3 h-3 text-zinc-500" />
                    {data.phone}
                  </span>
                )}
              </div>
            )}

            {/* Gradient accent line using tier colors */}
            <div
              className="w-full h-[2px] mb-4 rounded-full"
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

              {/* QR Code - only show when referral code exists */}
              {data?.referralCode ? (
                <div className="bg-white rounded-lg p-1.5 sm:p-2 shadow-lg" style={{ boxShadow: `0 4px 15px ${tierVisual.color}30` }}>
                  <QRCodeSVG
                    value={referralLink}
                    size={72}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg p-3 bg-white/5 border border-white/10" style={{ width: 80, height: 80 }}>
                  <p className="text-zinc-500 text-[9px] text-center leading-tight">Complete profile to get QR code</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tip */}
      <p className="text-center text-zinc-600 text-xs">
        {t('shareAndEarn')} — Save and share this card to invite friends
      </p>
      <p className="text-center text-zinc-500 text-[11px]">
        📱 iOS users: please use Chrome browser for best image download experience.
      </p>
    </div>
  )
}
