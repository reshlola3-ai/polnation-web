'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { LuckyWheel } from '@lucky-canvas/react'
import { createClient } from '@/lib/supabase'
import { TmaWalletBinder } from '@/components/wallet/TmaWalletBinder'

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

interface TgWebApp {
  initData: string
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
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [invitedCount, setInvitedCount] = useState(0)

  // ── TG group membership state ───────────────────────────────────────────────
  const [groupConfigured, setGroupConfigured] = useState(false)
  const [isGroupMember, setIsGroupMember] = useState(false)
  const [groupInviteLink, setGroupInviteLink] = useState<string | null>(null)
  const [withdrawFocused, setWithdrawFocused] = useState(false)

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

  useEffect(() => {
    if (authStatus !== 'ready') return
    // Initial state fetch + check for new spin grants triggered by referral activity
    ;(async () => {
      await refreshState()
      try {
        await fetch('/api/lottery/check-spins', { method: 'POST' })
      } catch {
        // silent
      }
      await refreshState()
    })()
  }, [authStatus, refreshState])

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
      background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
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
  const greeting = telegramUsername ? `@${telegramUsername}` : 'Polnation · Lottery'
  const needsGroupJoin = groupConfigured && !isGroupMember

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 gap-5">
      {/* Header strip */}
      <div className="text-center">
        <p
          className="text-[11px] uppercase mb-1"
          style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.15em', color: 'var(--poly-grey-200)' }}
        >
          {greeting}
        </p>
        <h1 className="text-[22px] font-semibold text-white">Spin to Win</h1>
        <p className="text-white/50 text-[13px] mt-1">
          {isInfluencer ? '∞ Unlimited spins' : `${remainingSpins} spin${remainingSpins === 1 ? '' : 's'} available`}
        </p>
      </div>

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

      {/* ── Withdraw section (right under wheel — won USDC → see balance immediately) ── */}
      <div className="w-full max-w-sm">
        <div className="p-3 bg-white/[0.03] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-widest text-white/40"
              style={{ fontFamily: 'var(--poly-font-mono)' }}>
              Withdrawable
            </p>
            <p className="text-white font-semibold text-sm"
              style={{ fontFamily: 'var(--poly-font-mono)' }}>
              ${availableUsdc.toFixed(2)} USDC
            </p>
          </div>

          {/* Group gate — must join before any withdraw action is possible */}
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

          {/* No wallet — show binder */}
          {!walletAddress && (
            <>
              {showWalletPanel ? (
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
              )}
            </>
          )}

          {/* Has wallet — show withdraw form (gated by group membership) */}
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
        </div>
      </div>

      {/* Reward info */}
      <div className="w-full max-w-sm flex gap-2">
        <div className="flex-1 flex items-center gap-2 p-2.5 bg-white/[0.04] border border-[var(--poly-emerald)]/20">
          <span className="text-base">💰</span>
          <p className="text-[11px] leading-tight" style={{ color: 'var(--poly-emerald)' }}>
            USDC → withdrawable
          </p>
        </div>
        <a
          href="https://www.polnation.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center gap-2 p-2.5 bg-white/[0.04] border border-[var(--poly-purple)]/20 hover:bg-white/[0.06] transition-colors"
        >
          <span className="text-base">⭐</span>
          <p className="text-[11px] leading-tight text-[var(--poly-purple)]">
            Bonus → view on web ↗
          </p>
        </a>
      </div>

      {/* ── Network: invited by + invite count ──────────────────────────────── */}
      <div className="w-full max-w-sm flex gap-2">
        <div className="flex-1 p-2.5 bg-white/[0.03] border border-white/[0.08]">
          <p className="text-[10px] uppercase tracking-widest text-white/35 mb-0.5"
            style={{ fontFamily: 'var(--poly-font-mono)' }}>
            Invited by
          </p>
          <p className="text-white text-sm font-medium truncate">
            {referredBy ? `@${referredBy}` : '—'}
          </p>
        </div>
        <div className="flex-1 p-2.5 bg-white/[0.03] border border-white/[0.08]">
          <p className="text-[10px] uppercase tracking-widest text-white/35 mb-0.5"
            style={{ fontFamily: 'var(--poly-font-mono)' }}>
            You invited
          </p>
          <p className="text-white text-sm font-medium"
            style={{ fontFamily: 'var(--poly-font-mono)' }}>
            {invitedCount} {invitedCount === 1 ? 'friend' : 'friends'}
          </p>
        </div>
      </div>

      {/* Share — earn extra spins by inviting */}
      <button
        type="button"
        onClick={handleShare}
        disabled={!referralCode}
        className="w-full max-w-sm flex items-center justify-center gap-2 p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple disabled:opacity-40 disabled:pointer-events-none"
      >
        🔗 Invite a Friend → +1 Spin
      </button>

      <p className="text-[11px] text-white/40 text-center max-w-xs">
        Each friend you invite who joins via Telegram earns you 1 spin.
      </p>

      {/* Bottom spacer so content isn't hidden behind TG MainButton (~64px) */}
      <div className="h-16" />
    </div>
  )
}
