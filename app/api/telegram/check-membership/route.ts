import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Check whether the authenticated user has joined the required TG group.
// Used to gate the withdraw flow inside /lottery-mini.
//
// Env contract:
//   TELEGRAM_REQUIRED_CHAT_ID  — e.g. "-1001234567890" (supergroups are negative)
//   TELEGRAM_GROUP_INVITE_LINK — e.g. "https://t.me/polnation_official"
// If either is missing, membership is treated as "not configured" → caller may
// skip the gate. This keeps dev / preview environments unblocked.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const chatId = process.env.TELEGRAM_REQUIRED_CHAT_ID
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const inviteLink = process.env.TELEGRAM_GROUP_INVITE_LINK || null

  if (!chatId || !botToken) {
    return NextResponse.json({ configured: false, isMember: true, inviteLink })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', user.id)
    .single()

  // No TG-bound profile → cannot be a member of a TG group
  if (!profile?.telegram_chat_id) {
    return NextResponse.json({ configured: true, isMember: false, inviteLink, reason: 'no_telegram_id' })
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${profile.telegram_chat_id}`
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (!data.ok) {
      // Bot not in the group, or bad chat_id → log and fail closed
      console.error('getChatMember failed:', data)
      return NextResponse.json({ configured: true, isMember: false, inviteLink, reason: 'tg_api_error' })
    }

    // Statuses where the user is considered "in" the group:
    //   creator, administrator, member, restricted (still a member, just limited)
    // Statuses for "out": left, kicked
    const status = data.result?.status as string | undefined
    const isMember = status === 'creator' || status === 'administrator' || status === 'member' || status === 'restricted'

    return NextResponse.json({ configured: true, isMember, inviteLink, status })
  } catch (err) {
    console.error('check-membership error:', err)
    return NextResponse.json({ configured: true, isMember: false, inviteLink, reason: 'fetch_failed' })
  }
}
