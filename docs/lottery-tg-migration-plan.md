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
| **Phase 7** | Web Telegram login (cross-device account access for TG-only users) | ~5.5 hours · **Proposed** |
| **Total** | | **~7 days + 5.5 h** |

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

### 4.4 Incident: case-sensitive `referral_code` lookup (2026-05-07)

**Symptom**: After the "show mini app invitees" feature shipped (`867c0e19`), users reported the invitees list was empty for everyone — both upper-level couldn't see their downlines, and lower-level couldn't see who invited them.

**Root cause**: Some legacy `referral_code` values in `profiles` contain lowercase characters (e.g. `66a7`), even though current generators (both SQL `generate_referral_code()` and JS `generateReferralCode()`) only emit uppercase. The TG-auth and wallet-login attribution paths were forcing the input to upper-case (`code.toUpperCase()`) before `.eq('referral_code', code)`. PostgreSQL `=` is case-sensitive, so `66a7` ≠ `66A7` → query returned 0 rows (`PGRST116`) → `referrerId = null` → new users got no referrer attribution. The display worked correctly; there was simply nothing in `referrer_id` to show.

**Why it took a while to find**: failures were silent — `resolveReferrer` returned `null` indistinguishably from "no `start_param`" or "self-referral". `app/api/referrer/route.ts` had already worked around the same issue with `.ilike('referral_code', ref)` and a comment explaining it, but TG-auth and wallet-login were never updated to match.

**Diagnosis**: temporary `console.log('[tg-auth] …')` lines on every branch of `resolveReferrer` + the returning/new-user paths. One real test invitation surfaced `resolveReferrer: DB error { code_pg: 'PGRST116' }` with `startParam: 'ref_66a7'` — root cause obvious within seconds of the first log line.

**Fix** (`b9c57dcc`): swap `.eq('referral_code', code)` for `.ilike('referral_code', code)` in:
- `app/api/auth/telegram/route.ts` `resolveReferrer`
- `app/api/auth/wallet-login/route.ts` short-code branch

Both paths now match the existing pattern in `app/api/referrer/route.ts`. The `.toUpperCase()` calls were removed since `ilike` makes them redundant.

**Why not also normalize the DB**: backfilling existing lowercase codes to upper-case would invalidate every link a legacy user has already shared. Tolerating mixed case at lookup time is the lower-blast-radius fix.

**Lessons**:
- When silent-fallback returns `null`, log the *reason* in the unhappy path. We had three "return null" branches in `resolveReferrer` that all looked identical from the outside.
- A workaround that lives in one route file (`/api/referrer`) is invisible to the next person writing a similar lookup. Either centralize the lookup, or leave a `// MUST use ilike — see incident YYYY-MM-DD` comment at every site.
- Diagnostic logs added to find a bug should be removed after the bug is fixed (kept the `console.error` for unexpected DB errors only). They cost real money on Vercel and clutter future investigations.

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
| Account merge user demand | Medium | MVP doesn't support it; add Phase 8 if requested |

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

## Phase 7 — Web Telegram login

**Status**: Proposed · not started
**Last updated**: 2026-05-07

### 7.0 Why

TG Mini App users have no real email or password — their auth row is `tg_<id>@telegram.polnation.com` + a random UUID password they never see. If they later open `polnation.com` on a phone browser to check their dashboard, they cannot sign in to **the same** profile, so referrer relationships, balances, history all appear lost.

If they have a wallet bound, they can wallet-login. If they don't, they're stuck. This phase fixes the stuck case.

### 7.1 Approach

Add a "Continue with Telegram" button on `/login` powered by [Telegram Login Widget](https://core.telegram.org/widgets/login). Button → TG client opens authorization → callback returns `{ id, first_name, username, photo_url, auth_date, hash }` → backend HMAC-verifies → looks up `profiles.telegram_chat_id` → installs session.

Match against `telegram_chat_id` (already populated by Mini App auth) — **no new DB column needed**.

Fallback for users who can't / won't use Widget: prompt them to set email + password from inside the Mini App (binding endpoint already exists at [app/api/auth/bind-email/route.ts](../app/api/auth/bind-email/route.ts)).

### 7.2 Critical gotcha — HMAC algorithm differs from Mini App

Two TG-supplied hash schemes coexist; do **not** mix them up:

| Surface | Secret derivation |
|---|---|
| Mini App `initData` | `HMAC-SHA256(key="WebAppData", message=bot_token)` |
| Login Widget callback | `SHA256(bot_token)` (no "WebAppData" prefix) |

The verify functions must be separate, named clearly. Keep [app/api/auth/telegram/route.ts](../app/api/auth/telegram/route.ts) `verifyTelegramInitData` for Mini App; write a new `verifyTelegramLoginWidget` for the widget.

### 7.3 Prerequisites (one-time manual)

| Step | Action | Owner |
|---|---|---|
| 7.3.1 | BotFather `/setdomain` → select `@PolnationBot` → enter **`www.polnation.com`** (the canonical production host — see warning below). | Bot admin |
| 7.3.2 | Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=PolnationBot` env var on Vercel (widget renders client-side, needs username at build time). | DevOps |
| 7.3.3 | Confirm `TELEGRAM_BOT_TOKEN` already present (used by Mini App, reused here). | DevOps |
| 7.3.4 | Verify Vercel `Settings → Domains` redirects apex `polnation.com` to `www.polnation.com`, so all traffic ends up on the canonical host. | DevOps |

⚠️ **`/setdomain` requires exact origin match — `polnation.com` and `www.polnation.com` are different bots-domain values to Telegram.** The earlier 2026-04 attempt (see dev-log-2026-04-07.md §8) failed because setdomain was set to `polnation.com` while users actually loaded the page on `www.polnation.com`, producing the "Bot domain invalid" error. The full troubleshooting tree (changing Referrer-Policy, swapping next/script for manual injection, recreating the bot twice) was misdiagnosis — the fix was a single character: add `www.`. No wildcards, no apex auto-coverage. If you ever serve `/login` on a different host (e.g. a regional subdomain), call `/setdomain` again for that exact host.

**Quick verification** — in browser console on `/login`:

```js
console.log(window.location.origin)
// must equal `https://${value entered in BotFather /setdomain}`
```

### 7.4 Implementation steps

#### Step 1 — Refactor: extract shared TG profile helpers (~1.5 h)

Move three functions out of [app/api/auth/telegram/route.ts](../app/api/auth/telegram/route.ts) into `lib/auth/telegram.ts`:

- `findOrCreateTelegramProfile({ tgUser, referrerId })` — handles both "existing profile match by `telegram_chat_id`" and "first-time create". Returns `{ profileId, email, isNew }`.
- `installTelegramSession(email, userId, isNewUser)` — generate magic link + verify via SSR client (current `installSession`).
- `resolveReferrer(startParam)` — already implemented; just relocate.

After refactor, both `/api/auth/telegram` (mini app) and the new `/api/auth/telegram-widget` (web) call the same helpers — eliminates drift risk.

#### Step 2 — New endpoint `POST /api/auth/telegram-widget` (~1.5 h)

```ts
// Request body shape (from widget callback):
//   { id, first_name, last_name?, username?, photo_url?, auth_date, hash, ref? }

1. verifyTelegramLoginWidget(body) → reject 401 if bad hash or auth_date > 24h
2. const referrerId = await resolveReferrer(body.ref ? `ref_${body.ref}` : undefined)
3. const { profileId, email, isNew } = await findOrCreateTelegramProfile({
     tgUser: { id: body.id, first_name: body.first_name, username: body.username, photo_url: body.photo_url },
     referrerId,
   })
4. return await installTelegramSession(email, profileId, isNew)
```

#### Step 3 — Frontend: Telegram login button on `/login` (~1 h)

New component `components/auth/TelegramLoginButton.tsx`:
- Renders TG's official `<script src="https://telegram.org/js/telegram-widget.js?22">` via `next/script`
- Sets `data-telegram-login`, `data-onauth="onTelegramAuth(user)"`, `data-request-access="write"`
- Wires `window.onTelegramAuth = (user) => fetch('/api/auth/telegram-widget', { ... })`
- On success → `router.push(redirect); router.refresh()`

Insert into [app/(auth)/login/page.tsx](../app/(auth)/login/page.tsx) **between** the wallet picker and the "or sign in with email" divider:

```tsx
<Web3Provider>
  <InlineWalletPicker ... />
</Web3Provider>

<TelegramLoginButton ref={ref} redirect={redirect} />

<div className="relative my-5">{/* existing divider */}</div>
```

Pass through the `ref` query param so referral attribution still works on first-time TG signups via web.

#### Step 4 — Fallback path: email/password from Mini App (~0.5 h)

Wire a "Set up email/password for web access" entry point in `/lottery-mini`. Calls existing [app/api/auth/bind-email/route.ts](../app/api/auth/bind-email/route.ts) — no new backend.

UI position: under the wallet panel or in a new "Account" section. Copy: *"To sign in on web from another device, set an email and password here."*

This unblocks users who can't use Login Widget (no TG client on the device, region restrictions, strict CSP, etc.).

#### Step 5 — Test matrix

| Scenario | Expected |
|---|---|
| Existing Mini App user clicks widget on web | Lands on dashboard, original profile (referrer, balance intact) |
| Brand-new TG user clicks widget on web (never used Mini App) | New synthetic-email profile created, session installed |
| Brand-new TG user with `?ref=ABCD` in URL | `referrer_id` correctly attributed |
| Existing wallet user with same TG id clicks widget | Falls back to TG profile (wallet profile remains separate — see "known limit" below) |
| Tampered `hash` | 401 |
| `auth_date` > 24 h | 401 |
| Mobile Safari, Mobile Chrome, Desktop Chrome, Firefox | TG authorization sheet opens; flow completes |
| User on network where `telegram.org` is blocked | Widget fails to load → fallback copy directs to email/password setup in Mini App |

### 7.5 Known limits / out of scope for Phase 7

- **No account merge.** If a user has both a wallet-only profile and a Mini App profile, widget login lands on the TG profile. Merging the two is Phase 8 territory — needs UX for "which is canonical?", balance reconciliation, history union.
- **No reverse direction.** This phase enables "TG profile → web". The other direction ("wallet/web profile → TG Mini App") already works because Mini App auth always finds existing profile by `telegram_chat_id` once set.
- **Region availability.** Telegram is blocked in some regions. Email/password fallback (Step 4) is the answer there.

### 7.6 Risks

| Risk | Mitigation |
|---|---|
| Mixing up Mini App vs Widget HMAC algorithm | Separate functions, separate names; unit test each with a fixture from TG docs before shipping |
| `setdomain` mismatch (apex vs www, or wrong subdomain) → "Bot domain invalid" | See 7.3.1 — must be exact host match. Live incident on 2026-05-07 confirmed root cause. |
| iframe blocked by strict CSP | Add `frame-src https://oauth.telegram.org` to `next.config` CSP if we tighten later |
| Telegram API changes auth_date format | Already handle as integer seconds; matches Mini App code |
| Login Widget on mobile fails to wake TG app | Documented limitation; fallback path covers it |

### 7.7 Pre-launch checklist (Phase 7 specific)

- [ ] BotFather `/setdomain` includes production domain
- [ ] `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` set on Vercel
- [ ] `lib/auth/telegram.ts` extracted; `/api/auth/telegram` still passes manual test
- [ ] `/api/auth/telegram-widget` handles all 8 test-matrix scenarios
- [ ] HMAC verify tested against TG's own example fixtures
- [ ] CSP on `/login` allows widget iframe (if CSP is enabled at all)
- [ ] Login page rendered tested on iOS Safari + Android Chrome + desktop

---

## Out of scope (Phase 8+ if needed)

- Cross-account merge (TG account ↔ web wallet account)
- Bot push notifications (you won, new spin unlocked, etc.)
- Multi-page Mini App (currently single page = wheel only)
- Earnings/withdraw/team views inside Mini App
- Localization beyond English in Mini App (web has 4 locales already)
- TG group bot features (inline mode, group games, etc.)
- TG Stars / TON payment integration
