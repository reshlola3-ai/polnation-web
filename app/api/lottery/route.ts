import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET: Check if user can spin today & get history
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  // Check today's spins
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data: todaySpins } = await admin
    .from('lottery_records')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())

  const spinsUsed = todaySpins?.length || 0
  const canSpin = spinsUsed < 1

  // Get recent history (last 10)
  const { data: history } = await admin
    .from('lottery_records')
    .select('id, prize_type, prize_label, prize_amount, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    canSpin,
    spinsUsed,
    history: history || [],
  })
}
