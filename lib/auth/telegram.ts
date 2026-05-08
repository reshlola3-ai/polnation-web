import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

// Shared helpers for any path that authenticates a Telegram user (Mini App
// initData, web Login Widget, etc.). Verification of the incoming payload is
// caller-specific because Mini App and Login Widget use different HMAC schemes
// — see Phase 7.2 of docs/lottery-tg-migration-plan.md. This module owns the
// "find-or-create profile + install session" tail that's identical for both.

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export class TelegramAuthError extends Error {
  constructor(
    public code: string,
    public status: number = 500,
    public detail?: string,
  ) {
    super(`${code}${detail ? `: ${detail}` : ''}`)
    this.name = 'TelegramAuthError'
  }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// ── Referral code lookup ─────────────────────────────────────────────────────
// Supports both `ref_ABCD` (preferred) and bare `ABCD`. Lookup is
// case-insensitive — legacy referral_codes may contain lowercase chars
// (see app/api/referrer/route.ts for the same workaround).

function telegramAuthMetadata(tgUser: TelegramUser): Record<string, unknown> {
  return {
    telegram_id: tgUser.id,
    telegram_username: tgUser.username || null,
    telegram_photo_url: tgUser.photo_url || null,
    photo_url: tgUser.photo_url || null,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name || null,
    auth_type: 'telegram',
  }
}

async function updateTelegramAuthMetadata(userId: string, tgUser: TelegramUser) {
  try {
    const { data: authUser, error: lookupError } = await supabaseAdmin.auth.admin
      .getUserById(userId)
    if (lookupError) {
      console.error('[tg-auth] auth metadata lookup failed:', lookupError.message)
      return
    }

    const existingMetadata = authUser?.user?.user_metadata || {}
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        ...telegramAuthMetadata(tgUser),
      },
    })

    if (updateError) {
      console.error('[tg-auth] auth metadata update failed:', updateError.message)
    }
  } catch (error) {
    console.error('[tg-auth] auth metadata update crashed:', error)
  }
}

// Referral code lookup.
export async function resolveReferrer(
  startParam: string | undefined,
): Promise<string | null> {
  if (!startParam) return null
  const code = (startParam.startsWith('ref_') ? startParam.slice(4) : startParam).trim()
  if (code.length < 3 || code.length > 8) return null

  const { data: ref, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('referral_code', code)
    .single()
  if (error && error.code !== 'PGRST116') {
    console.error('[tg-auth] resolveReferrer DB error:', error.message)
  }
  return ref?.id ?? null
}

// ── Find or create the profile row for a given TG user ───────────────────────
// Existing match keyed by `telegram_chat_id`. Returns the bits installSession
// needs to issue a session.

export async function findOrCreateTelegramProfile(opts: {
  tgUser: TelegramUser
  referrerId: string | null
}): Promise<{ profileId: string; email: string | null; isNew: boolean }> {
  const { tgUser, referrerId } = opts

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, email, referrer_id')
    .eq('telegram_chat_id', tgUser.id)
    .single()

  if (existing) {
    const profilePatch: Record<string, unknown> = {
      telegram_username: tgUser.username || null,
      telegram_photo_url: tgUser.photo_url || null,
      telegram_verified: true,
    }

    // Only attribute when this user has no referrer yet and it's not self-ref.
    if (referrerId && !existing.referrer_id && referrerId !== existing.id) {
      profilePatch.referrer_id = referrerId
    }

    const [{ error: updateErr }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .update(profilePatch)
        .eq('id', existing.id),
      updateTelegramAuthMetadata(existing.id, tgUser),
    ])
    if (updateErr) {
      console.error('[tg-auth] returning user update failed:', updateErr.message)
    }

    return { profileId: existing.id, email: existing.email, isNew: false }
  }

  return await createTelegramProfile(tgUser, referrerId)
}

async function createTelegramProfile(
  tgUser: TelegramUser,
  referrerId: string | null,
): Promise<{ profileId: string; email: string; isNew: true }> {
  const syntheticEmail = `tg_${tgUser.id}@telegram.polnation.com`
  const randomPassword = crypto.randomUUID() + crypto.randomUUID()
  const usernameFallback = tgUser.username || `tg_${String(tgUser.id).slice(-6)}`

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    password: randomPassword,
    email_confirm: true,
    user_metadata: {
      ...telegramAuthMetadata(tgUser),
      referrer_id: referrerId,
    },
  })

  if (authError || !authUser.user) {
    console.error('TG createUser failed:', authError)
    throw new TelegramAuthError('create_user_failed', 500, authError?.message)
  }

  const userId = authUser.user.id

  // Poll for the profile-creation trigger (50ms × up to 6 attempts = max 300ms).
  // Bails early once the row appears.
  let existingProfile: { id: string; referral_code: string | null } | null = null
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, referral_code')
      .eq('id', userId)
      .single()
    if (data) {
      existingProfile = data
      break
    }
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
    // Trigger didn't fire (or hit its EXCEPTION branch) — insert manually.
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email: syntheticEmail,
      referral_code: generateReferralCode(),
      ...profileFields,
    })
    if (insertError) {
      console.error('TG profile insert error:', insertError)
      throw new TelegramAuthError('create_profile_failed', 500, insertError.message)
    }
  }

  return { profileId: userId, email: syntheticEmail, isNew: true }
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ── Install session server-side ──────────────────────────────────────────────
// Generate magic-link OTP, then verify it via the SSR client so session cookies
// are written directly to the response. Avoids a client-side verifyOtp roundtrip.

export async function installTelegramSession(opts: {
  email: string | null
  userId: string
  isNewUser: boolean
}): Promise<NextResponse> {
  const { email, userId, isNewUser } = opts
  const loginEmail = email || `tg_unknown_${userId.slice(0, 8)}@telegram.polnation.com`

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: loginEmail,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('TG magic link error:', linkError)
    return NextResponse.json({ error: 'login_failed' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    },
  )

  const { error: verifyErr } = await ssrClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })

  if (verifyErr) {
    console.error('TG verifyOtp error:', verifyErr)
    return NextResponse.json({ error: 'verify_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, isNewUser, userId })
}
