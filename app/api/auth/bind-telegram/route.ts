import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Bind Telegram to existing logged-in account ──────────────────────────────
// Distinct from /api/auth/telegram-widget (which creates/switches sessions).
// This endpoint only attaches a TG identity to the currently-authenticated
// profile. Hard-rejects (409) if the TG account is already bound elsewhere —
// matches the wallet-binding policy: one TG = one Polnation account, no
// transfer.

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
  user?: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
  }
  reason?: string
}

function verifyTelegramLoginWidget(
  payload: Record<string, unknown>,
  botToken: string,
): VerifyResult {
  const hash = typeof payload.hash === 'string' ? payload.hash : null
  if (!hash) return { ok: false, reason: 'no_hash' }

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

  const computedBuf = Buffer.from(computed, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')
  if (computedBuf.length !== hashBuf.length) return { ok: false, reason: 'hash_length_mismatch' }
  if (!crypto.timingSafeEqual(computedBuf, hashBuf)) return { ok: false, reason: 'hash_mismatch' }

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

  return {
    ok: true,
    user: {
      id,
      first_name: firstName,
      last_name: typeof payload.last_name === 'string' ? payload.last_name : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      photo_url: typeof payload.photo_url === 'string' ? payload.photo_url : undefined,
    },
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<WidgetPayload>

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

    // Get the currently authenticated user from session cookies.
    const cookieStore = await cookies()
    const ssrClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )

    const { data: { user }, error: authError } = await ssrClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Uniqueness check: is this telegram_chat_id already on another account?
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('telegram_chat_id', verified.user.id)
      .maybeSingle()

    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: 'telegram_already_bound' }, { status: 409 })
    }

    // Update the current user's profile with the TG identity.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_chat_id: verified.user.id,
        telegram_username: verified.user.username || null,
        telegram_photo_url: verified.user.photo_url || null,
        telegram_verified: true,
      })
      .eq('id', user.id)

    if (updateError) {
      // 23505 = unique_violation — race with concurrent bind from another session.
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'telegram_already_bound' }, { status: 409 })
      }
      console.error('[bind-telegram] update failed:', updateError.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      telegram_username: verified.user.username || null,
    })
  } catch (error) {
    console.error('[bind-telegram] error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
