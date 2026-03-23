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

// GET: Check available spins & get history
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  // 获取用户抽奖次数
  let { data: spinData } = await admin
    .from('user_lottery_spins')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // 如果没有记录，创建一条
  if (!spinData) {
    const { data: newData } = await admin
      .from('user_lottery_spins')
      .insert({ user_id: user.id, total_spins: 0, used_spins: 0, is_influencer: false })
      .select()
      .single()
    spinData = newData
  }

  const isInfluencer = spinData?.is_influencer || false
  const totalSpins = spinData?.total_spins || 0
  const usedSpins = spinData?.used_spins || 0
  const remainingSpins = totalSpins - usedSpins

  // 所有人都按剩余次数判断（管理员可以手动加次数）
  const canSpin = remainingSpins > 0

  // 获取最近抽奖历史（最近 20 条）
  const { data: history } = await admin
    .from('lottery_records')
    .select('id, prize_type, prize_label, prize_amount, reward_credited, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // 获取自己的空投领取次数（用于显示进度）
  const { data: selfAirdrops } = await admin
    .from('airdrop_calculations')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_credited', true)
  const selfAirdropCount = selfAirdrops?.length || 0
  const nextMilestone = (Math.floor(selfAirdropCount / 7) + 1) * 7
  const progressToNextSpin = selfAirdropCount % 7

  return NextResponse.json({
    canSpin,
    isInfluencer,
    totalSpins,
    usedSpins,
    remainingSpins: Math.max(0, remainingSpins),
    selfAirdropCount,
    progressToNextSpin,
    nextMilestone,
    history: history || [],
  })
}
