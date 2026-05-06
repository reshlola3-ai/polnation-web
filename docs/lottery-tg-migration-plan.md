# Lottery TG Migration Plan

**Status**: Approved · In progress
**Owner**: TBD
**Last updated**: 2026-05-06
**Current status**: Phase 5 conversion-optimization wave 1 live (welcome task: join TG group → +1 spin, one-time)

## Decisions (locked in)

| # | Decision | Choice |
|---|---|---|
| 1 | Bot username | `@PolnationBot` |
| 2 | Mini App URL path | `/lottery-mini` |
| 3 | TG referral spin grant rule | **Option B** — new `referral_telegram_joined` grant_reason; TG-referred user joining via `start_param` grants 1 spin to referrer (no Twitter requirement, no airdrop requirement) |
| 4 | Synthetic email domain | `telegram.polnation.com` (never resolved as real DNS) |
| 5 | SPIN button | **TG MainButton** (native bottom button, haptic feedback, theme-aware) |
| 6 | MVP scope inside Mini App | **Wheel + spin count + Share button only**. No history, no earnings, no profile. (Web `/test-lottery` retains full feature set.) |

## Goal

Add a Telegram Mini App surface for the lottery, **as a parallel entry point alongside the existing `/test-lottery` web page**. TG users can spin the wheel without leaving Telegram; existing web flows are preserved.

## Non-goals

- ❌ Removing or modifying `/test-lottery` web page
- ❌ Changing existing prize logic or probabilities (`app/api/lottery/spin/route.ts` PRIZES table stays)
- ❌ Changing existing `/api/lottery`, `/api/lottery/spin`, `/api/lottery/check-spins` route behavior
- ❌ Forcing existing web users to migrate to TG
- ❌ Building a TG account-merge flow (Phase 2 if needed)
- ❌ Building bot-side push notifications (Phase 2)

## Compatibility guarantee

| Existing surface | Status after migration |
|---|---|
| `/test-lottery` web page | **Unchanged** |
| `/api/lottery` GET | **Unchanged** (already returns referralCode for TG-bound users too) |
| `/api/lottery/spin` POST | **Unchanged** |
| `/api/lottery/check-spins` POST | **Unchanged** |
| Existing `profiles` rows | **Unchanged** (3 new nullable columns added) |
| Existing referral system | **Unchanged** (TG users plug into same referrer_id mechanism) |
| Existing wallet binding | **Unchanged** (TG users bind on-demand at withdrawal time) |

## Architecture

```
┌────────────────────────────────┐         ┌────────────────────────────────┐
│   Existing Web                  │         │   New TG Mini App               │
│   /test-lottery                 │         │   /lottery-mini                  │
│   (unchanged)                   │         │   (new route)                   │
└──────────────┬─────────────────┘         └─────────────────┬──────────────┘
               │                                              │
               │       ┌─────────────────────────────┐       │
               └──────▶│  Shared backend             │◀──────┘
                       │  /api/lottery/*              │
                       │  /api/auth/wallet-login      │
                       │  /api/auth/telegram (NEW)    │
                       └──────────────┬──────────────┘
                                      ▼
                              ┌──────────────┐
                              │  Supabase     │
                              │  profiles     │
                              │  (3 new cols) │
                              └──────────────┘

      Telegram Bot ────webhook────▶ /api/telegram/webhook (NEW, serverless)
```

## Phased delivery

| Phase | Scope | Estimated effort |
|---|---|---|
| **Phase 1** | DB schema, auth backbone, webhook, /start command | Done |
| **Phase 2** | TG Mini App route + lottery wheel rendering | Done |
| **Phase 3** | Wallet binding inside Mini App + withdraw flow | Done |
| **Phase 4** | Referral via `start_param`, spin grant integration | Done |
| **Phase 5** | Conversion optimization (welcome task wave 1 done; daily/social proof TBD) | In progress |
| **Phase 6** | Buffer / polish | 0.5 day |
| **Total** | | **~7 days** |

---

## Phase 1 — Auth backbone

### Phase 1 activation log

Status: live as of 2026-05-06.

- Code shipped: `25e1e8e8` (`feat(tg): Phase 1 — TG Mini App auth backbone`).
- Follow-up fix shipped: `8b46797c` (`fix(tg): await webhook start reply`).
- Vercel env vars configured for Production + Preview:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_BOT_USERNAME=PolnationBot`
  - `TELEGRAM_WEBHOOK_SECRET`
  - `TELEGRAM_MINI_APP_SHORT_NAME=lottery`
- Supabase migration applied: `supabase/migrations/add-telegram-mini-app-fields.sql`.
- Telegram webhook registered:
  - URL: `https://www.polnation.com/api/telegram/webhook`
  - `allowed_updates`: `["message"]`
- Verified:
  - `GET https://www.polnation.com/api/telegram/webhook` returns `{ "ok": true, "service": "tg-webhook" }`.
  - Telegram `getWebhookInfo` points to the production webhook URL with `pending_update_count=0`.
  - Sending `/start` to `@PolnationBot` returns the welcome message and Open Lottery button.

Note: `/lottery-mini` route is now live as of Phase 2.

### 1.1 BotFather setup (manual, ~30 min)

- Create bot via `@BotFather` `/newbot`. Suggested names: `@PolnationBot` or `@PolnationBot`. Save BOT_TOKEN.
- Run `/newapp`, set Mini App URL to `https://polnation.com/lottery-mini`. Save BOT_USERNAME.
- Set `/setdomain` to `polnation.com` (required for Mini App).
- Configure webhook (one-time API call):
  ```
  POST https://api.telegram.org/bot<TOKEN>/setWebhook
  Body: {
    "url": "https://polnation.com/api/telegram/webhook",
    "secret_token": "<random-32-char-string>",
    "allowed_updates": ["message", "callback_query"]
  }
  ```

### 1.2 Environment variables

Add to Vercel project settings:

```
TELEGRAM_BOT_TOKEN=<BOT_TOKEN>
TELEGRAM_BOT_USERNAME=PolnationBot
TELEGRAM_WEBHOOK_SECRET=<random-32-char-string>
```

### 1.3 Database migration

```sql
-- supabase/migrations/<timestamp>_add_telegram_to_profiles.sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);
```

All columns nullable. Existing rows untouched. RLS policies stay the same.

### 1.4 New file: `app/api/auth/telegram/route.ts`

Verifies Telegram `initData` HMAC signature, then either logs in (existing TG-bound user) or creates a new user with synthetic email `tg_<telegram_id>@telegram.polnation.com`.

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

function verifyTelegramInitData(initDataRaw: string, botToken: string): { ok: boolean; user?: any; startParam?: string } {
  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) return { ok: false }
  params.delete('hash')

  // Sort and concatenate per TG spec
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // HMAC key derivation: SHA256("WebAppData") with botToken
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computed !== hash) return { ok: false }

  // Optional: enforce 24h freshness
  const authDate = parseInt(params.get('auth_date') || '0', 10)
  if (Date.now() / 1000 - authDate > 86400) return { ok: false }

  const userJson = params.get('user')
  if (!userJson) return { ok: false }

  return {
    ok: true,
    user: JSON.parse(userJson),
    startParam: params.get('start_param') || undefined,
  }
}

export async function POST(request: Request) {
  const { initData } = await request.json()
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })

  const verified = verifyTelegramInitData(initData, botToken)
  if (!verified.ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })

  const tgUser = verified.user
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Look up or create user
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .single()

  let userId: string

  if (existing) {
    userId = existing.id
    // Refresh denormalized TG fields on each login
    await admin.from('profiles').update({
      telegram_username: tgUser.username || null,
      telegram_photo_url: tgUser.photo_url || null,
    }).eq('id', userId)
  } else {
    // Resolve referrer from start_param if present (format: ref_XXXX)
    let referrerId: string | null = null
    if (verified.startParam?.startsWith('ref_')) {
      const code = verified.startParam.slice(4)
      const { data: ref } = await admin
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .single()
      referrerId = ref?.id ?? null
    }

    // Create Supabase auth user with synthetic email (admin API, no confirm)
    const syntheticEmail = `tg_${tgUser.id}@telegram.polnation.com`
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: {
        telegram_id: tgUser.id,
        first_name: tgUser.first_name,
        username: tgUser.username,
      },
    })

    if (authError || !authUser.user) {
      return NextResponse.json({ error: 'create_user_failed', detail: authError?.message }, { status: 500 })
    }

    userId = authUser.user.id

    // Insert profiles row (handler trigger may create one; if so, update; else insert)
    await admin.from('profiles').upsert({
      id: userId,
      telegram_id: tgUser.id,
      telegram_username: tgUser.username || null,
      telegram_photo_url: tgUser.photo_url || null,
      referrer_id: referrerId,
      // referral_code auto-fills via existing trigger or ensureReferralCode on first dashboard hit
    })
  }

  // Generate magic link for client to verify and establish session
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: `tg_${tgUser.id}@telegram.polnation.com`,
  })

  if (linkError || !linkData) {
    return NextResponse.json({ error: 'link_failed' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    userId,
    magicLink: linkData.properties.action_link,
    isNewUser: !existing,
  })
}
```

**Key points**:
- HMAC verification is non-negotiable — without it, anyone can forge a TG identity
- Synthetic email pattern: `tg_<id>@telegram.polnation.com`. Domain doesn't need to exist (no email is sent).
- Magic link flow mirrors existing `/api/auth/wallet-login` so client-side session bootstrap is identical

### 1.5 New file: `app/api/telegram/webhook/route.ts`

Minimal serverless webhook. Only handles `/start` for now.

```ts
export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  let update: any
  try {
    update = await request.json()
  } catch {
    return Response.json({ ok: true }) // ack and drop malformed
  }

  // /start command handler
  if (update.message?.text?.startsWith('/start')) {
    const chatId = update.message.chat.id
    const startParam = update.message.text.split(' ')[1] // e.g. "ref_ABCD"

    // Build Mini App URL with startapp param to forward referral
    const miniAppUrl = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}/lottery${startParam ? `?startapp=${startParam}` : ''}`

    // Fire and forget; we must respond 200 in <1s
    sendTelegramMessage(chatId, {
      text: '🎰 Welcome to Polnation Lottery!\n\nSpin the wheel to win USDC and bonuses.',
      reply_markup: {
        inline_keyboard: [[
          { text: '🎯 Open Lottery', web_app: { url: miniAppUrl } }
        ]]
      }
    }).catch(err => console.error('TG sendMessage error:', err))
  }

  return Response.json({ ok: true })
}

async function sendTelegramMessage(chatId: number, payload: any) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...payload }),
  })
}
```

**Critical: respond within 1 second**. All TG send operations are fire-and-forget; we must return 200 immediately or TG will retry/pause the webhook.

---

## Phase 2 — TG Mini App route

### Phase 2 activation log

Status: live as of 2026-05-06.

- Code shipped: `55eef522` (`feat(tg): Phase 2 — TG Mini App lottery route`).
- Files created:
  - `app/lottery-mini/layout.tsx` — minimal layout, no Navbar/BottomNav; injects TG SDK via `<Script strategy="beforeInteractive">`.
  - `app/lottery-mini/page.tsx` — full Mini App page.
- Implementation notes:
  - Uses `@lucky-canvas/react` LuckyWheel directly with a self-contained PRIZE_CONFIGS (mirrors server PRIZES table, 12 segments). Did **not** reuse the web `LotteryWheel` wrapper component — keeps the Mini App layout independent.
  - Auth state machine: `init → authenticating → ready → error`. On mount: reads `window.Telegram.WebApp.initData`, POSTs to `/api/auth/telegram`, calls `supabase.auth.verifyOtp` with the returned magic link token. Spinner shown during authenticating; error screen on failure.
  - TG MainButton wired via `useEffect` on `[remainingSpins, isInfluencer, isSpinning]`. Text: `SPINNING…` | `SPIN (N LEFT)` | `SPIN` (influencer, no count) | `NO SPINS LEFT`. Auto-enable/disable matches state.
  - `pendingResultRef` pattern: handleSpin stashes `{ type, amount }` into a ref; `handleWheelEnd` (fired by `@lucky-canvas` `onEnd` callback) reads it to drive the TG showPopup. This avoids stale-closure issues with async wheel animation timing.
  - Win popup: `tg.showPopup()` with prize label + flavour text (USDC → "Added to your withdrawable balance"; Bonus → "Added to your unlock progress"). `tg.HapticFeedback.notificationOccurred('success' | 'warning')` on each result.
  - Share button calls `tg.openTelegramLink` with native share URL `https://t.me/share/url?url=...&text=...`. Falls back to `window.open` if `openTelegramLink` is unavailable.
  - `isInfluencer` flag from `/api/lottery` response gates "∞ Unlimited spins" display and bypasses the `remainingSpins > 0` guard on spin.
- Pending real-device testing (Phase 5): iOS + Android TG clients.

### 2.1 New route

Place at top level (not inside `(dashboard)` group) so it doesn't inherit Navbar/BottomNav.

```
app/
  lottery-mini/
    layout.tsx       ← minimal, injects TG SDK, theme handling
    page.tsx         ← lottery wheel + spin count
```

URL: `https://polnation.com/lottery-mini`

### 2.2 New file: `app/lottery-mini/layout.tsx`

```tsx
import Script from 'next/script'

export default function TmaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="kraken-dashboard-surface min-h-screen">
        {children}
      </div>
    </>
  )
}
```

No Navbar, no BottomNav — TG provides its own header.

### 2.3 New file: `app/lottery-mini/page.tsx`

Reuses the existing `LotteryWheel` component plus the spin count UI. On mount:
1. Read `window.Telegram.WebApp.initData`
2. Call `tg.expand()` to use full viewport
3. POST to `/api/auth/telegram` with initData
4. Verify magic link → establish session
5. Render lottery (existing logic from `/test-lottery/page.tsx`)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { LotteryWheel } from '@/components/lottery/LotteryWheel'
import { createClient } from '@/lib/supabase'
// ... reuse imports from /test-lottery/page.tsx ...

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        ready: () => void
        expand: () => void
        HapticFeedback?: any
        themeParams?: any
        // ...
      }
    }
  }
}

export default function TmaLotteryPage() {
  const [authStatus, setAuthStatus] = useState<'init' | 'authenticating' | 'ready' | 'error'>('init')
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setAuthStatus('error')
      setError('Open this from inside Telegram')
      return
    }
    tg.ready()
    tg.expand()

    if (!tg.initData) {
      setAuthStatus('error')
      setError('No Telegram session data')
      return
    }

    setAuthStatus('authenticating')

    fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(r => r.json())
      .then(async (data) => {
        if (data.error) throw new Error(data.error)
        // Bootstrap session via magic link (same pattern as wallet-login)
        const url = new URL(data.magicLink)
        const token = url.searchParams.get('token')
        if (token) {
          await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' })
        }
        setAuthStatus('ready')
      })
      .catch((err) => {
        setAuthStatus('error')
        setError(err.message || 'Authentication failed')
      })
  }, [])

  if (authStatus !== 'ready') {
    return <LoadingOrError status={authStatus} error={error} />
  }

  // Render lottery (reuse existing UI from test-lottery/page.tsx)
  return <LotteryContent />
}
```

### 2.4 Mini App-specific UX (locked: TG MainButton)

Per decision 5, the SPIN action uses TG's native MainButton — bottom-of-screen native button rendered by Telegram itself. The in-page wheel reacts to the button press but does not render a duplicate "Spin" button.

```tsx
useEffect(() => {
  const tg = window.Telegram?.WebApp
  if (!tg) return
  const mb = tg.MainButton
  mb.setText(remainingSpins > 0 ? 'SPIN' : 'NO SPINS LEFT')
  mb.show()
  if (remainingSpins > 0) mb.enable()
  else mb.disable()

  const handler = () => {
    if (remainingSpins <= 0 || isSpinning) return
    spin()
  }
  mb.onClick(handler)
  return () => { mb.offClick(handler); mb.hide() }
}, [remainingSpins, isSpinning])
```

Other native UX:
- Use `tg.HapticFeedback.notificationOccurred('success')` on win
- Use `tg.showPopup()` for win/loss modals
- Respect `tg.themeParams` colors (or override with polygon palette)
- Use `tg.BackButton` for sub-screens if any

These are progressive enhancements — Mini App works without them but feels more native with.

---

## Phase 3 — Wallet binding inside Mini App

### Phase 3 activation log

Status: live as of 2026-05-06.

- Code shipped: `4a1ef912` (`feat(tg): Phase 3 — wallet binding + withdraw in Mini App`).
- Files created:
  - `app/api/profile/bind-wallet/route.ts` — `POST` endpoint: validates EVM address (`/^0x[0-9a-fA-F]{40}$/`), writes to `profiles.wallet_address` for the authenticated session user. No wallet auth flow — user is already logged in via TG session.
  - `components/wallet/TmaWalletBinder.tsx` — wallet binding component purpose-built for TG Mini App. Same Trust/Bitget/SafePal buttons + WC universal link logic as `InlineWalletPicker`, but post-connect calls `/api/profile/bind-wallet` instead of `/api/auth/wallet-login`. No redirect — fires `onBound(address)` callback so the parent page can proceed.
- Files modified:
  - `app/api/lottery/route.ts` — GET response extended with `walletAddress` (from `profiles.wallet_address`) and `availableUsdc` (from `user_profits.available_usdc`). Additive only; existing `/test-lottery` ignores these fields.
  - `app/lottery-mini/layout.tsx` — added `<Web3Provider>` wrapper. Required for wagmi hooks (`useAccount`, `useConnect`, `useConnectors`) inside `TmaWalletBinder`.
  - `app/lottery-mini/page.tsx` — added withdraw section below the Share button:
    - Balance row shows `$X.XX USDC` from state.
    - No wallet bound → "Connect Wallet to Withdraw" button → expands `TmaWalletBinder` inline.
    - Wallet bound → shows address prefix + amount input + Withdraw button → `POST /api/withdraw` with `tokenType: 'USDC'`. On success: `showPopup` confirmation + `HapticFeedback('success')` + refreshes state after 3s.
- Pending real-device testing (Phase 5): WalletConnect flow inside TG webview on iOS/Android.

When TG user wins USDC and clicks "Withdraw":
1. Check `profiles.wallet_address` — if null, show wallet binding flow
2. Render `<InlineWalletPicker>` (existing component) — clicking Trust/Bitget/SafePal triggers WalletConnect inside Mini App
3. WalletConnect URI gets routed to `link.{wallet}.com/wc?uri=` (in new tab via `window.open`, since Mini App webview behaves like a regular browser)
4. User approves in wallet app → WC connection established → `wallet_address` saved to profile
5. Withdrawal API call proceeds

**Important**: WC inside TG Mini App webview should work — TG webview is essentially Chromium/WebKit with full JS API access. Test on iOS/Android TG clients.

---

## Phase 4 — Referral via `start_param`

### Phase 4 activation log

Status: live as of 2026-05-06. Bundled with Phase 3 follow-up review work.

- `referral_telegram_joined` grant rule shipped in `app/api/lottery/check-spins/route.ts` (rule #4). Trigger: any direct referral with `telegram_chat_id IS NOT NULL` → +1 spin to referrer. Dedupe via `lottery_spin_grants(user_id, grant_reason='referral_telegram_joined', referral_id)`.
- The TG referral path (`?startapp=ref_XXXX` → `/api/auth/telegram` → `referrer_id` set) was already in place from Phase 1. Phase 4 just made it pay out.
- New mandatory withdraw gate: TG users must be a member of `TELEGRAM_REQUIRED_CHAT_ID` to withdraw.
  - New endpoint `app/api/telegram/check-membership/route.ts` (GET) calls Bot API `getChatMember`. If env var is unset → returns `configured: false, isMember: true` (no-op gate, dev-friendly).
  - Same check duplicated in `app/api/withdraw/route.ts` so the gate cannot be bypassed by faking the frontend.
  - Required env vars (production-only):
    - `TELEGRAM_REQUIRED_CHAT_ID` — supergroup chat_id (e.g., `-1001234567890`).
    - `TELEGRAM_GROUP_INVITE_LINK` — public invite URL shown in the UI.
- `/api/lottery` GET extended again with `telegramUsername`, `referredBy`, `invitedCount` — feeds the new "network" UI block.
- `app/lottery-mini/page.tsx` reshuffled:
  - Withdraw block moved to **directly under the wheel** (so users who win USDC see balance immediately).
  - "Join Telegram Group to Withdraw" button rendered when `groupConfigured && !isGroupMember && walletAddress`.
  - "Invited by @X · You invited N friends" mini-block added.
  - Header eyebrow now greets the user with their `@telegram_username` when available.
  - Bonus reward info card became a link to polnation.com/dashboard (so bonus winners have a path to view progress).
  - Withdraw error auto-clears on amount edit; minimum-amount hint ("Minimum $0.10 USDC") rendered under the form.
  - TG MainButton hides while withdraw input is focused (prevents mis-tap on SPIN).

### 4.1 Bot link format

Sharing a referral link from the Mini App:
```
https://t.me/PolnationBot/lottery?startapp=ref_{REFERRAL_CODE}
```

When recipient clicks:
- TG opens the bot
- Mini App opens with `start_param=ref_{CODE}` in `initData`
- Our `/api/auth/telegram` handler resolves `ref_{CODE}` → `referrer_id` → saves on new account creation

### 4.2 New spin grant rule for TG referrals

The existing `referral_twitter_verified` rule (in `/api/lottery/check-spins`) **stays unchanged** — it continues to grant spins for web-flow referrals where the referred user completes Twitter verification.

**For TG-acquired referrals** we add a parallel rule (decision 3 locked above):

```
grant_reason: 'referral_telegram_joined'
trigger:      direct referral has telegram_id IS NOT NULL
                AND was created via /api/auth/telegram (TG flow)
              → +1 spin to referrer.id
dedupe key:   (user_id, grant_reason, referral_id) via lottery_spin_grants
```

**Why a parallel rule rather than dropping Twitter from existing rule:**
- Web onboarding still benefits from Twitter verification as a quality signal
- TG referral is its own verified action (HMAC-validated initData == proven TG account)
- Two rules let us tune them independently later if abuse patterns differ

**Implementation outline** — extend [app/api/lottery/check-spins/route.ts](../app/api/lottery/check-spins/route.ts) with a new section after the existing referral rule:

```ts
// ========== 4. Direct referral with telegram_id (TG flow) → +1 spin ==========
const { data: tgReferrals } = await admin
  .from('profiles')
  .select('id')
  .eq('referrer_id', user.id)
  .not('telegram_id', 'is', null)

if (tgReferrals && tgReferrals.length > 0) {
  for (const referral of tgReferrals) {
    const { data: existingGrant } = await admin
      .from('lottery_spin_grants')
      .select('id')
      .eq('user_id', user.id)
      .eq('grant_reason', 'referral_telegram_joined')
      .eq('referral_id', referral.id)
      .single()

    if (!existingGrant) {
      await admin.from('lottery_spin_grants').insert({
        user_id: user.id,
        grant_reason: 'referral_telegram_joined',
        referral_id: referral.id,
        milestone_count: 1,
        spins_granted: 1,
      })
      newSpinsGranted += 1
    }
  }
}
```

**Edge case**: a single referred user might trigger both rules (joined via TG + later did Twitter verification on web). They'd grant 2 spins to the referrer — that's intentional. Two distinct verified actions = two rewards.

### 4.3 Share button in TG Mini App

```tsx
const handleShare = () => {
  const link = `https://t.me/${BOT_USERNAME}/lottery?startapp=ref_${myReferralCode}`
  const shareText = `🎰 Spin the Polnation Lottery and win USDC!`
  // TG native share
  window.Telegram?.WebApp?.openTelegramLink?.(
    `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`
  )
}
```

This opens TG's native share sheet — user picks contact/group, sends in one tap.

---

## Phase 5 — Conversion optimization

### Phase 5 wave 1 activation log — welcome task

Status: live as of 2026-05-06. Goal: kill the "0 spins → bounce" dead page on first visit.

Mechanic: a brand-new TG user lands → sees a "Welcome Task" gradient card above the wheel: "Join our Telegram group → +1 free spin (one-time)". Tap → opens `TELEGRAM_GROUP_INVITE_LINK` in TG. User joins → returns to Mini App → visibility-change handler re-runs `/api/lottery/check-spins` → backend calls Bot API `getChatMember` → if member, inserts a `welcome_join_telegram` grant row → spin granted. Leaving and re-joining the group does **not** re-grant; dedupe is on `(user_id, grant_reason='welcome_join_telegram')`.

- Code: `<commit-pending>`.
- Files modified:
  - `app/api/lottery/check-spins/route.ts` — new rule #5 `welcome_join_telegram`. Short-circuits if grant already exists (no Bot API call), so cost is bounded.
  - `app/api/lottery/route.ts` — GET response adds `welcomeSpinEarned: boolean`.
  - `app/lottery-mini/page.tsx` — welcome card UI between greeting and wheel; `pendingGroupVerify` spinner state while user is away in the TG group; visibility-change listener re-runs check-spins on return; `runCheckSpins` extracted into a callable so both the auth-ready effect and the visibility effect share one path.
- Cost discipline: server-side prize EV is ~$0.32 USDC/spin at current weights (40% thanks, 24.5% USDC, 35% bonus). User has indicated $0.02/spin as the target — tune `PRIZES.weight` in `app/api/lottery/spin/route.ts` if first-day data shows we're over budget.
- Wave 2 candidates (not yet shipped): daily-login spin (24h cooldown), live wins ticker (social proof), in-popup "Withdraw now" CTA after USDC win.

## Phase 5 — Testing & monitoring (was)

### 5.1 Manual test matrix

| Scenario | Expected |
|---|---|
| New user opens bot, taps Open Lottery | Auto-creates account, lands on wheel |
| Returning user opens Mini App | Auto-login, sees their spin count |
| Web user with same wallet later opens TG Mini App | New separate account (no merge in MVP) |
| TG user invites friend; friend clicks `?startapp=ref_X` | Friend lands in lottery; referrer field set |
| TG user tries to withdraw without wallet | Wallet picker prompts |
| TG user binds wallet, withdraws | Tx submitted same as web |
| Bot offline simulation (delete webhook) | Mini App still works for users who already have entry; new users can't /start |

### 5.2 Devices to test on

- iOS Telegram (latest)
- Android Telegram (latest)
- Telegram Desktop (Mac + Windows) — Mini App support
- Telegram Web — Mini App support

### 5.3 Monitoring

- **UptimeRobot**: ping `https://polnation.com/api/telegram/webhook` (GET returns 405 Method Not Allowed but proves route exists). Every 5 min.
- **Daily cron**: call `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`. Alert if `last_error_date` non-empty or `pending_update_count > 100`.
- **Sentry/log monitor** on `/api/auth/telegram` and `/api/telegram/webhook` — track invalid signatures, rate of new account creation.

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| HMAC verification bug → forged TG identities | Low | Unit test with known TG fixtures; review against TG spec |
| Synthetic email collision with real email | Very low | Use unambiguous domain `telegram.polnation.com` (we control it) |
| TG Mini App graveyard — no traction | Medium | Phase rollout; A/B test referral links; keep web alive as fallback |
| iOS TG webview WC universal link broken | Medium | Same fallback we built for web (`<a>` tag with target=_blank) |
| BotFather rule changes | Low | Don't spam users; respect rate limits; only message on user-initiated `/start` |
| Country-specific TG bans (Russia, occasionally China) | Out of our control | Document limitation; web remains primary for those regions |
| Account merge user demand | Medium | MVP doesn't support it; add Phase 7 if requested |

---

## Pre-launch checklist

Before flipping the bot live:

- [ ] DB migration applied to staging + production
- [ ] BOT_TOKEN, WEBHOOK_SECRET, BOT_USERNAME envs set on Vercel prod
- [ ] Webhook registered with TG (one-time `setWebhook` call)
- [ ] `/api/auth/telegram` and `/api/telegram/webhook` routes deployed
- [ ] `/lottery-mini` route deployed
- [ ] Bot welcome message tested (`/start` returns Open Mini App button)
- [ ] HMAC verification tested with both valid and forged initData
- [ ] Manual test pass on iOS + Android TG clients
- [ ] UptimeRobot monitor set up
- [ ] Daily `getWebhookInfo` cron set up
- [ ] One existing internal referral link converted to TG format and tested end-to-end
- [ ] `referral_telegram_joined` rule tested (referrer correctly receives +1 spin when TG-referred user joins)

---

## Out of scope (Phase 7+ if needed)

- Cross-account merge (TG account ↔ web wallet account)
- Bot push notifications (you won, new spin unlocked, etc.)
- Multi-page Mini App (currently single page = wheel only)
- Earnings/withdraw/team views inside Mini App
- Localization beyond English in Mini App (web has 4 locales already)
- TG group bot features (inline mode, group games, etc.)
- TG Stars / TON payment integration
