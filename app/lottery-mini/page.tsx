'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { LuckyWheel } from '@lucky-canvas/react'
import { createClient } from '@/lib/supabase'
import { TmaWalletBinder } from '@/components/wallet/TmaWalletBinder'
import { BevelCard } from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat } from '@/components/ui/poly/MonoStat'

// ── Telegram WebApp typings (minimal — only what we use) ─────────────────────

interface TgMainButton {
  text: string
  show: () => void
  hide: () => void
  enable: () => void
  disable: () => void
  setText: (text: string) => void
  onClick: (handler: () => void) => void
  offClick: (handler: () => void) => void
  setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void
}

interface TgHaptic {
  notificationOccurred: (type: 'success' | 'error' | 'warning') => void
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
}

interface TgWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

interface TgWebApp {
  initData: string
  initDataUnsafe?: {
    user?: TgWebAppUser
    start_param?: string
  }
  ready: () => void
  expand: () => void
  close: () => void
  MainButton: TgMainButton
  HapticFeedback?: TgHaptic
  showPopup?: (
    params: { title?: string; message: string; buttons?: { id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }[] },
    callback?: (buttonId: string) => void
  ) => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  themeParams?: Record<string, string>
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

// ── Prize configs (must match server PRIZES table in /api/lottery/spin) ──────
// Mirrors components/lottery/LotteryWheel.tsx PRIZE_CONFIGS for visual parity.

const PRIZE_CONFIGS = [
  { type: 'bonus_1', color: '#7c3aed', amount: 1 },
  { type: 'thanks',  color: '#1e1b4b', amount: 0 },
  { type: 'usdc_05', color: '#059669', amount: 0.5 },
  { type: 'thanks',  color: '#1e1b4b', amount: 0 },
  { type: 'bonus_2', color: '#7c3aed', amount: 2 },
  { type: 'thanks',  color: '#1e1b4b', amount: 0 },
  { type: 'usdc_1',  color: '#0891b2', amount: 1 },
  { type: 'thanks',  color: '#1e1b4b', amount: 0 },
  { type: 'bonus_3', color: '#7c3aed', amount: 3 },
  { type: 'thanks',  color: '#1e1b4b', amount: 0 },
  { type: 'usdc_5',  color: '#d97706', amount: 5 },
  { type: 'thanks',  color: '#1e1b4b', amount: 0 },
] as const

const PRIZE_LABELS: Record<string, string> = {
  bonus_1: '+$1 Bonus',
  bonus_2: '+$2 Bonus',
  bonus_3: '+$3 Bonus',
  usdc_05: '$0.50 USDC',
  usdc_1: '$1 USDC',
  usdc_5: '$5 USDC',
  usdc_10: '$10 USDC',
  thanks: 'Try Again',
}

type AuthStatus = 'init' | 'authenticating' | 'ready' | 'error'
type WithdrawStatus = 'idle' | 'pending' | 'success' | 'error'

// ── Mock live ticker (placeholder until real volume) ─────────────────────────
// Generated client-side once per session. Names are plausible TG handles
// across regions; amounts mirror server prize tiers + realistic withdraw sums.
// Replace with /api/lottery/ticker when production data is dense enough.

const TICKER_NAMES = [
  'crypto_alex', 'polygon_fan', 'w3_native', 'maya_eth', 'sergio_x',
  'lina_w', 'defi_bro', 'sol_seeker', 'matic_max', 'eth_lover',
  'tomo_jp', 'ana_arg', 'kris_nl', 'dimitri_ru', 'priya_in',
  'leo_br', 'akira_jp', 'noah_de', 'zara_ae', 'mateo_es',
  'finn_fi', 'aiko_kr', 'ravi_in', 'yuki_jp', 'paolo_it',
  'nina_pl', 'koji_jp', 'liam_ie', 'cleo_eg', 'iris_gr',
]
const TICKER_WIN_AMOUNTS = [0.5, 0.5, 0.5, 1, 1, 1, 5]
const TICKER_WITHDRAW_AMOUNTS = [5.5, 12, 18, 25, 32, 47, 88, 120, 156, 250]

type TickerEvent = { type: 'win' | 'withdrawal'; name: string; amount: number }

function generateMockTicker(count: number): TickerEvent[] {
  const out: TickerEvent[] = []
  for (let i = 0; i < count; i++) {
    const isWin = Math.random() < 0.72
    out.push({
      type: isWin ? 'win' : 'withdrawal',
      name: TICKER_NAMES[Math.floor(Math.random() * TICKER_NAMES.length)],
      amount: isWin
        ? TICKER_WIN_AMOUNTS[Math.floor(Math.random() * TICKER_WIN_AMOUNTS.length)]
        : TICKER_WITHDRAW_AMOUNTS[Math.floor(Math.random() * TICKER_WITHDRAW_AMOUNTS.length)],
    })
  }
  return out
}

export default function LotteryMiniPage() {
  const supabase = createClient()
  const wheelRef = useRef<{ play: () => void; stop: (index: number) => void } | null>(null)

  const [authStatus, setAuthStatus] = useState<AuthStatus>('init')
  const [authError, setAuthError] = useState('')
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [remainingSpins, setRemainingSpins] = useState(0)
  const [isInfluencer, setIsInfluencer] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)

  // ── Wallet + withdraw state ──────────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [availableUsdc, setAvailableUsdc] = useState(0)
  const [showWalletPanel, setShowWalletPanel] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawStatus, setWithdrawStatus] = useState<WithdrawStatus>('idle')
  const [withdrawError, setWithdrawError] = useState('')

  // ── Network state (referrer + invite count + my TG username) ────────────────
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null)
  const [tgFirstName, setTgFirstName] = useState<string | null>(null)
  const [tgPhotoUrl, setTgPhotoUrl] = useState<string | null>(null)
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [invitedCount, setInvitedCount] = useState(0)

  // ── TG group membership state ───────────────────────────────────────────────
  const [groupConfigured, setGroupConfigured] = useState(false)
  const [isGroupMember, setIsGroupMember] = useState(false)
  const [groupInviteLink, setGroupInviteLink] = useState<string | null>(null)
  const [withdrawFocused, setWithdrawFocused] = useState(false)

  // ── Welcome bonus state ─────────────────────────────────────────────────────
  const [welcomeSpinEarned, setWelcomeSpinEarned] = useState(false)
  const [pendingGroupVerify, setPendingGroupVerify] = useState(false)

  // ── Mock live ticker (lazy init; one set per session) ──────────────────────
  const [tickerEvents] = useState(() => generateMockTicker(25))

  // ── Unlock progress + spin history ──────────────────────────────────────────
  const [progressToNextSpin, setProgressToNextSpin] = useState(0)
  const [nextMilestone, setNextMilestone] = useState(7)
  const [spinHistory, setSpinHistory] = useState<{
    id: string
    prize_type: string
    prize_label: string | null
    prize_amount: number | null
    reward_credited: boolean
    created_at: string
  }[]>([])

  // ── 1. TG Mini App bootstrap + auth ─────────────────────────────────────────

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setAuthStatus('error')
      setAuthError('Open this page from inside Telegram.')
      return
    }
    tg.ready()
    tg.expand()

    // Populate identity from initDataUnsafe immediately — display only,
    // server-side HMAC of initData is what proves identity for any privileged op.
    const tgUser = tg.initDataUnsafe?.user
    if (tgUser) {
      setTelegramUsername(tgUser.username || null)
      setTgFirstName(tgUser.first_name || null)
      setTgPhotoUrl(tgUser.photo_url || null)
    }

    if (!tg.initData) {
      setAuthStatus('error')
      setAuthError('No Telegram session data — open via the bot.')
      return
    }

    setAuthStatus('authenticating')

    ;(async () => {
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        })
        const data = await res.json()
        if (!res.ok || !data.magicLink) {
          throw new Error(data?.error || 'auth_failed')
        }

        // Verify the magic link to install a Supabase session in cookies.
        const url = new URL(data.magicLink)
        const token = url.searchParams.get('token')
        const type = (url.searchParams.get('type') as 'magiclink') || 'magiclink'
        if (!token) throw new Error('no_token_in_magic_link')

        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: token,
          type,
        })
        if (verifyErr) throw new Error(verifyErr.message)

        setAuthStatus('ready')
      } catch (err) {
        setAuthStatus('error')
        setAuthError(err instanceof Error ? err.message : 'Authentication failed')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 2. Once auth ready: fetch lottery state + auto-grant spins ──────────────

  const refreshState = useCallback(async () => {
    try {
      const [lotteryRes, membershipRes] = await Promise.all([
        fetch('/api/lottery'),
        fetch('/api/telegram/check-membership'),
      ])
      if (lotteryRes.ok) {
        const data = await lotteryRes.json()
        setRemainingSpins(data.remainingSpins || 0)
        setIsInfluencer(!!data.isInfluencer)
        setReferralCode(data.referralCode || null)
        setWalletAddress(data.walletAddress || null)
        setAvailableUsdc(data.availableUsdc || 0)
        setTelegramUsername(data.telegramUsername || null)
        setReferredBy(data.referredBy || null)
        setInvitedCount(data.invitedCount || 0)
        setWelcomeSpinEarned(!!data.welcomeSpinEarned)
        setProgressToNextSpin(data.progressToNextSpin ?? 0)
        setNextMilestone(data.nextMilestone ?? 7)
        setSpinHistory(data.history || [])
      }
      if (membershipRes.ok) {
        const m = await membershipRes.json()
        setGroupConfigured(!!m.configured)
        setIsGroupMember(!!m.isMember)
        setGroupInviteLink(m.inviteLink || null)
      }
    } catch {
      // silent
    }
  }, [])

  // Single grant-evaluation cycle: refresh → check-spins → refresh.
  // Called on initial auth ready AND whenever the page becomes visible
  // again (so a user who went to TG to join the group, then came back,
  // sees their welcome spin granted immediately).
  const runCheckSpins = useCallback(async () => {
    await refreshState()
    try {
      await fetch('/api/lottery/check-spins', { method: 'POST' })
    } catch {
      // silent
    }
    await refreshState()
    setPendingGroupVerify(false)
  }, [refreshState])

  useEffect(() => {
    if (authStatus !== 'ready') return
    runCheckSpins()
  }, [authStatus, runCheckSpins])

  // Re-check on visibility change — covers "user joined TG group then came back"
  useEffect(() => {
    if (authStatus !== 'ready') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runCheckSpins()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [authStatus, runCheckSpins])

  // ── 3. Spin handler ─────────────────────────────────────────────────────────

  const handleSpin = useCallback(async () => {
    if (isSpinning) return
    if (remainingSpins <= 0) return
    setIsSpinning(true)

    try {
      const res = await fetch('/api/lottery/spin', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setIsSpinning(false)
        if (data?.error === 'no_spins') {
          setRemainingSpins(0)
          window.Telegram?.WebApp?.showPopup?.({
            title: 'No spins left',
            message: 'Invite a friend who joins via Telegram to earn another spin.',
            buttons: [{ type: 'ok' }],
          })
        }
        return
      }

      const prizeIndex = PRIZE_CONFIGS.findIndex((p) => p.type === data.prize_type)
      wheelRef.current?.play()
      setTimeout(() => {
        wheelRef.current?.stop(prizeIndex >= 0 ? prizeIndex : 1)
      }, 300)

      // Stash the result for handleEnd to display via TG popup.
      pendingResultRef.current = {
        type: data.prize_type as string,
        amount: Number(data.prize_amount) || 0,
      }
    } catch {
      setIsSpinning(false)
    }
  }, [isSpinning, remainingSpins])

  // Result must be passed from handleSpin → handleEnd via a ref because the
  // wheel's onEnd callback fires asynchronously after stop().
  const pendingResultRef = useRef<{ type: string; amount: number } | null>(null)

  const handleWheelEnd = useCallback(() => {
    setIsSpinning(false)
    setRemainingSpins((prev) => Math.max(0, prev - 1))

    const result = pendingResultRef.current
    pendingResultRef.current = null
    const tg = window.Telegram?.WebApp

    if (!result) return

    const isWin = result.type !== 'thanks'
    const isUsdc = result.type.startsWith('usdc_')

    if (isWin) {
      tg?.HapticFeedback?.notificationOccurred('success')
    } else {
      tg?.HapticFeedback?.notificationOccurred('warning')
    }

    const label = PRIZE_LABELS[result.type] || result.type
    const message = isWin
      ? isUsdc
        ? `${label}\n\n💰 Added to your withdrawable balance.`
        : `${label}\n\n⭐ Added to your unlock progress.`
      : "Better luck next time!"

    tg?.showPopup?.({
      title: isWin ? '🎉 Congratulations' : 'Try again',
      message,
      buttons: [{ type: 'ok' }],
    })

    refreshState()
  }, [refreshState])

  // ── 4. TG MainButton wiring ─────────────────────────────────────────────────

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg || authStatus !== 'ready') return

    const mb = tg.MainButton

    // Hide MainButton while user is in the withdraw form to avoid mis-tap on SPIN.
    if (withdrawFocused) {
      mb.hide()
      return
    }

    const canSpin = remainingSpins > 0 || isInfluencer
    const text = isSpinning
      ? 'SPINNING…'
      : canSpin
      ? `SPIN${isInfluencer ? '' : ` (${remainingSpins} LEFT)`}`
      : 'NO SPINS LEFT'

    mb.setText(text)
    mb.show()
    if (canSpin && !isSpinning) {
      mb.enable()
    } else {
      mb.disable()
    }

    const handler = () => {
      if (!canSpin || isSpinning) return
      handleSpin()
    }
    mb.onClick(handler)

    return () => {
      mb.offClick(handler)
    }
  }, [authStatus, remainingSpins, isInfluencer, isSpinning, handleSpin, withdrawFocused])

  // Hide MainButton on unmount as a safety net (if user navigates away inside the Mini App).
  useEffect(() => {
    return () => {
      window.Telegram?.WebApp?.MainButton?.hide()
    }
  }, [])

  // ── 5. Withdraw ─────────────────────────────────────────────────────────────

  const handleWithdraw = useCallback(async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0 || amount > availableUsdc) return
    setWithdrawStatus('pending')
    setWithdrawError('')
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenType: 'USDC', amount: withdrawAmount }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Special-case the TG group gate so we can render a Join button.
        if (data?.error === 'tg_group_required') {
          setIsGroupMember(false)
          throw new Error('Join the Polnation Telegram group to withdraw.')
        }
        throw new Error(data?.error || 'Withdrawal failed')
      }
      setWithdrawStatus('success')
      setWithdrawAmount('')
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
      window.Telegram?.WebApp?.showPopup?.({
        title: '✅ Withdrawal submitted',
        message: `$${amount.toFixed(2)} USDC is being processed to your wallet.`,
        buttons: [{ type: 'ok' }],
      })
      setTimeout(() => {
        setWithdrawStatus('idle')
        refreshState()
      }, 3000)
    } catch (err) {
      setWithdrawStatus('error')
      setWithdrawError(err instanceof Error ? err.message : 'Withdrawal failed')
    }
  }, [withdrawAmount, availableUsdc, refreshState])

  // Auto-clear withdraw error when user edits the amount
  useEffect(() => {
    if (withdrawError) setWithdrawError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawAmount])

  // ── 6. Share via TG native share sheet ──────────────────────────────────────

  const handleShare = useCallback(() => {
    if (!referralCode) return
    // Bot username and Mini App short name are locked by migration plan decision 1+2.
    const link = `https://t.me/PolnationBot/lottery?startapp=ref_${referralCode}`
    const text = '🎰 Spin the Polnation Lottery and win USDC!'
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`

    const tg = window.Telegram?.WebApp
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl)
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer')
    }
  }, [referralCode])

  // ── 6. Wheel visual config ──────────────────────────────────────────────────

  const prizes = PRIZE_CONFIGS.map((p) => ({
    fonts: [{
      text: PRIZE_LABELS[p.type] || p.type,
      top: '12%',
      fontSize: '11px',
      fontColor: '#fff',
      fontWeight: '600',
    }],
    background: p.color,
  }))

  const blocks = [
    { padding: '10px', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' },
    { padding: '5px', background: '#1e1b4b' },
  ]

  const buttons = [
    {
      radius: '34%',
      background: 'linear-gradient(135deg, #34d399, #00cc06)',
      pointer: true,
      fonts: [{ text: '🎯', top: '-12px', fontSize: '22px' }],
    },
    {
      radius: '28%',
      background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
      fonts: [{ text: isSpinning ? '...' : 'SPIN', top: '-7px', fontSize: '12px', fontColor: '#fff', fontWeight: '700' }],
    },
  ]

  // ── 7. Render ───────────────────────────────────────────────────────────────

  if (authStatus === 'init' || authStatus === 'authenticating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--poly-purple)] border-t-transparent animate-spin" />
        <p className="text-white/60 text-sm">
          {authStatus === 'init' ? 'Starting…' : 'Connecting…'}
        </p>
      </div>
    )
  }

  if (authStatus === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="text-rose-300 font-semibold">Couldn't open the lottery</p>
        <p className="text-white/55 text-sm max-w-xs">{authError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-white/[0.08] border border-white/15 text-white text-sm hover:bg-white/[0.12]"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Auth ready — show wheel
  // Display name preference: @public_handle → first_name → generic.
  // first_name is always present in TG initData, so this fallback covers
  // users who haven't set a public username on Telegram.
  const displayName = telegramUsername
    ? `@${telegramUsername}`
    : tgFirstName || null
  const needsGroupJoin = groupConfigured && !isGroupMember

  // Open a polnation.com URL — prefer TG's openLink (stays in TG webview), fall back to window.open.
  const openWeb = (url: string) => {
    const tg = window.Telegram?.WebApp
    if (tg?.openLink) tg.openLink(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  const exploreLinks = [
    { label: 'Dashboard',        emoji: '📊', path: '/dashboard' },
    { label: 'Earnings',         emoji: '💰', path: '/earnings' },
    { label: 'Agentic Team Earnings', emoji: '🤖', path: '/team' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Sticky brand header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#07060d]/85 border-b border-white/[0.06]">
        <div className="flex items-center justify-between max-w-md mx-auto px-3 h-12">
          <button
            type="button"
            onClick={() => openWeb('https://www.polnation.com')}
            className="flex items-center gap-2 active:scale-[0.98] transition-transform shrink-0"
          >
            <Image src="/logo.svg" alt="Polnation" width={22} height={22} priority />
            <span className="text-white text-[14px] font-semibold tracking-tight poly-heading">
              Polnation
            </span>
          </button>

          {/* User pill — avatar (if available) + display name */}
          {displayName && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.05] border border-white/[0.1] min-w-0 max-w-[140px]">
              {tgPhotoUrl ? (
                <Image
                  src={tgPhotoUrl}
                  alt="avatar"
                  width={18}
                  height={18}
                  className="rounded-full shrink-0"
                  unoptimized
                />
              ) : (
                <span className="w-[18px] h-[18px] rounded-full bg-[var(--poly-purple)] text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {(tgFirstName?.[0] || 'P').toUpperCase()}
                </span>
              )}
              <span className="text-white text-[12px] font-medium truncate">
                {displayName}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => openWeb('https://www.polnation.com/dashboard')}
            className="text-[10px] text-white/65 hover:text-white px-2 py-1.5 border border-white/15 hover:border-[var(--poly-purple)]/60 hover:bg-[var(--poly-purple)]/10 transition-colors shrink-0"
            style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.06em' }}
          >
            WEB ↗
          </button>
        </div>
      </header>

      {/* ── Live Ticker (mock data — replace with real API at scale) ───── */}
      {tickerEvents.length > 0 && (
        <div className="overflow-hidden border-y border-white/[0.06] bg-white/[0.02]">
          <div
            className="flex animate-marquee py-2"
            style={{ width: 'max-content', animationDuration: '60s' }}
          >
            {[...tickerEvents, ...tickerEvents].map((e, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[12px] shrink-0 px-3 whitespace-nowrap"
              >
                <span aria-hidden>{e.type === 'win' ? '🎉' : '✅'}</span>
                <span className="text-white/85 font-medium">@{e.name}</span>
                <span className="text-white/45">
                  {e.type === 'win' ? 'won' : 'cashed out'}
                </span>
                <span style={{ color: 'var(--poly-emerald)', fontFamily: 'var(--poly-font-mono)' }}>
                  ${e.amount.toFixed(2)}
                </span>
                <span className="text-white/30">USDC</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center px-4 py-5 gap-5 max-w-md mx-auto w-full">
        {/* Greeting */}
        <div className="text-center">
          <EyebrowTag>
            {displayName ? `Hi ${displayName} 👋` : 'Polnation Lottery'}
          </EyebrowTag>
          <h1 className="text-[26px] font-semibold text-white mt-1.5 poly-heading">Spin to Win</h1>
          <p className="text-white/50 text-[13px] mt-0.5">
            {isInfluencer ? '∞ Unlimited spins' : `${remainingSpins} spin${remainingSpins === 1 ? '' : 's'} available`}
          </p>
        </div>

        {/* ── Welcome task: join TG group → +1 free spin (one-time, never repeats) ── */}
        {groupConfigured && !welcomeSpinEarned && (
          <BevelCard
            size="lg"
            pad={14}
            className="w-full"
            bg="linear-gradient(135deg, rgba(124,58,237,0.18), rgba(6,182,212,0.08))"
            strokeColor="rgba(168,85,247,0.45)"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <EyebrowTag>Welcome Task</EyebrowTag>
                <p className="text-white text-[15px] font-semibold mt-1 leading-tight">
                  Join our Telegram group
                </p>
                <p className="text-white/55 text-[12px] mt-0.5">
                  Earn 1 free spin — claimable once.
                </p>
              </div>
              <span className="text-2xl shrink-0">🎁</span>
            </div>

            {pendingGroupVerify ? (
              <div className="flex items-center gap-2 p-2.5 bg-white/[0.04] border border-white/[0.10]">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--poly-purple)] border-t-transparent animate-spin shrink-0" />
                <p className="text-white/70 text-[12px]">Verifying membership…</p>
              </div>
            ) : groupInviteLink ? (
              <a
                href={groupInviteLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPendingGroupVerify(true)}
                className="block w-full text-center p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple"
              >
                📢 Join Group → +1 Spin
              </a>
            ) : (
              <p className="text-white/50 text-[12px] text-center p-2">
                Group invite unavailable. Try again later.
              </p>
            )}
          </BevelCard>
        )}

        {/* Wheel */}
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-xl" />
          <div className="relative">
            <LuckyWheel
              ref={wheelRef}
              width="300px"
              height="300px"
              blocks={blocks}
              prizes={prizes}
              buttons={buttons}
              defaultConfig={{
                speed: 20,
                accelerationTime: 2500,
                decelerationTime: 4500,
              }}
              onStart={handleSpin}
              onEnd={handleWheelEnd}
            />
          </div>
        </div>

        {/* ── Withdraw — BevelCard ────────────────────────────────────────── */}
        <BevelCard size="lg" pad={14} className="w-full">
          <div className="flex items-center justify-between mb-3">
            <EyebrowTag>Withdrawable</EyebrowTag>
            <MonoStat value={availableUsdc.toFixed(2)} prefix="$" suffix="USDC" size="tile" />
          </div>

          {/* Group gate */}
          {needsGroupJoin && walletAddress && groupInviteLink && (
            <a
              href={groupInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple mb-2"
            >
              📢 Join Telegram Group to Withdraw
            </a>
          )}

          {/* No wallet — binder */}
          {!walletAddress && (
            showWalletPanel ? (
              <TmaWalletBinder
                onBound={(addr) => {
                  setWalletAddress(addr)
                  setShowWalletPanel(false)
                }}
                onCancel={() => setShowWalletPanel(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowWalletPanel(true)}
                className="w-full p-2.5 bg-white/[0.06] border border-white/[0.12] text-white text-sm hover:bg-white/[0.10] active:scale-[0.99] transition-all"
              >
                🔗 Connect Wallet to Withdraw
              </button>
            )
          )}

          {/* Has wallet — withdraw form */}
          {walletAddress && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/35 font-mono break-all">
                {walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}
              </p>
              {withdrawStatus === 'success' ? (
                <p className="text-center text-sm py-2" style={{ color: 'var(--poly-emerald)' }}>
                  ✅ Withdrawal submitted
                </p>
              ) : (
                <>
                  {withdrawError && (
                    <p className="text-rose-300 text-xs">{withdrawError}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={availableUsdc}
                      step="0.01"
                      placeholder={`Max $${availableUsdc.toFixed(2)}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      onFocus={() => setWithdrawFocused(true)}
                      onBlur={() => setWithdrawFocused(false)}
                      disabled={withdrawStatus === 'pending' || availableUsdc <= 0 || needsGroupJoin}
                      className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/[0.12] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[var(--poly-purple)]/60 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleWithdraw}
                      disabled={
                        withdrawStatus === 'pending' ||
                        availableUsdc <= 0 ||
                        !withdrawAmount ||
                        parseFloat(withdrawAmount) <= 0 ||
                        needsGroupJoin
                      }
                      className="px-4 py-2 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                      style={{ background: 'var(--poly-emerald)' }}
                    >
                      {withdrawStatus === 'pending' ? '…' : 'Withdraw'}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/35">Minimum $0.10 USDC</p>
                </>
              )}
            </div>
          )}
        </BevelCard>

        {/* ── Unlock Progress ──────────────────────────────────────────────── */}
        <BevelCard size="lg" pad={14} className="w-full">
          <div className="flex items-center justify-between mb-2">
            <EyebrowTag>Unlock Progress</EyebrowTag>
            <span
              className="text-[11px] text-white/50"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              {progressToNextSpin} / 7
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(100, (progressToNextSpin / 7) * 100)}%`,
                background: 'var(--poly-purple)',
              }}
            />
          </div>
          <p className="text-[11px] text-white/40 mt-2">
            {`${7 - progressToNextSpin} more airdrop${7 - progressToNextSpin === 1 ? '' : 's'} to unlock next spin — milestone ${nextMilestone}`}
          </p>
        </BevelCard>

        {/* ── Network row ─────────────────────────────────────────────────── */}
        <div className="w-full grid grid-cols-2 gap-2">
          <BevelCard size="sm" pad={12}>
            <EyebrowTag>Invited By</EyebrowTag>
            <p className="text-white text-sm font-medium truncate mt-1">
              {referredBy ? `@${referredBy}` : '—'}
            </p>
          </BevelCard>
          <BevelCard size="sm" pad={12}>
            <EyebrowTag>You Invited</EyebrowTag>
            <p className="text-white text-sm font-medium mt-1"
              style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {invitedCount} {invitedCount === 1 ? 'friend' : 'friends'}
            </p>
          </BevelCard>
        </div>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          disabled={!referralCode}
          className="w-full flex items-center justify-center gap-2 p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple disabled:opacity-40 disabled:pointer-events-none"
        >
          🔗 Invite a Friend → +1 Spin
        </button>

        <p className="text-[11px] text-white/40 text-center">
          Each friend who joins via Telegram earns you 1 spin.
        </p>

        {/* ── Spin History ─────────────────────────────────────────────────── */}
        {spinHistory.length > 0 && (
          <BevelCard size="lg" pad={14} className="w-full">
            <EyebrowTag>Spin History</EyebrowTag>
            <div className="mt-3 space-y-0 max-h-[220px] overflow-y-auto">
              {spinHistory.map((item, i) => {
                const isWin = item.prize_type !== 'thanks'
                const isUsdc = item.prize_type?.startsWith('usdc_')
                const label = item.prize_label || PRIZE_LABELS[item.prize_type] || item.prize_type
                const date = new Date(item.created_at).toLocaleDateString('en', {
                  month: 'short', day: 'numeric',
                })
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between py-2 ${i < spinHistory.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-[13px] font-medium leading-tight ${isWin ? 'text-white' : 'text-white/35'}`}>
                        {label}
                      </p>
                      <p className="text-[11px] text-white/30 mt-0.5">{date}</p>
                    </div>
                    {isUsdc && item.prize_amount != null && (
                      <span
                        className="text-[13px] font-mono shrink-0 ml-3"
                        style={{ color: 'var(--poly-emerald)', fontFamily: 'var(--poly-font-mono)' }}
                      >
                        +${item.prize_amount.toFixed(2)}
                      </span>
                    )}
                    {!isUsdc && isWin && (
                      <span
                        className="text-[12px] shrink-0 ml-3"
                        style={{ color: 'var(--poly-purple)', fontFamily: 'var(--poly-font-mono)' }}
                      >
                        BONUS
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </BevelCard>
        )}

        {/* ── Explore Polnation — traffic funnel back to web ──────────────── */}
        <BevelCard size="lg" pad={14} className="w-full">
          <div className="flex items-center justify-between mb-3">
            <EyebrowTag>Explore Polnation</EyebrowTag>
            <button
              type="button"
              onClick={() => openWeb('https://www.polnation.com')}
              className="text-[10px] text-white/55 hover:text-white"
              style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.08em' }}
            >
              ALL ↗
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {exploreLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => openWeb(`https://www.polnation.com${item.path}`)}
                className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 min-h-[78px] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-[var(--poly-purple)]/40 active:scale-[0.98] transition-all"
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className="text-[10px] text-white/75 text-center leading-tight"
                  style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.06em' }}>
                  {item.label.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/35 mt-3 leading-relaxed">
            Bonus prizes unlock progress on your web account. Daily USDC distributions, hardstake yields, and referral commissions all live on the main site.
          </p>
        </BevelCard>

        {/* Bottom spacer so content isn't hidden behind TG MainButton (~64px) */}
        <div className="h-16" />
      </div>
    </div>
  )
}
