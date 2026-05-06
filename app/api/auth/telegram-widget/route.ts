import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import {
  findOrCreateTelegramProfile,
  installTelegramSession,
  resolveReferrer,
  TelegramAuthError,
  type TelegramUser,
} from '@/lib/auth/telegram'

// ── Login Widget hash verification ───────────────────────────────────────────
// Per https://core.telegram.org/widgets/login#checking-authorization
//
// CRITICAL: Login Widget uses a different secret derivation than Mini App
// initData. Do not share verifier with /api/auth/telegram.
//
//   Mini App  → secret = HMAC-SHA256("WebAppData", botToken)
//   Widget    → secret = SHA256(botToken)

interface WidgetPayload {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface VerifyResult {
  ok: boolean
  user?: TelegramUser
  reason?: string
}

function verifyTelegramLoginWidget(
  payload: Record<string, unknown>,
  botToken: string,
): VerifyResult {
  const hash = typeof payload.hash === 'string' ? payload.hash : null
  if (!hash) return { ok: false, reason: 'no_hash' }

  // Build data_check_string from all fields except `hash`, sorted alphabetically.
  // Skip undefined/null/non-primitive values (TG only sends strings/numbers).
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'hash') continue
    if (v === undefined || v === null) continue
    if (typeof v !== 'string' && typeof v !== 'number') continue
    entries.push([k, String(v)])
  }
  entries.sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Constant-time compare to mitigate timing attacks.
  const computedBuf = Buffer.from(computed, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')
  if (computedBuf.length !== hashBuf.length) return { ok: false, reason: 'hash_length_mismatch' }
  if (!crypto.timingSafeEqual(computedBuf, hashBuf)) return { ok: false, reason: 'hash_mismatch' }

  // Reject stale auth — same 24h window as Mini App initData.
  const authDate = typeof payload.auth_date === 'number'
    ? payload.auth_date
    : parseInt(String(payload.auth_date), 10)
  if (!authDate) return { ok: false, reason: 'no_auth_date' }
  const ageSeconds = Date.now() / 1000 - authDate
  if (ageSeconds > 86400) return { ok: false, reason: 'auth_expired' }

  const id = typeof payload.id === 'number' ? payload.id : parseInt(String(payload.id), 10)
  if (!id) return { ok: false, reason: 'no_id' }
  const firstName = typeof payload.first_name === 'string' ? payload.first_name : ''
  if (!firstName) return { ok: false, reason: 'no_first_name' }

  const user: TelegramUser = {
    id,
    first_name: firstName,
    last_name: typeof payload.last_name === 'string' ? payload.last_name : undefined,
    username: typeof payload.username === 'string' ? payload.username : undefined,
    photo_url: typeof payload.photo_url === 'string' ? payload.photo_url : undefined,
  }

  return { ok: true, user }
}

// ── POST handler ─────────────────────────────────────────────────────────────
//
// Body shape (forwarded straight from window.onTelegramAuth):
//   { id, first_name, last_name?, username?, photo_url?, auth_date, hash, ref? }
//
// `ref` is our own field (referral short-code from the page URL); it's NOT
// part of the Telegram-signed payload and is safely user-controlled —
// attaching yourself to a referrer is reverse-abuse (you give them
// commission, you get nothing), so accepting it without HMAC coverage is
// acceptable here.

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<WidgetPayload> & { ref?: string }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const verified = verifyTelegramLoginWidget(body, botToken)
    if (!verified.ok || !verified.user) {
      return NextResponse.json(
        { error: 'invalid_widget_data', reason: verified.reason },
        { status: 401 },
      )
    }

    // resolveReferrer accepts both `ref_ABCD` and bare `ABCD`, so pass through.
    const refParam = typeof body.ref === 'string' && body.ref ? body.ref : undefined
    const referrerId = await resolveReferrer(refParam)

    const { profileId, email, isNew } = await findOrCreateTelegramProfile({
      tgUser: verified.user,
      referrerId,
    })

    return await installTelegramSession({ email, userId: profileId, isNewUser: isNew })
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json(
        { error: error.code, detail: error.detail },
        { status: error.status },
      )
    }
    console.error('Telegram widget auth error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
