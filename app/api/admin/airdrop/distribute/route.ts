import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface CommissionRate {
  level: number
  rate_percent: number
  is_active: boolean
}

interface UplineInfo {
  upline_id: string
  level: number
}

// 确认发放（将利润写入用户账户 + 推荐佣金）
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { round_id } = await request.json()

    if (!round_id) {
      return NextResponse.json({ error: 'round_id is required' }, { status: 400 })
    }

    // 获取轮次
    const { data: round, error: roundError } = await supabase
      .from('airdrop_rounds')
      .select('*')
      .eq('id', round_id)
      .single()

    if (roundError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    if (round.status !== 'pending') {
      return NextResponse.json({ error: 'Round already processed' }, { status: 400 })
    }

    // 获取计算结果
    const { data: calculations, error: calcError } = await supabase
      .from('airdrop_calculations')
      .select('*')
      .eq('round_id', round_id)
      .eq('is_credited', false)

    if (calcError) throw calcError

    if (!calculations || calculations.length === 0) {
      return NextResponse.json({ error: 'No calculations to distribute' }, { status: 400 })
    }

    // 获取推荐佣金比例
    const { data: commissionRates } = await supabase
      .from('referral_commission_rates')
      .select('*')
      .eq('is_active', true)
      .order('level')

    const ratesMap = new Map<number, number>()
    if (commissionRates) {
      commissionRates.forEach((r: CommissionRate) => {
        ratesMap.set(r.level, r.rate_percent)
      })
    }

    const now = new Date().toISOString()
    let distributedCount = 0
    let totalDistributed = 0
    let totalCommissions = 0
    let commissionCount = 0

    // 为每个用户发放利润
    for (const calc of calculations) {
      try {
        // 获取或创建用户利润记录
        const { data: existingProfit } = await supabase
          .from('user_profits')
          .select('*')
          .eq('user_id', calc.user_id)
          .single()

        if (existingProfit) {
          // 更新现有记录
          await supabase
            .from('user_profits')
            .update({
              total_earned_usdc: existingProfit.total_earned_usdc + calc.profit_usdc,
              available_usdc: existingProfit.available_usdc + calc.profit_usdc,
              current_tier: calc.tier_level,
              updated_at: now,
            })
            .eq('user_id', calc.user_id)
        } else {
          // 创建新记录
          await supabase
            .from('user_profits')
            .insert({
              user_id: calc.user_id,
              total_earned_usdc: calc.profit_usdc,
              available_usdc: calc.profit_usdc,
              available_matic: 0,
              withdrawn_usdc: 0,
              withdrawn_matic: 0,
              current_tier: calc.tier_level,
            })
        }

        // 记录历史
        await supabase
          .from('profit_history')
          .insert({
            user_id: calc.user_id,
            round_id: round_id,
            usdc_balance: calc.usdc_balance,
            tier_level: calc.tier_level,
            rate_applied: calc.rate_percent / 100,
            profit_earned: calc.profit_usdc,
          })

        // 标记已发放
        await supabase
          .from('airdrop_calculations')
          .update({ is_credited: true })
          .eq('id', calc.id)

        distributedCount++
        totalDistributed += calc.profit_usdc

        // ========== 计算并发放推荐佣金 ==========
        if (ratesMap.size > 0 && calc.profit_usdc > 0) {
          // 获取用户的上线链
          const { data: uplineChain } = await supabase
            .rpc('get_upline_chain', { 
              user_id: calc.user_id,
              max_levels: 6
            })

          if (uplineChain && uplineChain.length > 0) {
            for (const upline of uplineChain as UplineInfo[]) {
              const rate = ratesMap.get(upline.level)
              if (!rate) continue

              // 计算佣金
              const commissionAmount = calc.profit_usdc * (rate / 100)
              
              if (commissionAmount <= 0) continue

              // 记录佣金
              await supabase
                .from('referral_commissions')
                .insert({
                  beneficiary_id: upline.upline_id,
                  source_user_id: calc.user_id,
                  round_id: round_id,
                  level: upline.level,
                  source_profit: calc.profit_usdc,
                  commission_rate: rate,
                  commission_amount: commissionAmount,
                  is_credited: true,
                })

              // 获取上线的利润记录
              const { data: uplineProfit } = await supabase
                .from('user_profits')
                .select('*')
                .eq('user_id', upline.upline_id)
                .single()

              if (uplineProfit) {
                // 更新上线的佣金余额
                await supabase
                  .from('user_profits')
                  .update({
                    total_commission_earned: (uplineProfit.total_commission_earned || 0) + commissionAmount,
                    available_usdc: uplineProfit.available_usdc + commissionAmount,
                    updated_at: now,
                  })
                  .eq('user_id', upline.upline_id)
              } else {
                // 创建上线的利润记录
                await supabase
                  .from('user_profits')
                  .insert({
                    user_id: upline.upline_id,
                    total_earned_usdc: 0,
                    total_commission_earned: commissionAmount,
                    available_usdc: commissionAmount,
                    available_matic: 0,
                    withdrawn_usdc: 0,
                    withdrawn_matic: 0,
                  })
              }

              totalCommissions += commissionAmount
              commissionCount++
            }
          }
        }

      } catch (err) {
        console.error(`Error distributing to user ${calc.user_id}:`, err)
      }
    }

    // 更新轮次状态
    await supabase
      .from('airdrop_rounds')
      .update({
        status: 'distributed',
        distributed_at: now,
        distributed_by: 'admin',
      })
      .eq('id', round_id)

    // 更新配置中的最后发放时间
    await supabase
      .from('airdrop_config')
      .update({
        last_distribution_at: now,
        updated_at: now,
      })
      .not('id', 'is', null)

    return NextResponse.json({
      success: true,
      distributed_count: distributedCount,
      total_distributed: totalDistributed.toFixed(6),
      commission_count: commissionCount,
      total_commissions: totalCommissions.toFixed(6),
    })
  } catch (error) {
    console.error('Distribute error:', error)
    return NextResponse.json({ error: 'Distribution failed' }, { status: 500 })
  }
}

// 取消轮次
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const round_id = searchParams.get('round_id')

    if (!round_id) {
      return NextResponse.json({ error: 'round_id is required' }, { status: 400 })
    }

    // 删除佣金记录
    await supabase
      .from('referral_commissions')
      .delete()
      .eq('round_id', round_id)

    // 删除计算结果
    await supabase
      .from('airdrop_calculations')
      .delete()
      .eq('round_id', round_id)

    // 更新轮次状态
    await supabase
      .from('airdrop_rounds')
      .update({ status: 'cancelled' })
      .eq('id', round_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel error:', error)
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 })
  }
}
