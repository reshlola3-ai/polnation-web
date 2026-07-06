import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { refreshAllNaturalLevels } from '@/lib/community-levels-server'
import { advanceMaintenanceClaims } from '@/lib/community-maintenance'

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
  if (!await verifyAdmin()) {
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

        // 记录历史（profit_earned = agentic + 质押合计；alpha_earned = 其中质押部分）
        await supabase
          .from('profit_history')
          .insert({
            user_id: calc.user_id,
            round_id: round_id,
            usdc_balance: calc.usdc_balance,
            tier_level: calc.tier_level,
            rate_applied: calc.rate_percent / 100,
            profit_earned: calc.profit_usdc,
            alpha_earned: Number(calc.alpha_profit_usdc) || 0,
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

    // ========== 先更新所有用户的 momentum 数据 ==========
    try {
      await updateAllMomentumData(supabase, calculations)
    } catch (momentumErr) {
      console.error('Error updating momentum data:', momentumErr)
    }

    // ========== 发放社群收益前，先按链上业绩重算所有自然用户等级 ==========
    // 团队 volume 是缓存值，会随下线余额变化而过期；不刷新会按陈旧等级误发/漏发。
    let levelRefresh: { scanned: number; updated: number; failedWalletReads: number } | null = null
    try {
      const r = await refreshAllNaturalLevels(supabase)
      levelRefresh = { scanned: r.scanned, updated: r.updated, failedWalletReads: r.failedWalletReads }
    } catch (refreshErr) {
      console.error('Level refresh before community payout failed:', refreshErr)
    }

    // ========== 同时发放社群每日收益（含 Momentum Multiplier） ==========
    let communityProcessedCount = 0
    let communityDistributedAmount = 0

    try {
      const today = now.split('T')[0]

      // 获取所有有等级的用户
      const { data: communityStatuses } = await supabase
        .from('user_community_status')
        .select(`
          *,
          profiles:user_id (username, email)
        `)
        .gt('current_level', 0)

      // 获取等级配置
      const { data: communityLevels } = await supabase
        .from('community_levels')
        .select('*')
        .order('level')

      const communityLevelMap = new Map(communityLevels?.map(l => [l.level, l]) || [])

      // Influencer-lock tunables (same gate as /api/admin/community/daily-earnings):
      // admin-set users at >= lockMinLevel have their daily salary locked unless
      // the L1-3 team gained more than MIN_TEAM_GROWTH_USD ($20 of new deposits)
      // since the last snapshot.
      const { data: communityCfg } = await supabase
        .from('airdrop_config')
        .select('influencer_lock_min_level')
        .single()
      const MIN_TEAM_GROWTH_USD = 20
      const lockMinLevel = Number(communityCfg?.influencer_lock_min_level ?? 3)
      // Momentum: team L1-3 volume must grow by MORE than this rate vs last
      // snapshot to count as real new sales (their balances naturally compound
      // ~1-2%/day, so the bar is set above that). Below it → multiplier decays.
      const MOMENTUM_MIN_GROWTH_RATE = 0.03

      if (communityStatuses && communityStatuses.length > 0) {
        for (const status of communityStatuses) {
          const levelInfo = communityLevelMap.get(status.current_level)
          if (!levelInfo || levelInfo.daily_rate <= 0) continue

          // 检查今天是否已经发放
          const { data: existingEarning } = await supabase
            .from('community_daily_earnings')
            .select('id')
            .eq('user_id', status.user_id)
            .eq('earning_date', today)
            .single()

          if (existingEarning) continue

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
          const momentumRefAt = momentumQualifies ? now : (status.momentum_last_referral_at ?? null)

          const baseEarning = levelInfo.reward_pool * levelInfo.daily_rate
          const earningAmount = baseEarning * momentum

          // Movement gate: admin-set users at >= lockMinLevel get locked unless
          // the L1-3 team gained more than $20 of new deposits since last snapshot.
          const isGated = !!status.is_admin_set && Number(status.current_level) >= lockMinLevel
          const locked = isGated ? !(newDeposits > MIN_TEAM_GROWTH_USD) : false
          const creditAvailable = locked ? 0 : earningAmount
          const creditLocked = locked ? earningAmount : 0

          // 创建每日收益记录（包含 momentum 倍率）
          await supabase
            .from('community_daily_earnings')
            .insert({
              user_id: status.user_id,
              earning_date: today,
              level: status.current_level,
              reward_pool: levelInfo.reward_pool,
              daily_rate: levelInfo.daily_rate,
              earning_amount: earningAmount,
              momentum_multiplier: momentum,
              is_credited: true,
              credited_at: now,
            })

          // 更新用户利润账户（locked → community_locked_usdc，否则 available）
          const { data: profits } = await supabase
            .from('user_profits')
            .select('*')
            .eq('user_id', status.user_id)
            .single()

          if (profits) {
            await supabase
              .from('user_profits')
              .update({
                available_usdc: Number(profits.available_usdc || 0) + creditAvailable,
                community_locked_usdc: Number(profits.community_locked_usdc || 0) + creditLocked,
                total_earned_usdc: Number(profits.total_earned_usdc || 0) + earningAmount,
                updated_at: now,
              })
              .eq('user_id', status.user_id)
          } else {
            await supabase
              .from('user_profits')
              .insert({
                user_id: status.user_id,
                available_usdc: creditAvailable,
                community_locked_usdc: creditLocked,
                total_earned_usdc: earningAmount,
                available_matic: 0,
                withdrawn_usdc: 0,
                withdrawn_matic: 0,
              })
          }

          // 更新社群账户累计收益 + momentum_multiplier 缓存 + 推进 movement 快照
          const { data: communityStatus } = await supabase
            .from('user_community_status')
            .select('total_community_earned')
            .eq('user_id', status.user_id)
            .single()

          await supabase
            .from('user_community_status')
            .update({
              total_community_earned: (communityStatus?.total_community_earned || 0) + earningAmount,
              last_daily_earning_date: today,
              momentum_multiplier: momentum,
              momentum_last_referral_at: momentumRefAt, // 仅在增长达标时被刷成 now
              momentum_updated_at: now,
              last_volume_snapshot: todayVol,
              last_volume_snapshot_at: now,
              updated_at: now,
            })
            .eq('user_id', status.user_id)

          communityProcessedCount++
          communityDistributedAmount += earningAmount
        }
      }
    } catch (communityErr) {
      console.error('Error distributing community earnings:', communityErr)
    }

    // ========== 推进 Bonus 维持期（与 daily-earnings 共用同一逻辑，靠 last_counted_date 防重）==========
    try {
      await advanceMaintenanceClaims(supabase)
    } catch (maintErr) {
      console.error('Error advancing maintenance claims:', maintErr)
    }

    // ========== 空投发放后，自动检查并发放抽奖次数 ==========
    let lotterySpinsGranted = 0
    try {
      // 收集所有本轮涉及的用户 + 他们的推荐人
      const affectedUserIds = new Set<string>()
      for (const calc of calculations) {
        affectedUserIds.add(calc.user_id)
      }

      // 获取这些用户的推荐人
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, referrer_id')
        .in('id', Array.from(affectedUserIds))

      // 推荐人也需要检查（下线领了7次空投 → 推荐人得次数）
      const referrerIds = new Set<string>()
      if (profiles) {
        for (const p of profiles) {
          if (p.referrer_id) referrerIds.add(p.referrer_id)
        }
      }

      // 合并所有需要检查的用户
      const allCheckUserIds = new Set([...affectedUserIds, ...referrerIds])

      for (const uid of allCheckUserIds) {
        try {
          const granted = await grantLotterySpins(supabase, uid)
          lotterySpinsGranted += granted
        } catch (err) {
          console.error(`Error granting lottery spins for ${uid}:`, err)
        }
      }
    } catch (lotteryErr) {
      console.error('Error processing lottery spins:', lotteryErr)
    }

    return NextResponse.json({
      success: true,
      distributed_count: distributedCount,
      total_distributed: totalDistributed.toFixed(6),
      commission_count: commissionCount,
      total_commissions: totalCommissions.toFixed(6),
      // 社群发放结果
      community_distribution: {
        processed_count: communityProcessedCount,
        distributed_amount: communityDistributedAmount.toFixed(6),
      },
      // 发放前的链上等级刷新结果
      level_refresh: levelRefresh,
      // 抽奖次数发放
      lottery_spins_granted: lotterySpinsGranted,
    })
  } catch (error) {
    console.error('Distribute error:', error)
    return NextResponse.json({ error: 'Distribution failed' }, { status: 500 })
  }
}

// 取消轮次
export async function DELETE(request: NextRequest) {
  if (!await verifyAdmin()) {
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

// ========== 更新所有用户的 Momentum 数据 ==========
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateAllMomentumData(supabase: any, calculations: any[]) {
  // 收集本轮所有发放到的用户 ID
  const creditedUserIds = new Set<string>()
  for (const calc of calculations) {
    if (calc.is_credited || calc.profit_usdc > 0) {
      creditedUserIds.add(calc.user_id)
    }
  }

  // 对于本轮每个用户，检查他们的推荐人，并更新推荐人的 momentum
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, referrer_id, wallet_address')
    .in('id', Array.from(creditedUserIds))

  if (!profiles) return

  // Map: promoter_id -> Set of staked referral_ids
  const promoterReferrals = new Map<string, Set<string>>()

  for (const profile of profiles) {
    if (!profile.referrer_id || !profile.wallet_address) continue

    // This user has a referrer and a wallet — check if they have staked (USDC > 0)
    // Since they appeared in calculations with profit, they must have USDC balance
    if (!promoterReferrals.has(profile.referrer_id)) {
      promoterReferrals.set(profile.referrer_id, new Set())
    }
    promoterReferrals.get(profile.referrer_id)!.add(profile.id)
  }

  const now = new Date().toISOString()

  // Update each promoter's momentum data
  for (const [promoterId, referralIds] of promoterReferrals) {
    try {
      // Upsert momentum_referral_log entries
      for (const refId of referralIds) {
        await supabase
          .from('momentum_referral_log')
          .upsert({
            promoter_id: promoterId,
            referral_id: refId,
            is_staked: true,
            logged_at: now,
          }, { onConflict: 'promoter_id,referral_id' })
      }

      // Count total staked referrals for this promoter (from the log)
      const { data: stakedRefs } = await supabase
        .from('momentum_referral_log')
        .select('id')
        .eq('promoter_id', promoterId)
        .eq('is_staked', true)

      const stakedCount = stakedRefs?.length || 0

      // Update only the informational staked-referral count. The momentum decay
      // timer (momentum_last_referral_at) is NOT touched here anymore — it is
      // refreshed solely by the community loop when L1-3 volume grows >3%, so a
      // promoter can no longer keep momentum at 1.0 just from old downline.
      await supabase
        .from('user_community_status')
        .update({
          momentum_recent_referrals: stakedCount,
        })
        .eq('user_id', promoterId)
    } catch (err) {
      console.error(`Error updating momentum for promoter ${promoterId}:`, err)
    }
  }
}

// ========== 抽奖次数自动发放辅助函数 ==========
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function grantLotterySpins(supabase: any, userId: string): Promise<number> {
  let newSpinsGranted = 0

  // 确保用户有 user_lottery_spins 记录
  let { data: spinData } = await supabase
    .from('user_lottery_spins')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!spinData) {
    // 检查是否是 influencer
    const { data: communityStatus } = await supabase
      .from('user_community_status')
      .select('is_influencer')
      .eq('user_id', userId)
      .single()

    const { data: newData } = await supabase
      .from('user_lottery_spins')
      .insert({
        user_id: userId,
        total_spins: 0,
        used_spins: 0,
        is_influencer: communityStatus?.is_influencer || false,
      })
      .select()
      .single()
    spinData = newData
  }

  // 1. 检查自己的空投领取次数（每达到7的倍数 +1 次抽奖）
  const { data: selfAirdrops } = await supabase
    .from('airdrop_calculations')
    .select('id')
    .eq('user_id', userId)
    .eq('is_credited', true)

  if (selfAirdrops) {
    const selfClaimCount = selfAirdrops.length
    const selfMilestonesEarned = Math.floor(selfClaimCount / 7)

    // 检查已发放了多少个 self_airdrop_7x 里程碑
    const { data: existingSelfGrants } = await supabase
      .from('lottery_spin_grants')
      .select('milestone_count')
      .eq('user_id', userId)
      .eq('grant_reason', 'self_airdrop_7x')
      .order('milestone_count', { ascending: false })
      .limit(1)

    const lastSelfMilestone = existingSelfGrants?.[0]?.milestone_count || 0
    const lastSelfGrantIndex = lastSelfMilestone / 7

    if (selfMilestonesEarned > lastSelfGrantIndex) {
      for (let i = lastSelfGrantIndex + 1; i <= selfMilestonesEarned; i++) {
        const milestoneValue = i * 7

        const { data: exists } = await supabase
          .from('lottery_spin_grants')
          .select('id')
          .eq('user_id', userId)
          .eq('grant_reason', 'self_airdrop_7x')
          .eq('milestone_count', milestoneValue)
          .single()

        if (!exists) {
          await supabase
            .from('lottery_spin_grants')
            .insert({
              user_id: userId,
              grant_reason: 'self_airdrop_7x',
              milestone_count: milestoneValue,
              spins_granted: 1,
            })
          newSpinsGranted += 1
        }
      }
    }
  }

  // 2. 检查推荐人的下线空投领取（下线领取7次 → 推荐人 +1 次）
  const { data: directReferrals } = await supabase
    .from('profiles')
    .select('id')
    .eq('referrer_id', userId)

  if (directReferrals && directReferrals.length > 0) {
    for (const referral of directReferrals) {
      const { data: referralAirdrops } = await supabase
        .from('airdrop_calculations')
        .select('id')
        .eq('user_id', referral.id)
        .eq('is_credited', true)

      const referralClaimCount = referralAirdrops?.length || 0

      if (referralClaimCount >= 7) {
        const { data: existingGrant } = await supabase
          .from('lottery_spin_grants')
          .select('id')
          .eq('user_id', userId)
          .eq('grant_reason', 'referral_airdrop_7')
          .eq('referral_id', referral.id)
          .single()

        if (!existingGrant) {
          await supabase
            .from('lottery_spin_grants')
            .insert({
              user_id: userId,
              grant_reason: 'referral_airdrop_7',
              referral_id: referral.id,
              milestone_count: 7,
              spins_granted: 1,
            })
          newSpinsGranted += 1
        }
      }
    }
  }

  // 3. 更新 total_spins
  if (newSpinsGranted > 0 && spinData) {
    await supabase
      .from('user_lottery_spins')
      .update({
        total_spins: (spinData.total_spins || 0) + newSpinsGranted,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }

  return newSpinsGranted
}
