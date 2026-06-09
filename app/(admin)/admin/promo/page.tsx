'use client'

import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { ArrowLeft, Download, Loader2, X, Plus, Phone, Mail } from 'lucide-react'
import Link from 'next/link'
import { toPng } from 'html-to-image'

// Personal staking tiers (mirrors user-facing share card)
const TIERS = [
  { rate: 0, name: 'Visitor' },
  { rate: 0.0075, name: 'Resident' },
  { rate: 0.009, name: 'Citizen' },
  { rate: 0.0105, name: 'Representative' },
  { rate: 0.012, name: 'Senator' },
  { rate: 0.015, name: 'Ambassador' },
  { rate: 0.018, name: 'Chancellor' },
]

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
  'Bronze':   { emoji: '🥉', color: '#cd7f32', level: 1 },
  'Silver':   { emoji: '🥈', color: '#c0c0c0', level: 2 },
  'Gold':     { emoji: '🥇', color: '#ffd700', level: 3 },
  'Platinum': { emoji: '💎', color: '#e5e4e2', level: 4 },
  'Diamond':  { emoji: '💠', color: '#00d4ff', level: 5 },
  'Elite':    { emoji: '⚡', color: '#ff6b35', level: 6 },
}

function getLevelImagePath(levelName: string): string {
  const visual = COMMUNITY_VISUALS[levelName] || COMMUNITY_VISUALS['Bronze']
  return `/levels/level-${visual.level}.webp`
}

function nowString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

// Parse a free-typed numeric field, defaulting to 0
const num = (v: string) => (parseFloat(v) || 0)

export default function AdminPromoPage() {
  const cardRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [trophyDataUrl, setTrophyDataUrl] = useState<string | null>(null)

  // ===== Form state (all manual) =====
  const [username, setUsername] = useState('Polnation User')
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const [tier, setTier] = useState('Senator')
  const [dailyRate, setDailyRate] = useState('1.20') // %, auto-filled from tier, editable
  const [communityLevel, setCommunityLevel] = useState('Gold')
  const [totalEarned, setTotalEarned] = useState('1280.50')
  const [dailyEarnings, setDailyEarnings] = useState('24.00')
  const [walletBalance, setWalletBalance] = useState('2000')
  const [teamMembers, setTeamMembers] = useState('128')
  const [prizePool, setPrizePool] = useState('500')
  const [dateStr, setDateStr] = useState(nowString())
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // When tier changes, auto-fill the default daily rate (admin can still override)
  const handleTierChange = (name: string) => {
    setTier(name)
    const t = TIERS.find(x => x.name === name)
    if (t) setDailyRate((t.rate * 100).toFixed(2))
  }

  // Preload trophy image as data URL for reliable export
  useEffect(() => {
    const imgPath = getLevelImagePath(communityLevel)
    fetch(imgPath)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') setTrophyDataUrl(reader.result)
        }
        reader.readAsDataURL(blob)
      })
      .catch(() => { /* fallback to URL path */ })
  }, [communityLevel])

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
      link.download = `polnation-promo-${username || 'card'}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to save image:', err)
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
    reader.onload = (ev) => setUserPhoto(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const tierVisual = TIER_VISUALS[tier] || TIER_VISUALS['Visitor']
  const communityVisual = COMMUNITY_VISUALS[communityLevel] || COMMUNITY_VISUALS['Bronze']

  const totalEarnedNum = num(totalEarned)
  const dailyRateNum = num(dailyRate)

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">Promo Image Generator</h1>
          <p className="text-xs text-zinc-400 text-right">宣传图生成器</p>
        </div>
        <button
          onClick={handleSaveImage}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Save Image
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* ===== FORM PANEL ===== */}
        <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-5 space-y-4 h-fit">
          {/* Photo */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">照片 Photo（可选）</label>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <div className="flex items-center gap-3">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors"
              >
                {userPhoto ? '更换照片' : '上传照片'}
              </button>
              {userPhoto && (
                <button onClick={() => setUserPhoto(null)} className="text-xs text-red-400 hover:text-red-300">移除</button>
              )}
            </div>
          </div>

          <Field label="用户名 Username" value={username} onChange={setUsername} />

          {/* Tier + daily rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">个人等级 Tier</label>
              <select
                value={tier}
                onChange={(e) => handleTierChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-purple-500"
              >
                {TIERS.map(t => <option key={t.name} value={t.name}>{TIER_VISUALS[t.name].emoji} {t.name}</option>)}
              </select>
            </div>
            <Field label="每日 % Daily Rate" value={dailyRate} onChange={setDailyRate} type="number" />
          </div>

          {/* Community level */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">社区等级 Community</label>
            <select
              value={communityLevel}
              onChange={(e) => setCommunityLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              {Object.keys(COMMUNITY_VISUALS).map(name => (
                <option key={name} value={name}>{COMMUNITY_VISUALS[name].emoji} {name}</option>
              ))}
            </select>
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="总收益 Total USDC" value={totalEarned} onChange={setTotalEarned} type="number" />
            <Field label="预计每日 Est. Daily $" value={dailyEarnings} onChange={setDailyEarnings} type="number" />
            <Field label="钱包余额 Wallet $" value={walletBalance} onChange={setWalletBalance} type="number" />
            <Field label="团队人数 Team" value={teamMembers} onChange={setTeamMembers} type="number" />
            <Field label="奖池 Prize Pool $" value={prizePool} onChange={setPrizePool} type="number" />
            <Field label="日期 Date" value={dateStr} onChange={setDateStr} />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="邮箱 Email（可选）" value={email} onChange={setEmail} />
            <Field label="电话 Phone（可选）" value={phone} onChange={setPhone} />
          </div>
        </div>

        {/* ===== PREVIEW CARD ===== */}
        <div className="max-w-md w-full mx-auto">
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: `linear-gradient(160deg, ${tierVisual.gradientFrom} 0%, #0D0B21 40%, ${tierVisual.gradientFrom} 80%, #0D0B21 100%)`,
              width: '100%',
              aspectRatio: '9/16',
            }}
          >
            {/* Tier-specific glow effects */}
            <div className="absolute inset-0 z-[0] pointer-events-none">
              <div className="absolute -top-[15%] -right-[5%] w-[70%] h-[55%] rounded-full"
                style={{ background: `radial-gradient(circle, ${tierVisual.glow} 0%, transparent 70%)`, filter: 'blur(60px)' }} />
              <div className="absolute -bottom-[10%] -left-[5%] w-[55%] h-[45%] rounded-full"
                style={{ background: `radial-gradient(circle, ${communityVisual.color}18 0%, transparent 70%)`, filter: 'blur(50px)' }} />
              <div className="absolute top-[35%] left-[25%] w-[55%] h-[40%] rounded-full"
                style={{ background: `radial-gradient(circle, ${tierVisual.glow} 0%, transparent 70%)`, filter: 'blur(50px)' }} />
            </div>

            {/* Content */}
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
                  {username?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div>
                  <p className="text-white font-bold text-base sm:text-lg leading-tight drop-shadow-lg">{username}</p>
                  <p className="text-zinc-400 text-xs sm:text-sm drop-shadow-md">{dateStr}</p>
                </div>
              </div>

              {/* Main visual: photo + trophy */}
              <div className="flex items-center justify-center gap-3 sm:gap-5 mb-4" style={{ minHeight: '32%' }}>
                {/* Photo frame */}
                <div className="relative flex-shrink-0" style={{ width: '38%', maxWidth: 150 }}>
                  {userPhoto ? (
                    <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={userPhoto} alt="Photo" className="w-full h-full object-cover rounded-2xl"
                        style={{ border: `2px solid ${tierVisual.color}60`, boxShadow: `0 8px 30px ${tierVisual.color}30, 0 0 60px ${tierVisual.color}10` }} />
                      <button onClick={() => setUserPhoto(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-red-500/80 transition-colors z-20 print:hidden">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 h-[30%] rounded-b-2xl"
                        style={{ background: `linear-gradient(to top, #0D0B21 0%, transparent 100%)` }} />
                    </div>
                  ) : (
                    <div
                      className="w-full flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-all hover:border-purple-400/60 hover:bg-purple-500/10"
                      style={{ aspectRatio: '3/4', border: `2px dashed ${tierVisual.color}40`, background: `${tierVisual.color}08` }}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Plus className="w-8 h-8 sm:w-10 sm:h-10 mb-2" style={{ color: `${tierVisual.color}70` }} />
                      <span className="text-[10px] sm:text-xs font-medium text-center px-2 leading-tight" style={{ color: `${tierVisual.color}90` }}>
                        Add Photo
                      </span>
                    </div>
                  )}
                </div>

                {/* Trophy */}
                <div className="relative flex-shrink-0" style={{ width: '45%', maxWidth: 190 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={trophyDataUrl || getLevelImagePath(communityLevel)} alt={`${communityLevel} Trophy`}
                    className="w-full h-auto pointer-events-none"
                    style={{ filter: `drop-shadow(0 0 50px ${communityVisual.color}50) drop-shadow(0 10px 30px rgba(0,0,0,0.4))` }} />
                  <div className="absolute bottom-0 left-[-10%] right-[-10%] h-[35%] pointer-events-none"
                    style={{ background: `linear-gradient(to top, #0D0B21 0%, transparent 100%)` }} />
                </div>
              </div>

              {/* Lower content */}
              <div className="flex-1 flex flex-col justify-center">
                {/* Dual badge row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
                    style={{ background: `${tierVisual.color}20`, border: `1px solid ${tierVisual.color}40`, color: tierVisual.color, boxShadow: `0 2px 10px ${tierVisual.color}15` }}>
                    {tierVisual.emoji} {tier} • {dailyRateNum.toFixed(2)}% daily
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
                    style={{ background: `${communityVisual.color}20`, border: `1px solid ${communityVisual.color}40`, color: communityVisual.color, boxShadow: `0 2px 10px ${communityVisual.color}15` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={trophyDataUrl || getLevelImagePath(communityLevel)} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                    {communityLevel} Community
                  </span>
                </div>

                {/* Title */}
                <p className="text-zinc-400 text-sm sm:text-base font-medium mb-3 tracking-wide drop-shadow-md">
                  My Polnation Earnings
                </p>

                {/* Main profit + daily rate */}
                <div className="mb-4 flex flex-wrap items-end gap-x-3">
                  <div>
                    <span className="font-extrabold tracking-tight drop-shadow-lg"
                      style={{ fontSize: 'clamp(2.2rem, 9vw, 3.5rem)', lineHeight: 1, color: totalEarnedNum >= 0 ? '#22c55e' : '#ef4444', textShadow: '0 2px 20px rgba(34, 197, 94, 0.3)' }}>
                      {totalEarnedNum >= 0 ? '+' : ''}{totalEarnedNum.toFixed(2)}
                    </span>
                    <span className="text-zinc-300 text-lg sm:text-xl font-semibold ml-2 drop-shadow-md">USDC</span>
                  </div>
                  {dailyRateNum > 0 && (
                    <div className="flex items-center gap-1 pb-1">
                      <span className="text-[#22c55e] font-extrabold drop-shadow-lg" style={{ fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', lineHeight: 1, textShadow: '0 2px 15px rgba(34,197,94,0.4)' }}>
                        📈 {dailyRateNum.toFixed(2)}%
                      </span>
                      <span className="text-[#00e28a]/60 text-xs font-medium">/day</span>
                    </div>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Est. Daily</p>
                    <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">${num(dailyEarnings).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Wallet Balance</p>
                    <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">${num(walletBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Team</p>
                    <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">
                      {num(teamMembers)} <span className="text-zinc-400 text-sm font-normal">members</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Prize Pool</p>
                    <p className="text-white text-lg sm:text-xl font-bold drop-shadow-md">${num(prizePool).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Bottom: contact + divider + branding */}
              <div>
                {(phone || email) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                    {email && (
                      <span className="inline-flex items-center gap-1.5 text-zinc-400 text-xs drop-shadow-sm">
                        <Mail className="w-3 h-3 text-zinc-500" />{email}
                      </span>
                    )}
                    {phone && (
                      <span className="inline-flex items-center gap-1.5 text-zinc-400 text-xs drop-shadow-sm">
                        <Phone className="w-3 h-3 text-zinc-500" />{phone}
                      </span>
                    )}
                  </div>
                )}

                <div className="w-full h-[2px] mb-4 rounded-full"
                  style={{ background: `linear-gradient(to right, ${tierVisual.color}, ${communityVisual.color}, ${tierVisual.color})`, boxShadow: `0 0 8px ${tierVisual.color}40` }} />

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white text-xl sm:text-2xl font-extrabold tracking-tight leading-none drop-shadow-lg">POLNATION</p>
                    <p className="text-purple-300 text-xs font-medium mt-0.5 drop-shadow-md">Agentic AI Earning</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-zinc-600 text-xs mt-4">
            实时预览 · 改左侧表单即时反映 · 点右上「Save Image」下载 9:16 高清图
          </p>
        </div>
      </div>
    </div>
  )
}

// Small labeled text/number input
function Field({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-purple-500"
      />
    </div>
  )
}
