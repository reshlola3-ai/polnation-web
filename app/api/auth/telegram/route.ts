import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import {
  findOrCreateTelegramProfile,
  installTelegramSession,
  resolveReferrer,
  TelegramAuthError,
  type TelegramUser,
} from '@/lib/auth/telegram'

// ── Mini App initData verification ───────────────────────────────────────────
// Per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// NOTE: Login Widget (web) uses a different secret derivation. Do not share
// this verifier with that path — see Phase 7.2 of the migration plan doc.

interface InitDataResult {
  ok: boolean
  user?: TelegramUser
  startParam?: string
  reason?: string
}

function verifyTelegramInitData(initDataRaw: string, botToken: string): InitDataResult {
  if (!initDataRaw) return { ok: false, reason: 'empty_init_data' }

  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'no_hash' }

  // Per spec: build data_check_string by sorting keys (excluding hash) and
  // joining as `key=value` lines.
  params.delete('hash')
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // Secret key = HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Constant-time compare to mitigate timing attacks
  const computedBuf = Buffer.from(computed, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')
  if (computedBuf.length !== hashBuf.length) return { ok: false, reason: 'hash_length_mismatch' }
  if (!crypto.timingSafeEqual(computedBuf, hashBuf)) return { ok: false, reason: 'hash_mismatch' }

  // Reject stale init data (>24h old) — limits replay window if a token leaks.
  const authDate = parseInt(params.get('auth_date') || '0', 10)
  if (!authDate) return { ok: false, reason: 'no_auth_date' }
  const ageSeconds = Date.now() / 1000 - authDate
  if (ageSeconds > 86400) return { ok: false, reason: 'init_data_expired' }

  const userJson = params.get('user')
  if (!userJson) return { ok: false, reason: 'no_user' }

  let user: TelegramUser
  try {
    user = JSON.parse(userJson)
  } catch {
    return { ok: false, reason: 'malformed_user_json' }
  }
  if (!user.id) return { ok: false, reason: 'no_user_id' }

  return {
    ok: true,
    user,
    startParam: params.get('start_param') || undefined,
  }
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { initData } = await request.json()

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const verified = verifyTelegramInitData(initData, botToken)
    if (!verified.ok || !verified.user) {
      return NextResponse.json(
        { error: 'invalid_init_data', reason: verified.reason },
        { status: 401 },
      )
    }

    const referrerId = await resolveReferrer(verified.startParam)
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
    console.error('Telegram auth error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
