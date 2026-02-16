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

// Prize configuration with probabilities (must sum to 100)
const PRIZES = [
  { type: 'thanks', label: 'Try Again', amount: 0, weight: 40 },
  { type: 'bonus_1', label: '+$1 Bonus', amount: 1, weight: 20 },
  { type: 'bonus_2', label: '+$2 Bonus', amount: 2, weight: 10 },
  { type: 'bonus_3', label: '+$3 Bonus', amount: 3, weight: 5 },
  { type: 'usdc_05', label: '$0.50 USDC', amount: 0.5, weight: 15 },
  { type: 'usdc_1', label: '$1 USDC', amount: 1, weight: 7 },
  { type: 'usdc_5', label: '$5 USDC', amount: 5, weight: 2.5 },
  { type: 'usdc_10', label: '$10 USDC', amount: 10, weight: 0.5 },
]

function pickPrize() {
  const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const prize of PRIZES) {
    random -= prize.weight
    if (random <= 0) {
      return prize
    }
  }
  
  // Fallback
  return PRIZES[0]
}

// POST: Spin the wheel
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  // Check today's spins (prevent double-spin)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data: todaySpins } = await admin
    .from('lottery_records')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())

  if ((todaySpins?.length || 0) >= 1) {
    return NextResponse.json({ error: 'no_spins' }, { status: 400 })
  }

  // Pick a prize (server-side)
  const prize = pickPrize()

  // Record the spin
  const { error } = await admin
    .from('lottery_records')
    .insert({
      user_id: user.id,
      prize_type: prize.type,
      prize_label: prize.label,
      prize_amount: prize.amount,
    })

  if (error) {
    console.error('Lottery insert error:', error)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  // If won bonus, add to user_task_progress (unlock progress)
  if (prize.type.startsWith('bonus_')) {
    try {
      const { error: rpcError } = await admin.rpc('increment_task_progress', {
        p_user_id: user.id,
        p_amount: prize.amount,
      })
      if (rpcError) {
        // If RPC doesn't exist, try direct upsert
        await admin
          .from('user_task_progress')
          .upsert({
            user_id: user.id,
            total_bonus: prize.amount,
          }, { onConflict: 'user_id' })
      }
    } catch {
      // silent fallback
    }
  }

  return NextResponse.json({
    prize_type: prize.type,
    prize_label: prize.label,
    prize_amount: prize.amount,
  })
}
