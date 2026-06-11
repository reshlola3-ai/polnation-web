import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { ALPHA_TIERS } from '@/lib/alphastake'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// AlphaStake 单仓位发放预览/结果
interface AlphaCalc {
  position_id: number
  user_id: string | null
  username: string
  email: string
  wallet: string
  principal_usdc: number
  tier_id: number
  tier_days: number
  daily_rate_bps: number
  earning_amount: number
  already_earned_today: boolean
  unmatched: boolean
}

// 入账用户利润账户（与社群收益同一可提现池）
async function creditUserProfit(supabaseAdmin: SupabaseClient, userId: string, amount: number) {
  const { data: profits } = await supabaseAdmin
    .from('user_profits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (profits) {
    await supabaseAdmin
      .from('user_profits')
      .update({
        available_usdc: profits.available_usdc + amount,
        total_earned_usdc: profits.total_earned_usdc + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  } else {
    await supabaseAdmin
      .from('user_profits')
      .insert({
        user_id: userId,
        available_usdc: amount,
        total_earned_usdc: amount,
        available_matic: 0,
        withdrawn_usdc: 0,
        withdrawn_matic: 0,
      })
  }
}

// 计算 AlphaStake 每日利润：链上开放且未到期的仓位，按 tier 日利率发放，每仓位每天一次
async function calculateAlphaEarnings(supabaseAdmin: SupabaseClient, today: string) {
  const calcs: AlphaCalc[] = []
  let total = 0

  const chain = await fetchOnChainAlphaSummary()
  if (!chain.configured) {
    return { calcs, total, error: null as string | null, configured: false }
  }

  const { data: walletProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email, wallet_address')
    .not('wallet_address', 'is', null)

  const byWallet = new Map<string, { id: string; username: string | null; email: string | null }>()
  for (const p of walletProfiles || []) {
    if (p.wallet_address) byWallet.set(p.wallet_address.toLowerCase(), p)
  }

  const { data: existingAlpha, error: alphaTableErr } = await supabaseAdmin
    .from('alpha_stake_daily_earnings')
    .select('position_id')
    .eq('earning_date', today)

  if (alphaTableErr) {
    throw new Error(
      alphaTableErr.message.includes('does not exist')
        ? 'alpha_stake_daily_earnings 表不存在，请先在 Supabase 执行 supabase/alpha-stake-earnings-schema.sql'
        : alphaTableErr.message
    )
  }

  const alreadyPaid = new Set((existingAlpha || []).map(r => r.position_id as number))
  const nowMs = Date.now()

  for (const pos of chain.positions) {
    if (pos.closed) continue
    // 已到期的仓位停止计息（与用户端 ticker 的封顶一致）
    if (new Date(pos.unlockTime).getTime() <= nowMs) continue

    const tier = ALPHA_TIERS[pos.tierId] ?? ALPHA_TIERS[0]
    const profile = byWallet.get(pos.user)
    const amount = (pos.amountUsdc * tier.dailyRateBps) / 10000

    calcs.push({
      position_id: pos.positionId,
      user_id: profile?.id ?? null,
      username: profile?.username || profile?.email || pos.user,
      email: profile?.email || '',
      wallet: pos.user,
      principal_usdc: pos.amountUsdc,
      tier_id: pos.tierId,
      tier_days: pos.tierDays,
      daily_rate_bps: tier.dailyRateBps,
      earning_amount: amount,
      already_earned_today: alreadyPaid.has(pos.positionId),
      unmatched: !profile,
    })

    if (profile && !alreadyPaid.has(pos.positionId)) {
      total += amount
    }
  }

  return { calcs, total, error: null as string | null, configured: true }
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

      // ★ 计算 Momentum Multiplier — 默认 5.0x ★
      const momentum = calculateMomentumMultiplier(
        status.momentum_last_referral_at ? new Date(status.momentum_last_referral_at) : null
      )

      const baseEarning = levelInfo.reward_pool * levelInfo.daily_rate
      const earningAmount = baseEarning * momentum

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
        already_earned_today: !!existingEarning,
      })

      if (!existingEarning) {
        totalEarnings += earningAmount
      }
    }

    // ===== AlphaStake 每日利润（链上仓位） =====
    let alphaCalcs: AlphaCalc[] = []
    let alphaTotal = 0
    let alphaError: string | null = null
    let alphaConfigured = false
    try {
      const alpha = await calculateAlphaEarnings(supabaseAdmin, today)
      alphaCalcs = alpha.calcs
      alphaTotal = alpha.total
      alphaConfigured = alpha.configured
    } catch (e) {
      // 链上读取/表缺失等问题不阻塞社群收益发放，单独报告
      alphaError = e instanceof Error ? e.message : 'AlphaStake 数据读取失败'
      console.error('AlphaStake daily earnings calc failed:', e)
    }

    const alphaSection = {
      configured: alphaConfigured,
      error: alphaError,
      users: alphaCalcs,
      total: alphaTotal,
      to_process: alphaCalcs.filter(c => !c.already_earned_today && !c.unmatched).length,
      unmatched_count: alphaCalcs.filter(c => c.unmatched).length,
    }

    // 预览模式
    if (preview) {
      return NextResponse.json({
        preview: true,
        date: today,
        users: calculations,
        total_earnings: totalEarnings,
        users_to_process: calculations.filter(c => !c.already_earned_today).length,
        alpha: alphaSection,
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
          momentum_multiplier: calc.momentum_multiplier,
          momentum_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', calc.user_id)

      processedCount++
      distributedAmount += calc.earning_amount
    }

    // ===== 发放 AlphaStake 利润 =====
    let alphaProcessedCount = 0
    let alphaDistributedAmount = 0

    if (!alphaError) {
      for (const calc of alphaCalcs) {
        if (!calc.user_id || calc.already_earned_today || calc.unmatched) continue

        // 先写记录：UNIQUE(position_id, earning_date) 防并发/重复发放
        const { error: insErr } = await supabaseAdmin
          .from('alpha_stake_daily_earnings')
          .insert({
            user_id: calc.user_id,
            wallet_address: calc.wallet,
            position_id: calc.position_id,
            earning_date: today,
            principal_usdc: calc.principal_usdc,
            tier_id: calc.tier_id,
            daily_rate_bps: calc.daily_rate_bps,
            earning_amount: calc.earning_amount,
            is_credited: true,
            credited_at: new Date().toISOString(),
          })

        if (insErr) {
          // 23505 = 同日已有记录（重复点击/并发），静默跳过；其他错误记录后跳过
          if (insErr.code !== '23505') {
            console.error(`Alpha earning insert failed for position ${calc.position_id}:`, insErr)
          }
          continue
        }

        await creditUserProfit(supabaseAdmin, calc.user_id, calc.earning_amount)

        alphaProcessedCount++
        alphaDistributedAmount += calc.earning_amount
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      processed_count: processedCount,
      distributed_amount: distributedAmount.toFixed(6),
      users: calculations,
      alpha: alphaSection,
      alpha_processed_count: alphaProcessedCount,
      alpha_distributed_amount: alphaDistributedAmount.toFixed(6),
      alpha_error: alphaError,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Distribution failed' }, { status: 500 })
  }
}

// ========== Momentum Multiplier — 初始 1.0x，衰减 -0.2x/3天，最低 0.2x ==========
function calculateMomentumMultiplier(lastReferralAt: Date | null): number {
  // 没有 referral 记录 → 初始 1.0x
  if (!lastReferralAt) return 1.0

  // 有记录后，根据距离上次 referral 的天数衰减
  const daysSinceLast = Math.floor((Date.now() - lastReferralAt.getTime()) / (1000 * 60 * 60 * 24))
  const decaySteps = Math.floor(daysSinceLast / 3)

  return Math.max(0.2, parseFloat((1.0 - decaySteps * 0.2).toFixed(1)))
}
