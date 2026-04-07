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

interface TelegramAuthData {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  const { hash, ...rest } = data

  // Build data-check-string: sorted key=value pairs joined by \n
  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k as keyof typeof rest]}`)
    .join('\n')

  // Secret key = SHA256(bot_token)
  const secretKey = crypto.createHash('sha256').update(token).digest()
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex')

  // Also check auth_date is not older than 1 day
  const age = Math.floor(Date.now() / 1000) - data.auth_date
  if (age > 86400) return false

  return expectedHash === hash
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: TelegramAuthData = await req.json()

    if (!verifyTelegramAuth(body)) {
      return NextResponse.json({ error: 'Invalid Telegram auth data' }, { status: 400 })
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        telegram_verified: true,
        telegram_chat_id: body.id,
        telegram_username: body.username || body.first_name || String(body.id),
      })
      .eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
