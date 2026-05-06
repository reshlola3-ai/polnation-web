import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

// Admin client with service role key — mirrors the pattern used in
// /api/auth/wallet-login/route.ts so the codebase has one consistent style.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Types ────────────────────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface InitDataResult {
  ok: boolean
  user?: TelegramUser
  startParam?: string
  reason?: string
}

// ── HMAC verification (per Telegram Mini Apps spec) ──────────────────────────
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

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

// ── Referral code generation (matches wallet-login pattern) ──────────────────

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ── Resolve start_param → referrer profile id ────────────────────────────────
// Supported formats:
//   ref_ABCD  (explicit prefix — preferred for clarity)
//   ABCD      (bare 4-char referral code — also accepted as fallback)

async function resolveReferrer(startParam: string | undefined): Promise<string | null> {
  if (!startParam) return null
  let code = startParam.startsWith('ref_') ? startParam.slice(4) : startParam
  code = code.toUpperCase().trim()
  if (code.length < 3 || code.length > 8) return null

  const { data: ref } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .single()
  return ref?.id ?? null
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
        { status: 401 }
      )
    }

    const tgUser = verified.user

    // Look up by telegram_chat_id (we store TG user_id here — for private
    // 1:1 conversations between user and bot they're the same value).
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('telegram_chat_id', tgUser.id)
      .single()

    if (existing) {
      // Returning TG user — refresh denormalized fields and log them in.
      await supabaseAdmin
        .from('profiles')
        .update({
          telegram_username: tgUser.username || null,
          telegram_photo_url: tgUser.photo_url || null,
          telegram_verified: true,
        })
        .eq('id', existing.id)

      return await generateMagicLink(existing.email, existing.id, false)
    }

    // New TG user — create account.
    const referrerId = await resolveReferrer(verified.startParam)
    return await createTelegramAccount(tgUser, referrerId)
  } catch (error) {
    console.error('Telegram auth error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// ── Create new account for first-time TG user ────────────────────────────────

async function createTelegramAccount(tgUser: TelegramUser, referrerId: string | null) {
  const syntheticEmail = `tg_${tgUser.id}@telegram.polnation.com`
  const randomPassword = crypto.randomUUID() + crypto.randomUUID()
  const usernameFallback =
    tgUser.username ||
    `tg_${String(tgUser.id).slice(-6)}`

  // Create auth user (admin API, email pre-confirmed so no verification mail)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    password: randomPassword,
    email_confirm: true,
    user_metadata: {
      telegram_id: tgUser.id,
      first_name: tgUser.first_name,
      auth_type: 'telegram',
      referrer_id: referrerId,
    },
  })

  if (authError || !authUser.user) {
    console.error('TG createUser failed:', authError)
    return NextResponse.json(
      { error: 'create_user_failed', detail: authError?.message },
      { status: 500 }
    )
  }

  const userId = authUser.user.id

  // Poll for the profile-creation trigger (50ms × up to 6 attempts = max 300ms
  // vs the old fixed 500ms sleep — bails early once the row appears).
  let existingProfile: { id: string; referral_code: string | null } | null = null
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, referral_code')
      .eq('id', userId)
      .single()
    if (data) { existingProfile = data; break }
  }

  const profileFields: Record<string, unknown> = {
    telegram_chat_id: tgUser.id,
    telegram_username: tgUser.username || null,
    telegram_photo_url: tgUser.photo_url || null,
    telegram_verified: true,
    username: usernameFallback,
    profile_completed: false,
    ...(referrerId ? { referrer_id: referrerId } : {}),
  }

  if (existingProfile) {
    // Trigger created the profile — fill in TG fields + referral_code if missing
    if (!existingProfile.referral_code) {
      profileFields.referral_code = generateReferralCode()
    }
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(profileFields)
      .eq('id', userId)
    if (updateError) {
      console.error('TG profile update error:', updateError)
    }
  } else {
    // Trigger didn't fire (or was skipped by an exception branch) — insert manually.
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email: syntheticEmail,
        referral_code: generateReferralCode(),
        ...profileFields,
      })
    if (insertError) {
      console.error('TG profile insert error:', insertError)
      return NextResponse.json(
        { error: 'create_profile_failed', detail: insertError.message },
        { status: 500 }
      )
    }
  }

  return await generateMagicLink(syntheticEmail, userId, true)
}

// ── Magic link: same shape as wallet-login response ──────────────────────────

async function generateMagicLink(
  email: string | null,
  userId: string,
  isNewUser: boolean
) {
  const loginEmail = email || `tg_unknown_${userId.slice(0, 8)}@telegram.polnation.com`

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: loginEmail,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.polnation.com'}/lottery-mini`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('TG magic link error:', linkError)
    return NextResponse.json(
      { error: 'login_failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    isNewUser,
    magicLink: linkData.properties.action_link,
    userId,
  })
}
