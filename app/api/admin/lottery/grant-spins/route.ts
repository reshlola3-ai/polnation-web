import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}


// POST: 管理员给用户增加抽奖次数
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { user_id, spins_to_add } = await request.json()

    if (!user_id || !spins_to_add || spins_to_add <= 0) {
      return NextResponse.json({ error: 'user_id and spins_to_add (>0) required' }, { status: 400 })
    }

    // 获取用户名（用于日志）
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user_id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 获取或创建 user_lottery_spins 记录
    let { data: spinData } = await supabase
      .from('user_lottery_spins')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (!spinData) {
      const { data: newData } = await supabase
        .from('user_lottery_spins')
        .insert({ user_id, total_spins: 0, used_spins: 0, is_influencer: false })
        .select()
        .single()
      spinData = newData
    }

    const newTotal = (spinData?.total_spins || 0) + spins_to_add

    // 更新次数
    await supabase
      .from('user_lottery_spins')
      .update({
        total_spins: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)

    // 记录发放日志
    await supabase
      .from('lottery_spin_grants')
      .insert({
        user_id,
        grant_reason: 'admin_grant',
        spins_granted: spins_to_add,
        milestone_count: 0,
      })

    const remaining = newTotal - (spinData?.used_spins || 0)

    return NextResponse.json({
      success: true,
      message: `Granted ${spins_to_add} spins to ${profile.username || profile.email}`,
      user_id,
      total_spins: newTotal,
      used_spins: spinData?.used_spins || 0,
      remaining_spins: remaining,
    })
  } catch (error) {
    console.error('Grant spins error:', error)
    return NextResponse.json({ error: 'Failed to grant spins' }, { status: 500 })
  }
}
