import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  return !!session
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

    // 计算每个用户的收益
    const calculations: Array<{
      user_id: string
      username: string
      email: string
      level: number
      level_name: string
      reward_pool: number
      daily_rate: number
      earning_amount: number
      already_earned_today: boolean
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

      const earningAmount = levelInfo.reward_pool * levelInfo.daily_rate

      calculations.push({
        user_id: status.user_id,
        username: status.profiles?.username || status.profiles?.email || 'Unknown',
        email: status.profiles?.email || '',
        level: status.current_level,
        level_name: levelInfo.name,
        reward_pool: levelInfo.reward_pool,
        daily_rate: levelInfo.daily_rate,
        earning_amount: earningAmount,
        already_earned_today: !!existingEarning,
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
      })
    }

    // 实际发放
    let processedCount = 0
    let distributedAmount = 0

    for (const calc of calculations) {
      if (calc.already_earned_today) continue

      // 创建每日收益记录
      await supabaseAdmin
        .from('community_daily_earnings')
        .insert({
          user_id: calc.user_id,
          earning_date: today,
          level: calc.level,
          reward_pool: calc.reward_pool,
          daily_rate: calc.daily_rate,
          earning_amount: calc.earning_amount,
          is_credited: true,
          credited_at: new Date().toISOString(),
        })

      // 更新用户利润账户
      const { data: profits } = await supabaseAdmin
        .from('user_profits')
        .select('*')
        .eq('user_id', calc.user_id)
        .single()

      if (profits) {
        await supabaseAdmin
          .from('user_profits')
          .update({
            available_usdc: profits.available_usdc + calc.earning_amount,
            total_earned_usdc: profits.total_earned_usdc + calc.earning_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', calc.user_id)
      } else {
        await supabaseAdmin
          .from('user_profits')
          .insert({
            user_id: calc.user_id,
            available_usdc: calc.earning_amount,
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
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', calc.user_id)

      processedCount++
      distributedAmount += calc.earning_amount
    }

    return NextResponse.json({
      success: true,
      date: today,
      processed_count: processedCount,
      distributed_amount: distributedAmount.toFixed(6),
      users: calculations,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Distribution failed' }, { status: 500 })
  }
}
