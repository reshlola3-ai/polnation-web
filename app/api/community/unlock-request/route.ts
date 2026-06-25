import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getSupabaseUser() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { user: null }
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll() } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return { user }
}

// Current locked balance + any open unlock request (for the user-facing card)
export async function GET() {
  const { user } = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

  const { data: profits } = await supabase
    .from('user_profits')
    .select('community_locked_usdc')
    .eq('user_id', user.id)
    .single()

  const { data: request } = await supabase
    .from('community_unlock_requests')
    .select('id, requested_amount, credited_amount, status, rejected_reason, created_at, reviewed_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    locked: Number(profits?.community_locked_usdc || 0),
    request: request || null,
  })
}

// User asks to unlock their locked community salary → creates a pending request.
// The amount is read from the DB server-side; nothing the client sends is trusted.
export async function POST() {
  const { user } = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

  try {
    // Server-authoritative locked balance
    const { data: profits } = await supabase
      .from('user_profits')
      .select('community_locked_usdc')
      .eq('user_id', user.id)
      .single()

    const locked = Number(profits?.community_locked_usdc || 0)
    if (locked <= 0) {
      return NextResponse.json({ error: 'no_locked_balance' }, { status: 400 })
    }

    // Block duplicate open requests
    const { data: existing } = await supabase
      .from('community_unlock_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'request_pending' }, { status: 409 })
    }

    const { error: insertErr } = await supabase
      .from('community_unlock_requests')
      .insert({
        user_id: user.id,
        requested_amount: locked,
        status: 'pending',
      })

    // Unique partial index may race two concurrent requests → treat as pending
    if (insertErr) {
      return NextResponse.json({ error: 'request_pending' }, { status: 409 })
    }

    return NextResponse.json({ success: true, requested_amount: locked })
  } catch (error) {
    console.error('Unlock request error:', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }
}
