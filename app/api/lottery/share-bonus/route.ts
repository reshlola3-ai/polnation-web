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

// POST: 晒中奖分享返奖 —— 每天最多领 1 次额外抽奖次数。
// 防刷：grant_reason='shared_win' + milestone_count=当天(UTC, YYYYMMDD) 去重。
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const now = new Date()
  const todayInt =
    now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate()

  // 确保有 spins 记录
  let { data: spinData } = await admin
    .from('user_lottery_spins')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!spinData) {
    const { data: created } = await admin
      .from('user_lottery_spins')
      .insert({ user_id: user.id, total_spins: 0, used_spins: 0, is_influencer: false })
      .select()
      .single()
    spinData = created
  }

  const usedSpins = spinData?.used_spins || 0

  // 当天是否已经领过分享返奖
  const { data: existing } = await admin
    .from('lottery_spin_grants')
    .select('id')
    .eq('user_id', user.id)
    .eq('grant_reason', 'shared_win')
    .eq('milestone_count', todayInt)
    .maybeSingle()

  if (existing) {
    const remaining = Math.max(0, (spinData?.total_spins || 0) - usedSpins)
    return NextResponse.json({ granted: false, alreadyToday: true, remainingSpins: remaining })
  }

  // 发放 +1 次（先写 grant 去重，再加次数）
  const { error: grantErr } = await admin
    .from('lottery_spin_grants')
    .insert({
      user_id: user.id,
      grant_reason: 'shared_win',
      milestone_count: todayInt,
      spins_granted: 1,
    })

  if (grantErr) {
    // 23505 = 并发下同日重复插入，视为已领
    if (grantErr.code === '23505') {
      const remaining = Math.max(0, (spinData?.total_spins || 0) - usedSpins)
      return NextResponse.json({ granted: false, alreadyToday: true, remainingSpins: remaining })
    }
    console.error('share-bonus grant insert failed:', grantErr)
    return NextResponse.json({ error: 'grant_failed' }, { status: 500 })
  }

  const newTotal = (spinData?.total_spins || 0) + 1
  await admin
    .from('user_lottery_spins')
    .update({ total_spins: newTotal, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({
    granted: true,
    remainingSpins: Math.max(0, newTotal - usedSpins),
  })
}
