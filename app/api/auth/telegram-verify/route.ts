import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function generateVerifyCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase()
}

// GET /api/auth/telegram-verify — check verification status
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('telegram_verified, telegram_username')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      verified: !!profile?.telegram_verified,
      username: profile?.telegram_username || null,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/auth/telegram-verify — generate a verification code
export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if already verified
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('telegram_verified')
      .eq('id', user.id)
      .single()

    if (profile?.telegram_verified) {
      return NextResponse.json({ already_verified: true })
    }

    const code = generateVerifyCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min TTL

    await supabaseAdmin
      .from('profiles')
      .update({ telegram_verify_code: code, telegram_verify_expires_at: expiresAt })
      .eq('id', user.id)

    const botName = process.env.TELEGRAM_BOT_USERNAME || 'PolnationBot'
    return NextResponse.json({
      code,
      bot_url: `https://t.me/${botName}?start=${code}`,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
