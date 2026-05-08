'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { BevelCard } from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat } from '@/components/ui/poly/MonoStat'
import {
  type Locale,
  LOCALE_META,
  LOCALES,
  TRANSLATIONS,
  detectLocale,
  saveLocale,
} from './i18n'

// ── Telegram WebApp typings (minimal — only what we use) ─────────────────────

const TmaWalletPanel = dynamic(
  () => import('@/components/wallet/TmaWalletPanel').then((m) => m.TmaWalletPanel),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--poly-purple)] border-t-transparent animate-spin" />
        <p className="text-white/55 text-sm">Loading wallet...</p>
      </div>
    ),
  }
)

function WheelFallback() {
  return (
    <div className="relative w-[300px] h-[300px] rounded-full overflow-hidden border-[10px] border-[#1e1b4b] shadow-cta-purple bg-[#0d0d14]">
      <div
        className="absolute inset-0"
        style={{
          background:
            'conic-gradient(#7c3aed 0 30deg,#1e1b4b 30deg 60deg,#059669 60deg 90deg,#1e1b4b 90deg 120deg,#7c3aed 120deg 150deg,#1e1b4b 150deg 180deg,#0891b2 180deg 210deg,#1e1b4b 210deg 240deg,#7c3aed 240deg 270deg,#1e1b4b 270deg 300deg,#d97706 300deg 330deg,#1e1b4b 330deg 360deg)',
        }}
      />
      <div className="absolute inset-[37%] rounded-full bg-[#0d0d14] border border-white/10 flex items-center justify-center">
        <span
          className="text-white text-[11px] font-semibold"
          style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.08em' }}
        >
          SPIN
        </span>
      </div>
      <div className="absolute left-1/2 top-[17px] -translate-x-1/2 text-[#22c55e] text-[16px] leading-none">
        ▼
      </div>
    </div>
  )
}

const LotteryWheelClient = dynamic(() => import('./LotteryWheelClient'), {
  ssr: false,
  loading: () => <WheelFallback />,
})

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
type Invitee = {
  id: string
  name: string
  photoUrl: string | null
  joinedAt: string | null
}

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

// sessionStorage cache for /api/lottery payload — keyed on the TG user id so
// re-launches inside the same mini-app session render instantly off cache
// while a background refresh fetches fresh data. The 30-second TTL bounds
// staleness; data only ever lives for the duration of one Telegram session.
const LOTTERY_CACHE_PREFIX = 'lotteryMini_v1_'
const LOTTERY_CACHE_TTL_MS = 30 * 1000

interface CachedLottery {
  remainingSpins: number
  isInfluencer: boolean
  referralCode: string | null
  walletAddress: string | null
  availableUsdc: number
  telegramUsername: string | null
  referredBy: string | null
  invitedCount: number
  invitees: Invitee[]
  welcomeSpinEarned: boolean
  spinHistory: SpinHistoryEntry[]
  hasRealEmail: boolean
}

interface SpinHistoryEntry {
  id: string
  prize_type: string
  prize_label: string | null
  prize_amount: number | null
  reward_credited: boolean
  created_at: string
}

function readLotteryCache(tgUserId: number | string | undefined): CachedLottery | null {
  if (!tgUserId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(LOTTERY_CACHE_PREFIX + tgUserId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: CachedLottery; timestamp: number }
    if (Date.now() - parsed.timestamp > LOTTERY_CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeLotteryCache(tgUserId: number | string | undefined, data: CachedLottery) {
  if (!tgUserId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      LOTTERY_CACHE_PREFIX + tgUserId,
      JSON.stringify({ data, timestamp: Date.now() }),
    )
  } catch {
    // sessionStorage quota exceeded — non-fatal
  }
}

export default function LotteryMiniPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('init')
  // Gate for "session cookie is actually valid". Decoupled from authStatus
  // because cache hits flip authStatus → 'ready' optimistically before the
  // session is verified, and runCheckSpins / lottery fetches must wait for
  // the real session to avoid silent 401s.
  const [sessionEstablished, setSessionEstablished] = useState(false)
  const [authError, setAuthError] = useState('')
  // Known error types rendered via translation; authError holds unexpected API messages.
  const [authErrorType, setAuthErrorType] = useState<'no_telegram' | 'no_session' | null>(null)
  // Onboarding prep animation: 0 = not shown (returning user fast path),
  // 1-3 = current animated step. Only set when we know the user is going down
  // the slow auth path so returning users skip the animation entirely.
  const [prepStep, setPrepStep] = useState<0 | 1 | 2 | 3>(0)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [remainingSpins, setRemainingSpins] = useState(0)
  const [isInfluencer, setIsInfluencer] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const wheelCommandNonceRef = useRef(0)
  const [wheelSpinNonce, setWheelSpinNonce] = useState(0)
  const [wheelStopCommand, setWheelStopCommand] = useState<{ nonce: number; index: number } | null>(null)

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
  const [invitees, setInvitees] = useState<Invitee[]>([])

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

  // ── Rules modal ─────────────────────────────────────────────────────────────
  const [showRules, setShowRules] = useState(false)

  // ── Web login binding (email + password for cross-device access) ────────────
  const [hasRealEmail, setHasRealEmail] = useState(false)
  const [showWebLoginPanel, setShowWebLoginPanel] = useState(false)
  const [webLoginEmail, setWebLoginEmail] = useState('')
  const [webLoginPassword, setWebLoginPassword] = useState('')
  const [webLoginStatus, setWebLoginStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [webLoginError, setWebLoginError] = useState('')
  const [webLoginFocused, setWebLoginFocused] = useState(false)

  // ── i18n ─────────────────────────────────────────────────────────────────
  const [locale, setLocaleState] = useState<Locale>('en')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const t = TRANSLATIONS[locale]

  const switchLocale = useCallback((l: Locale) => {
    saveLocale(l)
    setLocaleState(l)
    setShowLangPicker(false)
  }, [])

  // ── Team pool unlock progress ───────────────────────────────────────────────
  // Bonus prizes credit `user_task_progress.total_task_bonus`, which combines
  // with team L1-3 volume into `effectiveVolume` — gating community pool claim.
  const [teamPoolEffective, setTeamPoolEffective] = useState(0)
  const [teamPoolTarget, setTeamPoolTarget] = useState(0)
  const [teamPoolLevel, setTeamPoolLevel] = useState(1)
  const [teamPoolRewardPool, setTeamPoolRewardPool] = useState(0)

  // ── Spin history ────────────────────────────────────────────────────────────
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
    document.getElementById('lottery-mini-boot')?.remove()

    const tg = window.Telegram?.WebApp
    if (!tg) {
      setAuthStatus('error')
      setAuthErrorType('no_telegram')
      return
    }
    tg.ready()
    tg.expand()

    // Populate identity from initDataUnsafe immediately — display only,
    // server-side HMAC of initData is what proves identity for any privileged op.
    const tgUser = tg.initDataUnsafe?.user
    let hasCacheHit = false
    if (tgUser) {
      setTelegramUsername(tgUser.username || null)
      setTgFirstName(tgUser.first_name || null)
      setTgPhotoUrl(tgUser.photo_url || null)
      setLocaleState(detectLocale(tgUser.language_code))
      tgUserIdRef.current = tgUser.id

      // Hydrate from sessionStorage so the wheel renders synchronously off
      // last-known data instead of behind a spinner. The auth flow still
      // runs in the background — once it completes, refreshState() overwrites
      // these values with fresh ones (and the cache).
      const cached = readLotteryCache(tgUser.id)
      if (cached) {
        hasCacheHit = true
        setRemainingSpins(cached.remainingSpins)
        setIsInfluencer(cached.isInfluencer)
        setReferralCode(cached.referralCode)
        setWalletAddress(cached.walletAddress)
        setAvailableUsdc(cached.availableUsdc)
        setTelegramUsername(cached.telegramUsername || tgUser.username || null)
        setReferredBy(cached.referredBy)
        setInvitedCount(cached.invitedCount)
        setInvitees(cached.invitees)
        setWelcomeSpinEarned(cached.welcomeSpinEarned)
        setSpinHistory(cached.spinHistory)
        setHasRealEmail(cached.hasRealEmail)
      }
    } else {
      setLocaleState(detectLocale())
    }

    if (!tg.initData) {
      setAuthStatus('error')
      setAuthErrorType('no_session')
      return
    }

    // Cache hit → optimistically render the main UI immediately. The auth
    // flow below still runs; if the session is actually invalid, refreshState
    // will silently fail but the user already sees usable (stale) data.
    if (hasCacheHit) {
      setAuthStatus('ready')
    } else {
      setAuthStatus('authenticating')
    }

    ;(async () => {
      try {
        // Authenticate via the server route. Avoid importing Supabase's browser
        // client in the Mini App's first JS chunk just for getSession().
        // Cache-hit users already see the UI while this settles in the background.
        // Slow path: show onboarding only while auth is genuinely pending.
        // Skip the cosmetic stage timers when we have cache — the user is
        // already looking at the wheel, not at a spinner.
        const authPromise = (async () => {
          const res = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData }),
          })
          const data = await res.json()
          if (!res.ok || !data.success) {
            throw new Error(data?.error || 'auth_failed')
          }
        })()

        let step2Timer: number | undefined
        let step3Timer: number | undefined
        if (!hasCacheHit) {
          setPrepStep(1)
          step2Timer = window.setTimeout(() => setPrepStep(2), 450)
          step3Timer = window.setTimeout(() => setPrepStep(3), 900)
        }
        await authPromise
        if (step2Timer) window.clearTimeout(step2Timer)
        if (step3Timer) window.clearTimeout(step3Timer)

        if (!hasCacheHit) setAuthStatus('ready')
        setSessionEstablished(true)
      } catch (err) {
        if (!hasCacheHit) {
          setAuthStatus('error')
          setAuthError(err instanceof Error ? err.message : 'Authentication failed')
        }
        // If we already showed UI from cache, swallow — the user keeps a
        // working (stale) view rather than seeing an error screen.
      }
    })()
  }, [])

  // ── 2. Once auth ready: fetch lottery state + auto-grant spins ──────────────
  //
  // Critical-path = /api/lottery (drives the wheel + spin count + balance).
  // /api/telegram/check-membership and /api/community/status are decorative
  // (group-join button, team progress bar) and notoriously slow — the former
  // crosses the network to api.telegram.org, the latter does Polygon multicall
  // RPC for L1-3 referral wallets. They're fire-and-forget so the UI doesn't
  // block on them.

  const tgUserIdRef = useRef<number | string | undefined>(undefined)

  const refreshState = useCallback(async () => {
    // Fire decorative fetches without awaiting.
    fetch('/api/telegram/check-membership')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!m) return
        setGroupConfigured(!!m.configured)
        setIsGroupMember(!!m.isMember)
        setGroupInviteLink(m.inviteLink || null)
      })
      .catch(() => { /* silent */ })

    fetch('/api/community/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!c) return
        setTeamPoolEffective(Number(c.effectiveVolume) || 0)
        setTeamPoolTarget(Number(c.nextUnlockVolume) || 0)
        setTeamPoolLevel(c.status?.current_level || c.currentLevelInfo?.level || 1)
        setTeamPoolRewardPool(Number(c.currentLevelInfo?.reward_pool) || 0)
      })
      .catch(() => { /* silent */ })

    // Critical path — wait for lottery only.
    try {
      const lotteryRes = await fetch('/api/lottery')
      if (!lotteryRes.ok) return
      const data = await lotteryRes.json()
      const lottery: CachedLottery = {
        remainingSpins: data.remainingSpins || 0,
        isInfluencer: !!data.isInfluencer,
        referralCode: data.referralCode || null,
        walletAddress: data.walletAddress || null,
        availableUsdc: data.availableUsdc || 0,
        telegramUsername: data.telegramUsername || null,
        referredBy: data.referredBy || null,
        invitedCount: data.invitedCount || 0,
        invitees: Array.isArray(data.invitees) ? data.invitees : [],
        welcomeSpinEarned: !!data.welcomeSpinEarned,
        spinHistory: Array.isArray(data.history) ? data.history : [],
        hasRealEmail: !!data.hasRealEmail,
      }
      setRemainingSpins(lottery.remainingSpins)
      setIsInfluencer(lottery.isInfluencer)
      setReferralCode(lottery.referralCode)
      setWalletAddress(lottery.walletAddress)
      setAvailableUsdc(lottery.availableUsdc)
      setTelegramUsername(lottery.telegramUsername)
      setReferredBy(lottery.referredBy)
      setInvitedCount(lottery.invitedCount)
      setInvitees(lottery.invitees)
      setWelcomeSpinEarned(lottery.welcomeSpinEarned)
      setSpinHistory(lottery.spinHistory)
      setHasRealEmail(lottery.hasRealEmail)
      writeLotteryCache(tgUserIdRef.current, lottery)
    } catch {
      // silent
    }
  }, [])

  // Grant-evaluation cycle: show UI immediately after first refreshState,
  // then run check-spins in the background and silently re-sync.
  // "visible" re-checks (TG group join flow) still await the full cycle so
  // the pending spinner resolves correctly.
  const runCheckSpins = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      // Foreground: user returned from group join — await full cycle so the
      // "Verifying…" spinner resolves promptly.
      await refreshState()
      try {
        await fetch('/api/lottery/check-spins', { method: 'POST' })
      } catch { /* silent */ }
      await refreshState()
      setPendingGroupVerify(false)
    } else {
      // Background: initial page load — show UI first, then grant silently.
      await refreshState()           // UI now visible with current spin count
      fetch('/api/lottery/check-spins', { method: 'POST' })
        .then(() => refreshState())  // silent re-sync after grants settle
        .catch(() => {})
        .finally(() => setPendingGroupVerify(false))
    }
  }, [refreshState])

  useEffect(() => {
    // Wait for both: ready (UI rendered) AND session (cookie verified). For
    // cache-hit users authStatus flips ready before sessionEstablished, so
    // gating on both avoids 401-flooding from a too-early refresh.
    if (authStatus !== 'ready' || !sessionEstablished) return
    runCheckSpins({ background: true })
  }, [authStatus, sessionEstablished, runCheckSpins])

  // Re-check on visibility change — covers "user joined TG group then came back"
  useEffect(() => {
    if (authStatus !== 'ready' || !sessionEstablished) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runCheckSpins()  // foreground: awaits full cycle for pending spinner
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [authStatus, sessionEstablished, runCheckSpins])

  // ── 3. Spin handler ─────────────────────────────────────────────────────────

  const handleSpin = useCallback(async () => {
    if (!sessionEstablished) return
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
            title: t.noSpinsTitle,
            message: t.noSpinsMsg,
            buttons: [{ type: 'ok' }],
          })
        }
        return
      }

      const prizeIndex = PRIZE_CONFIGS.findIndex((p) => p.type === data.prize_type)
      const commandNonce = wheelCommandNonceRef.current + 1
      wheelCommandNonceRef.current = commandNonce
      setWheelSpinNonce(commandNonce)
      window.setTimeout(() => {
        setWheelStopCommand({
          nonce: commandNonce,
          index: prizeIndex >= 0 ? prizeIndex : 1,
        })
      }, 300)

      // Stash the result for handleEnd to display via TG popup.
      pendingResultRef.current = {
        type: data.prize_type as string,
        amount: Number(data.prize_amount) || 0,
      }
    } catch {
      setIsSpinning(false)
    }
  }, [sessionEstablished, isSpinning, remainingSpins, t])

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
        ? t.usdcAdded(label)
        : t.bonusAdded(label)
      : t.betterLuck

    tg?.showPopup?.({
      title: isWin ? t.congratsTitle : t.tryAgainTitle,
      message,
      buttons: [{ type: 'ok' }],
    })

    refreshState()
  }, [refreshState, t])

  // ── 4. TG MainButton wiring ─────────────────────────────────────────────────

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg || authStatus !== 'ready') return

    const mb = tg.MainButton

    // Hide MainButton while user is in the withdraw form, reading the rules
    // modal, or filling out the web-login form — avoids mis-tap on SPIN.
    if (withdrawFocused || showRules || showWebLoginPanel || webLoginFocused) {
      mb.hide()
      return
    }

    const canSpin = sessionEstablished && (remainingSpins > 0 || isInfluencer)
    const text = !sessionEstablished
      ? t.connecting
      : isSpinning
      ? t.spinning
      : !canSpin
      ? t.noSpinsLeft
      : isInfluencer
      ? t.spinBtnUnlimited
      : t.spinBtn(remainingSpins)

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
  }, [authStatus, sessionEstablished, remainingSpins, isInfluencer, isSpinning, handleSpin, withdrawFocused, showRules, showWebLoginPanel, webLoginFocused, t])

  // Hide MainButton on unmount as a safety net (if user navigates away inside the Mini App).
  useEffect(() => {
    return () => {
      window.Telegram?.WebApp?.MainButton?.hide()
    }
  }, [])

  // ── 5. Withdraw ─────────────────────────────────────────────────────────────

  const handleWithdraw = useCallback(async () => {
    if (!sessionEstablished) return
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
          throw new Error(t.tgGroupRequired)
        }
        throw new Error(data?.error || 'Withdrawal failed')
      }
      setWithdrawStatus('success')
      setWithdrawAmount('')
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
      window.Telegram?.WebApp?.showPopup?.({
        title: t.withdrawSuccessTitle,
        message: t.withdrawSuccessMsg(amount.toFixed(2)),
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
  }, [sessionEstablished, withdrawAmount, availableUsdc, refreshState, t])

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
    const text = t.shareText
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`

    const tg = window.Telegram?.WebApp
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl)
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer')
    }
  }, [referralCode, t])

  // ── Web login binding handler ───────────────────────────────────────────────
  const handleWebLoginSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setWebLoginError('')
    if (!webLoginEmail.trim()) return
    if (webLoginPassword.length < 6) {
      setWebLoginError(t.webLoginPasswordTooShort)
      return
    }
    setWebLoginStatus('submitting')
    try {
      const res = await fetch('/api/auth/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: webLoginEmail.trim(),
          password: webLoginPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Backend errors come back in English (status codes / DB messages); keep
        // them as-is for ops debuggability, fall back to the localized generic.
        setWebLoginError(data.error || t.webLoginGenericError)
        setWebLoginStatus('idle')
        return
      }
      setWebLoginStatus('success')
      setWebLoginPassword('') // don't keep plaintext in React state
      // Refresh to flip hasRealEmail; the card will hide on next render.
      void refreshState()
    } catch {
      setWebLoginError(t.webLoginNetworkError)
      setWebLoginStatus('idle')
    }
  }, [webLoginEmail, webLoginPassword, refreshState, t])

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
      background: '#22c55e',
      pointer: true,
      fonts: [{ text: '▼', top: '-14px', fontSize: '13px', fontColor: '#22c55e', fontWeight: '700' }],
    },
    {
      radius: '26%',
      background: '#0d0d14',
      fonts: [{ text: isSpinning ? '···' : 'SPIN', top: '-7px', fontSize: '11px', fontColor: '#ffffff', fontWeight: '700' }],
    },
  ]

  // ── 7. Render ───────────────────────────────────────────────────────────────

  if (authStatus === 'init' || authStatus === 'authenticating') {
    // New-user slow path: show the staged onboarding animation.
    if (prepStep > 0) {
      const stepIcon = prepStep === 1 ? '🔐' : prepStep === 2 ? '✨' : '🎰'
      const stepTitle =
        prepStep === 1 ? t.prepStep1Title :
        prepStep === 2 ? t.prepStep2Title :
        t.prepStep3Title
      const stepSub =
        prepStep === 1 ? t.prepStep1Sub :
        prepStep === 2 ? t.prepStep2Sub :
        t.prepStep3Sub

      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
          {/* Soft radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 40%, rgba(124,58,237,0.18), transparent 60%)',
            }}
          />

          {/* Brand mark */}
          <div className="relative flex items-center gap-2 mb-12">
            <Image src="/logo.svg" alt="Polnation" width={28} height={28} priority />
            <span
              className="text-white text-[16px] font-semibold tracking-tight poly-heading"
            >
              Polnation
            </span>
          </div>

          {/* Animated icon — pulsing ring + emoji */}
          <div className="relative mb-7">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-[32px] shadow-cta-purple"
              style={{
                background:
                  'linear-gradient(135deg, var(--poly-purple), var(--poly-emerald))',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              <span aria-hidden>{stepIcon}</span>
            </div>
            <div
              className="absolute inset-0 rounded-full border-2 pointer-events-none"
              style={{
                borderColor: 'var(--poly-purple)',
                opacity: 0.4,
                animation: 'ping 1.6s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
          </div>

          {/* Step text */}
          <h2 className="text-white text-[19px] font-semibold poly-heading mb-1.5">
            {stepTitle}
          </h2>
          <p className="text-white/55 text-[13px]">{stepSub}</p>

          {/* Step dots */}
          <div className="flex items-center gap-2 mt-10">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className="rounded-full transition-all duration-500"
                style={{
                  width: s === prepStep ? 22 : 6,
                  height: 6,
                  background:
                    s < prepStep
                      ? 'var(--poly-emerald)'
                      : s === prepStep
                      ? 'var(--poly-purple)'
                      : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>
        </div>
      )
    }

    // Returning-user fast path: minimal spinner (auth resolves in <100ms).
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--poly-purple)] border-t-transparent animate-spin" />
        <p className="text-white/60 text-sm">
          {authStatus === 'init' ? t.startingUp : t.connecting}
        </p>
      </div>
    )
  }

  if (authStatus === 'error') {
    const authErrorMsg = authErrorType === 'no_telegram' ? t.openInTelegram
      : authErrorType === 'no_session' ? t.noSession
      : authError
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="text-rose-300 font-semibold">{t.cantOpenLottery}</p>
        <p className="text-white/55 text-sm max-w-xs">{authErrorMsg}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-white/[0.08] border border-white/15 text-white text-sm hover:bg-white/[0.12]"
        >
          {t.tryAgainBtn}
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
    { label: t.dashboard,    emoji: '📊', path: '/dashboard' },
    { label: t.earnings,     emoji: '💰', path: '/earnings' },
    { label: t.agenticTeam,  emoji: '🤖', path: '/team' },
  ]

  const formatInviteDate = (value: string | null) => {
    if (!value) return ''
    return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

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

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Language switcher — flag + code so it reads as a button */}
            <button
              type="button"
              onClick={() => setShowLangPicker(true)}
              className="flex items-center gap-1 text-white/65 hover:text-white px-2 py-1.5 border border-white/15 hover:border-[var(--poly-purple)]/60 hover:bg-[var(--poly-purple)]/10 transition-colors"
              aria-label={t.language}
            >
              <span className="text-[13px] leading-none">{LOCALE_META[locale].flag}</span>
              <span
                className="text-[10px]"
                style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.06em' }}
              >
                {locale.toUpperCase()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openWeb('https://www.polnation.com/dashboard')}
              className="text-[10px] text-white/65 hover:text-white px-2 py-1.5 border border-white/15 hover:border-[var(--poly-purple)]/60 hover:bg-[var(--poly-purple)]/10 transition-colors"
              style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.06em' }}
            >
              {t.webLink}
            </button>
          </div>
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
        <div className="text-center w-full">
          <EyebrowTag>
            {displayName ? t.greeting(displayName) : t.lotteryTitle}
          </EyebrowTag>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <h1 className="text-[26px] font-semibold text-white poly-heading">{t.spinToWin}</h1>
            <button
              type="button"
              onClick={() => setShowRules(true)}
              aria-label={t.howItWorks}
              className="w-[17px] h-[17px] rounded-full border border-white/25 text-white/40 text-[9px] font-semibold flex items-center justify-center hover:border-[var(--poly-purple)]/70 hover:text-[var(--poly-purple)] active:scale-[0.90] transition-all mb-0.5 shrink-0"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              ?
            </button>
          </div>
          <p className="text-white/50 text-[13px] mt-0.5">
            {isInfluencer ? t.unlimitedSpins : t.spinsAvailable(remainingSpins)}
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
                <EyebrowTag>{t.welcomeTask}</EyebrowTag>
                <p className="text-white text-[15px] font-semibold mt-1 leading-tight">
                  {t.joinTelegramGroup}
                </p>
                <p className="text-white/55 text-[12px] mt-0.5">
                  {t.earnFreeSpin}
                </p>
              </div>
              <span className="text-2xl shrink-0">🎁</span>
            </div>

            {pendingGroupVerify ? (
              <div className="flex items-center gap-2 p-2.5 bg-white/[0.04] border border-white/[0.10]">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--poly-purple)] border-t-transparent animate-spin shrink-0" />
                <p className="text-white/70 text-[12px]">{t.verifyingMembership}</p>
              </div>
            ) : groupInviteLink ? (
              <a
                href={groupInviteLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPendingGroupVerify(true)}
                className="block w-full text-center p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple"
              >
                {t.joinGroupBtn}
              </a>
            ) : (
              <p className="text-white/50 text-[12px] text-center p-2">
                {t.inviteUnavailable}
              </p>
            )}
          </BevelCard>
        )}

        {/* Wheel */}
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-xl" />
          <div className="relative">
            <LotteryWheelClient
              width="300px"
              height="300px"
              blocks={blocks}
              prizes={prizes}
              buttons={buttons}
              spinNonce={wheelSpinNonce}
              stopCommand={wheelStopCommand}
              onStart={handleSpin}
              onEnd={handleWheelEnd}
            />
          </div>
        </div>

        {/* ── Withdraw — BevelCard ────────────────────────────────────────── */}
        <BevelCard size="lg" pad={14} className="w-full">
          <div className="flex items-center justify-between mb-3">
            <EyebrowTag>{t.withdrawable}</EyebrowTag>
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
              {t.joinToWithdraw}
            </a>
          )}

          {/* No wallet — binder */}
          {!walletAddress && (
            showWalletPanel ? (
              <TmaWalletPanel
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
                disabled={!sessionEstablished}
                className="w-full p-2.5 bg-white/[0.06] border border-white/[0.12] text-white text-sm hover:bg-white/[0.10] active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {t.connectWallet}
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
                  {t.withdrawSubmitted}
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
                      placeholder={t.maxPlaceholder(availableUsdc.toFixed(2))}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      onFocus={() => setWithdrawFocused(true)}
                      onBlur={() => setWithdrawFocused(false)}
                      disabled={withdrawStatus === 'pending' || availableUsdc <= 0 || needsGroupJoin || !sessionEstablished}
                      className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/[0.12] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[var(--poly-purple)]/60 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleWithdraw}
                      disabled={
                        withdrawStatus === 'pending' ||
                        availableUsdc <= 0 ||
                        !sessionEstablished ||
                        !withdrawAmount ||
                        parseFloat(withdrawAmount) <= 0 ||
                        needsGroupJoin
                      }
                      className="px-4 py-2 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                      style={{ background: 'var(--poly-emerald)' }}
                    >
                      {withdrawStatus === 'pending' ? t.withdrawPending : t.withdraw}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/35">{t.minWithdraw}</p>
                </>
              )}
            </div>
          )}
        </BevelCard>

        {/* ── Team Pool Progress ───────────────────────────────────────────── */}
        <BevelCard size="lg" pad={14} className="w-full">
          <div className="flex items-center justify-between mb-2">
            <EyebrowTag>{t.teamPool(teamPoolLevel)}</EyebrowTag>
            <span
              className="text-[11px] text-white/55"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              ${teamPoolEffective.toFixed(2)} / ${teamPoolTarget.toFixed(0)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${teamPoolTarget > 0 ? Math.min(100, (teamPoolEffective / teamPoolTarget) * 100) : 0}%`,
                background: 'var(--poly-purple)',
              }}
            />
          </div>
          <p className="text-[11px] text-white/45 mt-2">
            {teamPoolTarget > 0 && teamPoolEffective >= teamPoolTarget
              ? t.teamPoolUnlocked(teamPoolLevel)
              : teamPoolTarget > 0
                ? t.teamPoolProgress((teamPoolTarget - teamPoolEffective).toFixed(2), teamPoolRewardPool.toString())
                : t.teamPoolEmpty}
          </p>
          <button
            type="button"
            onClick={() => openWeb('https://www.polnation.com/team')}
            className="mt-3 w-full text-center py-2 bg-white/[0.06] border border-white/[0.12] text-white/85 text-[12px] hover:bg-white/[0.10] active:scale-[0.99] transition-all"
            style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.06em' }}
          >
            {t.viewTeamProgress}
          </button>
        </BevelCard>

        {/* ── Network row ─────────────────────────────────────────────────── */}
        <div className="w-full grid grid-cols-2 gap-2">
          <BevelCard size="sm" pad={12}>
            <EyebrowTag>{t.invitedBy}</EyebrowTag>
            <p className="text-white text-sm font-medium truncate mt-1">
              {referredBy ? `@${referredBy}` : '—'}
            </p>
          </BevelCard>
          <BevelCard size="sm" pad={12}>
            <EyebrowTag>{t.youInvited}</EyebrowTag>
            <p className="text-white text-sm font-medium mt-1"
              style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {t.friends(invitedCount)}
            </p>
          </BevelCard>
        </div>

        <BevelCard size="lg" pad={14} className="w-full">
          <div className="flex items-center justify-between gap-3">
            <EyebrowTag>{t.youInvited}</EyebrowTag>
            <span
              className="text-white/50 text-[11px]"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              {t.friends(invitedCount)}
            </span>
          </div>
          {invitees.length > 0 ? (
            <div className="mt-3 divide-y divide-white/[0.06]">
              {invitees.map((invitee) => (
                <div key={invitee.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 shrink-0 bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                    {invitee.photoUrl ? (
                      <Image
                        src={invitee.photoUrl}
                        alt={invitee.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-white/65 text-xs font-semibold">
                        {invitee.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium truncate">
                      {invitee.name.startsWith('@') ? invitee.name : `@${invitee.name}`}
                    </p>
                  </div>
                  <span className="text-white/35 text-[11px] shrink-0">
                    {formatInviteDate(invitee.joinedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-[12px] mt-3">
              {t.inviteHint}
            </p>
          )}
        </BevelCard>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          disabled={!referralCode}
          className="w-full flex items-center justify-center gap-2 p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple disabled:opacity-40 disabled:pointer-events-none"
        >
          {t.inviteBtn}
        </button>

        <p className="text-[11px] text-white/40 text-center">
          {t.inviteHint}
        </p>

        {/* ── Web Access — let TG users bind email+password for cross-device login ── */}
        {!hasRealEmail && (
          <BevelCard size="lg" pad={14} className="w-full">
            <EyebrowTag>{t.webAccessTitle}</EyebrowTag>
            <p className="text-white/75 text-[12px] mt-1.5 leading-relaxed">
              {t.webAccessDesc}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowWebLoginPanel(true)
                setWebLoginError('')
                setWebLoginStatus('idle')
              }}
              disabled={!sessionEstablished}
              className="mt-3 w-full p-2.5 bg-white/[0.06] border border-white/[0.10] text-white/85 text-[12px] hover:bg-white/[0.10] active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none"
              style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.08em' }}
            >
              {t.webAccessBtn}
            </button>
          </BevelCard>
        )}

        {/* ── Spin History ─────────────────────────────────────────────────── */}
        {spinHistory.length > 0 && (
          <BevelCard size="lg" pad={14} className="w-full">
            <EyebrowTag>{t.spinHistory}</EyebrowTag>
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
            <EyebrowTag>{t.explorePolnation}</EyebrowTag>
            <button
              type="button"
              onClick={() => openWeb('https://www.polnation.com')}
              className="text-[10px] text-white/55 hover:text-white"
              style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.08em' }}
            >
              {t.exploreAll}
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
            {t.exploreHint}
          </p>
        </BevelCard>

        {/* Bottom spacer so content isn't hidden behind TG MainButton (~64px) */}
        <div className="h-16" />
      </div>

      {/* ── Language picker (bottom-sheet) ───────────────────────────────── */}
      {showLangPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowLangPicker(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-[#0a0810] border-t border-white/[0.1] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-[16px] font-semibold poly-heading">{t.language}</h2>
              <button
                type="button"
                onClick={() => setShowLangPicker(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center text-white/65 text-xl hover:text-white hover:bg-white/[0.06]"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LOCALES.map((l) => {
                const meta = LOCALE_META[l]
                const active = l === locale
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => switchLocale(l)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 border transition-all active:scale-[0.98] ${
                      active
                        ? 'bg-[var(--poly-purple)]/20 border-[var(--poly-purple)]/60 text-white'
                        : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span className="text-xl leading-none">{meta.flag}</span>
                    <span className="text-[13px] font-medium leading-tight">{meta.label}</span>
                    {active && (
                      <span className="ml-auto text-[var(--poly-purple)] text-[11px]">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Rules modal (bottom-sheet style) ─────────────────────────────── */}
      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowRules(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-[#0a0810] border-t border-white/[0.1] p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-[18px] font-semibold poly-heading">{t.howItWorks}</h2>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center text-white/65 text-xl hover:text-white hover:bg-white/[0.06]"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 text-[13px] text-white/75 leading-relaxed">
              <section>
                <EyebrowTag>{t.earnSpinsTitle}</EyebrowTag>
                <ul className="mt-2 space-y-1.5 list-disc list-inside marker:text-[var(--poly-purple)]">
                  <li>{t.earnSpins1}</li>
                  <li>{t.earnSpins2}</li>
                  <li>{t.earnSpins3}</li>
                </ul>
              </section>

              <section>
                <EyebrowTag>{t.usdcPrizesTitle}</EyebrowTag>
                <p className="mt-2">{t.usdcPrizesDesc}</p>
              </section>

              <section>
                <EyebrowTag>{t.bonusPrizesTitle}</EyebrowTag>
                <p className="mt-2">{t.bonusPrizesDesc1}</p>
                <p className="mt-2">{t.bonusPrizesDesc2}</p>
              </section>

              <section>
                <EyebrowTag>{t.tryAgainSection}</EyebrowTag>
                <p className="mt-2">{t.tryAgainDesc}</p>
              </section>

              <button
                type="button"
                onClick={() => {
                  setShowRules(false)
                  openWeb('https://www.polnation.com/team')
                }}
                className="w-full mt-2 p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple"
              >
                {t.viewTeamBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web login binding modal */}
      {showWebLoginPanel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (webLoginStatus !== 'submitting') setShowWebLoginPanel(false)
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-[#0a0810] border-t border-white/[0.1] p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-[18px] font-semibold poly-heading">{t.webLoginTitle}</h2>
              <button
                type="button"
                onClick={() => setShowWebLoginPanel(false)}
                disabled={webLoginStatus === 'submitting'}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center text-white/65 text-xl hover:text-white hover:bg-white/[0.06] disabled:opacity-40"
              >
                ×
              </button>
            </div>

            {webLoginStatus === 'success' ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-[13px]">
                  {t.webLoginSuccess(webLoginEmail)}
                </div>
                <button
                  type="button"
                  onClick={() => setShowWebLoginPanel(false)}
                  className="w-full p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple"
                >
                  {t.webLoginDoneBtn}
                </button>
              </div>
            ) : (
              <form onSubmit={handleWebLoginSubmit} className="space-y-3">
                <p className="text-white/70 text-[13px] leading-relaxed">
                  {t.webLoginIntro}
                </p>

                {webLoginError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                    {webLoginError}
                  </div>
                )}

                <div>
                  <label className="block text-white/55 text-[11px] uppercase tracking-wider mb-1">
                    {t.webLoginEmailLabel}
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={webLoginEmail}
                    onChange={(e) => setWebLoginEmail(e.target.value)}
                    onFocus={() => setWebLoginFocused(true)}
                    onBlur={() => setWebLoginFocused(false)}
                    required
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.10] text-white text-[14px] placeholder:text-white/30 focus:border-[var(--poly-purple)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/55 text-[11px] uppercase tracking-wider mb-1">
                    {t.webLoginPasswordLabel}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={webLoginPassword}
                    onChange={(e) => setWebLoginPassword(e.target.value)}
                    onFocus={() => setWebLoginFocused(true)}
                    onBlur={() => setWebLoginFocused(false)}
                    minLength={6}
                    required
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.10] text-white text-[14px] placeholder:text-white/30 focus:border-[var(--poly-purple)] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={webLoginStatus === 'submitting' || !webLoginEmail.trim() || webLoginPassword.length < 6}
                  className="w-full p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors shadow-cta-purple disabled:opacity-40 disabled:pointer-events-none"
                >
                  {webLoginStatus === 'submitting' ? t.webLoginSavingBtn : t.webLoginSaveBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
