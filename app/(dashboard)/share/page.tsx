'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import { ArrowLeft, Download, Share2, Loader2, ImagePlus, X } from 'lucide-react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

// Tier definitions
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

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, referral_code, created_at')
        .eq('id', user.id)
        .single()

      // Fetch profits
      const profitRes = await fetch('/api/profits/user')
      const profitData = profitRes.ok ? await profitRes.json() : { profits: {} }
      const profits = profitData.profits || {}

      // Fetch team stats
      const refRes = await fetch('/api/referral/balances')
      const refData = refRes.ok ? await refRes.json() : { stats: {} }

      const totalEarned = (profits.total_earned_usdc || 0) + (profits.total_commission_earned || 0)
      
      // Estimate wallet balance from profit data or default
      const walletBalance = profits.wallet_usdc_balance || 0
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
        // Fallback to download
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
    // Validate file type
    if (!file.type.startsWith('image/')) return
    // Max 5MB
    if (file.size > 5 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setUserBgImage(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    // Reset input so user can re-select same file
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
          {/* Upload background image button */}
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
          background: 'linear-gradient(160deg, #0D0B21 0%, #120820 30%, #1a0d30 60%, #0D0B21 100%)',
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
            {/* Dark overlay to keep text readable */}
            <div className="absolute inset-0 bg-black/50" />
            {/* Purple tint overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-transparent to-purple-950/60" />
          </div>
        )}

        {/* Purple/Cyan glow spots (visible when no user image, subtle with user image) */}
        <div className={`absolute inset-0 ${userBgImage ? 'z-[2] opacity-40' : 'z-[0]'}`}>
          {/* Top-right purple glow */}
          <div
            className="absolute -top-[20%] -right-[10%] w-[70%] h-[60%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(147, 51, 234, 0.18) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          {/* Bottom-left cyan glow */}
          <div
            className="absolute -bottom-[15%] -left-[10%] w-[60%] h-[50%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, transparent 70%)',
              filter: 'blur(50px)',
            }}
          />
          {/* Center subtle purple */}
          <div
            className="absolute top-[40%] left-[30%] w-[50%] h-[40%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </div>

        {/* Watermark logo — purple-tinted */}
        <div
          className={`absolute top-0 right-0 w-[65%] h-[50%] opacity-[0.07] ${userBgImage ? 'z-[3]' : 'z-[1]'}`}
          style={{
            backgroundImage: 'url(/logo.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'top right',
            filter: 'brightness(0.6) sepia(1) hue-rotate(230deg) saturate(3)',
          }}
        />

        {/* Content */}
        <div className={`relative flex flex-col h-full p-6 sm:p-8 ${userBgImage ? 'z-[5]' : 'z-10'}`}>
          
          {/* Top: User info + date */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg shadow-purple-500/20">
              {data?.username?.charAt(0)?.toUpperCase() || 'P'}
            </div>
            <div>
              <p className="text-white font-bold text-base sm:text-lg leading-tight drop-shadow-lg">{data?.username}</p>
              <p className="text-zinc-400 text-xs sm:text-sm drop-shadow-md">{dateStr}</p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 flex flex-col justify-center">
            
            {/* Tier badge */}
            <div className="mb-3">
              <span className="inline-block px-3 py-1 rounded-full bg-purple-500/25 border border-purple-400/30 text-purple-200 text-xs font-medium backdrop-blur-sm shadow-lg shadow-purple-500/10">
                🏛️ {data?.tier} • {data?.dailyRate.toFixed(2)}% daily
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
            <div className="mb-8">
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
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Daily Rate</p>
                <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">
                  {(data?.dailyRate || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Bottom: Divider + branding + QR */}
          <div>
            {/* Purple accent line */}
            <div className="w-full h-[2px] bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 mb-5 rounded-full shadow-sm shadow-purple-500/50" />

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
              <div className="bg-white rounded-lg p-1.5 sm:p-2 shadow-lg shadow-purple-500/20">
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
