import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

// POST: Claim referral bonus
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // Get pending referral bonuses
    const { data: pendingBonuses, error: fetchError } = await supabaseAdmin
      .from('referral_task_bonus')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch bonuses' }, { status: 500 })
    }

    if (!pendingBonuses || pendingBonuses.length === 0) {
      return NextResponse.json({ error: 'No pending referral bonuses to claim' }, { status: 400 })
    }

    const totalBonus = pendingBonuses.reduce((sum, b) => sum + Number(b.bonus_amount), 0)
    const now = new Date().toISOString()

    // Update all pending bonuses to claimed
    const { error: updateError } = await supabaseAdmin
      .from('referral_task_bonus')
      .update({
        status: 'claimed',
        claimed_at: now,
      })
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to claim bonuses' }, { status: 500 })
    }

    // Add to user_task_progress (unlock progress)
    const { data: progress } = await supabaseAdmin
      .from('user_task_progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (progress) {
      await supabaseAdmin
        .from('user_task_progress')
        .update({
          total_task_bonus: (progress.total_task_bonus || 0) + totalBonus,
          updated_at: now,
        })
        .eq('user_id', user.id)
    } else {
      await supabaseAdmin
        .from('user_task_progress')
        .insert({
          user_id: user.id,
          total_task_bonus: totalBonus,
        })
    }

    return NextResponse.json({
      success: true,
      claimed_count: pendingBonuses.length,
      claimed_amount: totalBonus,
      message: `Claimed $${totalBonus} referral bonus! Added to unlock progress.`,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to claim bonuses' }, { status: 500 })
  }
}
