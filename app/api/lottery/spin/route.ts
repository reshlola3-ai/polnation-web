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

  // ========== 检查可用抽奖次数 ==========
  const { data: spinData } = await admin
    .from('user_lottery_spins')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // 如果没有记录，创建一条（默认 0 次）
  if (!spinData) {
    await admin
      .from('user_lottery_spins')
      .insert({ user_id: user.id, total_spins: 0, used_spins: 0, is_influencer: false })

    return NextResponse.json({ error: 'no_spins' }, { status: 400 })
  }

  // 所有人都按 total_spins - used_spins 检查（包括 influencer）
  const remainingSpins = (spinData.total_spins || 0) - (spinData.used_spins || 0)

  if (remainingSpins <= 0) {
    return NextResponse.json({ error: 'no_spins' }, { status: 400 })
  }

  // ========== 抽奖 ==========
  const prize = pickPrize()

  // 记录抽奖结果
  const { error: insertError } = await admin
    .from('lottery_records')
    .insert({
      user_id: user.id,
      prize_type: prize.type,
      prize_label: prize.label,
      prize_amount: prize.amount,
      reward_credited: false,
    })

  if (insertError) {
    console.error('Lottery insert error:', insertError)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  // 扣减次数（influencer 也记录使用次数，但不会被限制）
  await admin
    .from('user_lottery_spins')
    .update({
      used_spins: (spinData.used_spins || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // ========== 发放奖励 ==========
  let rewardCredited = false

  if (prize.type === 'thanks') {
    // 没中奖，不需要发放
    rewardCredited = true
  } else if (prize.type.startsWith('bonus_')) {
    // Bonus → 进入 unlock progress (user_task_progress.total_task_bonus)
    try {
      const { data: progress } = await admin
        .from('user_task_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (progress) {
        await admin
          .from('user_task_progress')
          .update({
            total_task_bonus: (Number(progress.total_task_bonus) || 0) + prize.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await admin
          .from('user_task_progress')
          .insert({
            user_id: user.id,
            total_task_bonus: prize.amount,
          })
      }
      rewardCredited = true
    } catch (err) {
      console.error('Bonus credit error:', err)
    }
  } else if (prize.type.startsWith('usdc_')) {
    // USDC → 进入 withdrawable (user_profits.available_usdc)
    try {
      const { data: profits } = await admin
        .from('user_profits')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profits) {
        await admin
          .from('user_profits')
          .update({
            total_earned_usdc: (Number(profits.total_earned_usdc) || 0) + prize.amount,
            available_usdc: (Number(profits.available_usdc) || 0) + prize.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await admin
          .from('user_profits')
          .insert({
            user_id: user.id,
            total_earned_usdc: prize.amount,
            available_usdc: prize.amount,
            available_matic: 0,
            withdrawn_usdc: 0,
            withdrawn_matic: 0,
          })
      }
      rewardCredited = true
    } catch (err) {
      console.error('USDC credit error:', err)
    }
  }

  // 标记奖励已发放
  if (rewardCredited) {
    await admin
      .from('lottery_records')
      .update({ reward_credited: true })
      .eq('user_id', user.id)
      .eq('reward_credited', false)
      .order('created_at', { ascending: false })
      .limit(1)
  }

  return NextResponse.json({
    prize_type: prize.type,
    prize_label: prize.label,
    prize_amount: prize.amount,
    reward_credited: rewardCredited,
  })
}
