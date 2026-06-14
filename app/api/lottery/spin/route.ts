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
// `electronics` is a physical prize — admin handles fulfillment manually.
// Query `lottery_records WHERE prize_type='electronics' AND reward_credited=false`
// to see pending shipments; flip reward_credited=true once delivered.
const PRIZES = [
  { type: 'thanks', label: 'Try Again', amount: 0, weight: 40 },
  { type: 'bonus_1', label: '+$1 Bonus', amount: 1, weight: 20 },
  { type: 'bonus_2', label: '+$2 Bonus', amount: 2, weight: 10 },
  { type: 'bonus_3', label: '+$3 Bonus', amount: 3, weight: 5 },
  { type: 'usdc_05', label: '$0.50 USDC', amount: 0.5, weight: 15.45 },
  { type: 'usdc_1', label: '$1 USDC', amount: 1, weight: 7 },
  { type: 'usdc_5', label: '$5 USDC', amount: 5, weight: 2.5 },
  { type: 'electronics', label: 'Premium Electronics', amount: 0, weight: 0.05 },
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

  // ========== 读取当前次数 ==========
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

  const remaining = (spinData.total_spins || 0) - (spinData.used_spins || 0)
  if (remaining <= 0) {
    return NextResponse.json({ error: 'no_spins' }, { status: 400 })
  }

  // ========== 原子扣减：乐观锁 ==========
  // 只在 used_spins 未被其他请求修改时才更新（防并发双消耗）
  const { data: claimed } = await admin
    .from('user_lottery_spins')
    .update({
      used_spins: spinData.used_spins + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('used_spins', spinData.used_spins) // 乐观锁：若已被其他请求修改则无匹配行
    .select('id')
    .single()

  if (!claimed) {
    // 另一个并发请求抢先消耗了次数
    return NextResponse.json({ error: 'no_spins' }, { status: 400 })
  }

  // ========== 抽奖 ==========
  // 首抽必中：用户第一次 spin（还没有任何抽奖记录）保底 $0.05 USDC，可直接提现。
  // type 用 'usdc_05' 让转盘停在 USDC 中奖格；金额/标签覆盖为 $0.05。
  const { count: priorSpins } = await admin
    .from('lottery_records')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const isFirstSpin = (priorSpins || 0) === 0

  const prize = isFirstSpin
    ? { type: 'usdc_005', label: '$0.05 USDC', amount: 0.05 }
    : pickPrize()

  // 记录抽奖结果，返回 id 用于后续精确标记
  const { data: record, error: insertError } = await admin
    .from('lottery_records')
    .insert({
      user_id: user.id,
      prize_type: prize.type,
      prize_label: prize.label,
      prize_amount: prize.amount,
      reward_credited: false,
    })
    .select('id')
    .single()

  if (insertError || !record) {
    console.error('Lottery insert error:', insertError)
    // 插入失败：退还次数
    await admin
      .from('user_lottery_spins')
      .update({ used_spins: spinData.used_spins })
      .eq('user_id', user.id)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  // ========== 发放奖励 ==========
  let rewardCredited = false

  if (prize.type === 'thanks') {
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

  // 精确标记该条记录（使用 id，不用 order+limit）
  if (rewardCredited) {
    await admin
      .from('lottery_records')
      .update({ reward_credited: true })
      .eq('id', record.id)
  }

  // ========== 每日连胜：连3天 +1抽奖，连7天 +$0.5（每个周期各一次） ==========
  let streak = spinData.current_streak || 0
  let streakSpinAwarded = false
  let streakUsdcAwarded = 0
  const todayStr = new Date().toISOString().slice(0, 10)
  if (spinData.last_spin_date !== todayStr) {
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    streak = spinData.last_spin_date === yesterdayStr ? streak + 1 : 1

    const streakUpdate: Record<string, unknown> = {
      last_spin_date: todayStr,
      current_streak: streak,
      updated_at: new Date().toISOString(),
    }
    if (streak === 3) {
      const { data: fresh } = await admin
        .from('user_lottery_spins')
        .select('total_spins')
        .eq('user_id', user.id)
        .single()
      streakUpdate.total_spins = (Number(fresh?.total_spins) || 0) + 1
      streakSpinAwarded = true
    }
    await admin.from('user_lottery_spins').update(streakUpdate).eq('user_id', user.id)

    if (streak === 7) {
      const { data: sp } = await admin
        .from('user_profits')
        .select('available_usdc, total_earned_usdc')
        .eq('user_id', user.id)
        .single()
      if (sp) {
        await admin
          .from('user_profits')
          .update({
            available_usdc: (Number(sp.available_usdc) || 0) + 0.5,
            total_earned_usdc: (Number(sp.total_earned_usdc) || 0) + 0.5,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await admin.from('user_profits').insert({
          user_id: user.id,
          available_usdc: 0.5,
          total_earned_usdc: 0.5,
          available_matic: 0,
          withdrawn_usdc: 0,
          withdrawn_matic: 0,
        })
      }
      streakUsdcAwarded = 0.5
    }
  }

  return NextResponse.json({
    prize_type: prize.type,
    prize_label: prize.label,
    prize_amount: prize.amount,
    reward_credited: rewardCredited,
    first_spin: isFirstSpin,
    streak,
    streak_spin_awarded: streakSpinAwarded,
    streak_usdc_awarded: streakUsdcAwarded,
  })
}
