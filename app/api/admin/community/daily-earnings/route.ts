import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { advanceMaintenanceClaims } from '@/lib/community-maintenance'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}


// 计算并发放每日社群收益
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { preview } = await request.json()
    const today = new Date().toISOString().split('T')[0]

    // 获取所有有等级的用户
    const { data: statuses } = await supabaseAdmin
      .from('user_community_status')
      .select(`
        *,
        profiles:user_id (username, email)
      `)
      .gt('current_level', 0)

    if (!statuses || statuses.length === 0) {
      return NextResponse.json({
        message: 'No eligible users found',
        users: [],
        total_earnings: 0,
      })
    }

    // 获取等级配置
    const { data: levels } = await supabaseAdmin
      .from('community_levels')
      .select('*')
      .order('level')

    const levelMap = new Map(levels?.map(l => [l.level, l]) || [])

    // Influencer-lock tunables: admin-set users at >= minLevel have their daily
    // earning gated by "movement" — L1-3 team volume must grow that day by more
    // than naturalGrowthRate × yesterday's snapshot, else the earning is locked.
    const { data: cfg } = await supabaseAdmin
      .from('airdrop_config')
      .select('influencer_lock_min_level')
      .single()
    // 工资放行门槛:L1-3 团队当期新增入金必须 > $20(绝对金额),否则锁定。
    const MIN_TEAM_GROWTH_USD = 20
    const lockMinLevel = Number(cfg?.influencer_lock_min_level ?? 3)
    // Momentum: 团队 L1-3 业绩需增长 > 3%(高于自然复利)才算新业绩;否则倍率衰减。
    const MOMENTUM_MIN_GROWTH_RATE = 0.03

    // 计算每个用户的收益（含 Momentum Multiplier）
    const calculations: Array<{
      user_id: string
      username: string
      email: string
      level: number
      level_name: string
      reward_pool: number
      daily_rate: number
      earning_amount: number
      base_earning: number
      momentum_multiplier: number
      momentum_ref_at: string | null
      already_earned_today: boolean
      locked: boolean
      today_volume: number
    }> = []

    let totalEarnings = 0

    for (const status of statuses) {
      const levelInfo = levelMap.get(status.current_level)
      if (!levelInfo || levelInfo.daily_rate <= 0) continue

      // 检查今天是否已经发放
      const { data: existingEarning } = await supabaseAdmin
        .from('community_daily_earnings')
        .select('id')
        .eq('user_id', status.user_id)
        .eq('earning_date', today)
        .single()

      // L1-3 团队当期增长(相对上次快照),供 momentum 与锁定门控共用。
      const todayVol = Number(status.team_volume_l123) || 0
      const prevVol = status.last_volume_snapshot != null
        ? Number(status.last_volume_snapshot)
        : todayVol // no baseline yet → delta 0
      const newDeposits = todayVol - prevVol
      const growthPct = prevVol > 0 ? newDeposits / prevVol : 0

      // ★ Momentum 倍率 ★：团队较上次快照增长 > 3% → 恢复 1.0;否则在上次倍率基础上
      // 每次发放 -0.2(可归零停发)。从上次存的倍率递减，天然覆盖"从没达标过"的人。
      const momentumQualifies = growthPct > MOMENTUM_MIN_GROWTH_RATE
      const prevMomentum = Number(status.momentum_multiplier ?? 1.0)
      const momentum = momentumQualifies ? 1.0 : Math.max(0, parseFloat((prevMomentum - 0.2).toFixed(1)))
      const momentumRefAt = momentumQualifies ? new Date().toISOString() : (status.momentum_last_referral_at ?? null)

      const baseEarning = levelInfo.reward_pool * levelInfo.daily_rate
      const earningAmount = baseEarning * momentum

      // Movement gate: only admin-set users at >= lockMinLevel are subject to
      // locking. Salary is withdrawable only if L1-3 team gained more than
      // MIN_TEAM_GROWTH_USD ($20 new deposits) since last snapshot; else locked.
      const isGated = !!status.is_admin_set && Number(status.current_level) >= lockMinLevel
      const locked = isGated ? !(newDeposits > MIN_TEAM_GROWTH_USD) : false

      calculations.push({
        user_id: status.user_id,
        username: status.profiles?.username || status.profiles?.email || 'Unknown',
        email: status.profiles?.email || '',
        level: status.current_level,
        level_name: levelInfo.name,
        reward_pool: levelInfo.reward_pool,
        daily_rate: levelInfo.daily_rate,
        earning_amount: earningAmount,
        base_earning: baseEarning,
        momentum_multiplier: momentum,
        momentum_ref_at: momentumRefAt,
        already_earned_today: !!existingEarning,
        locked,
        today_volume: todayVol,
      })

      if (!existingEarning) {
        totalEarnings += earningAmount
      }
    }

    // 预览模式
    if (preview) {
      return NextResponse.json({
        preview: true,
        date: today,
        users: calculations,
        total_earnings: totalEarnings,
        users_to_process: calculations.filter(c => !c.already_earned_today).length,
        locked_to_process: calculations.filter(c => !c.already_earned_today && c.locked).length,
      })
    }

    // 实际发放
    let processedCount = 0
    let distributedAmount = 0

    for (const calc of calculations) {
      if (calc.already_earned_today) continue

      // 创建每日收益记录（含 momentum）
      await supabaseAdmin
        .from('community_daily_earnings')
        .insert({
          user_id: calc.user_id,
          earning_date: today,
          level: calc.level,
          reward_pool: calc.reward_pool,
          daily_rate: calc.daily_rate,
          earning_amount: calc.earning_amount,
          momentum_multiplier: calc.momentum_multiplier,
          is_credited: true,
          credited_at: new Date().toISOString(),
        })

      // 更新用户利润账户
      const { data: profits } = await supabaseAdmin
        .from('user_profits')
        .select('*')
        .eq('user_id', calc.user_id)
        .single()

      // Route the earning: locked → community_locked_usdc (needs admin unlock),
      // otherwise → available_usdc (withdrawable). total_earned counts both.
      const creditAvailable = calc.locked ? 0 : calc.earning_amount
      const creditLocked = calc.locked ? calc.earning_amount : 0

      if (profits) {
        await supabaseAdmin
          .from('user_profits')
          .update({
            available_usdc: Number(profits.available_usdc || 0) + creditAvailable,
            community_locked_usdc: Number(profits.community_locked_usdc || 0) + creditLocked,
            total_earned_usdc: Number(profits.total_earned_usdc || 0) + calc.earning_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', calc.user_id)
      } else {
        await supabaseAdmin
          .from('user_profits')
          .insert({
            user_id: calc.user_id,
            available_usdc: creditAvailable,
            community_locked_usdc: creditLocked,
            total_earned_usdc: calc.earning_amount,
            available_matic: 0,
            withdrawn_usdc: 0,
            withdrawn_matic: 0,
          })
      }

      // 更新社群账户累计收益
      const { data: status } = await supabaseAdmin
        .from('user_community_status')
        .select('total_community_earned')
        .eq('user_id', calc.user_id)
        .single()

      await supabaseAdmin
        .from('user_community_status')
        .update({
          total_community_earned: (status?.total_community_earned || 0) + calc.earning_amount,
          last_daily_earning_date: today,
          momentum_multiplier: calc.momentum_multiplier,
          momentum_last_referral_at: calc.momentum_ref_at, // 仅增长达标时刷成 now
          momentum_updated_at: new Date().toISOString(),
          // advance the movement baseline to today's volume
          last_volume_snapshot: calc.today_volume,
          last_volume_snapshot_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', calc.user_id)

      processedCount++
      distributedAmount += calc.earning_amount
    }

    // 推进 Bonus 维持期（每达标一天 +1；达标天数够 或 staking≥50% → 放行奖金）
    let maintenanceReleased = 0
    try {
      const r = await advanceMaintenanceClaims(supabaseAdmin)
      maintenanceReleased = r.released
    } catch (e) {
      console.error('advanceMaintenanceClaims failed:', e)
    }

    return NextResponse.json({
      success: true,
      date: today,
      processed_count: processedCount,
      distributed_amount: distributedAmount.toFixed(6),
      locked_count: calculations.filter(c => c.locked && !c.already_earned_today).length,
      maintenance_released: maintenanceReleased,
      users: calculations,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Distribution failed' }, { status: 500 })
  }
}

