import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { refreshAllNaturalLevels } from '@/lib/community-levels-server'
import { advanceMaintenanceClaims } from '@/lib/community-maintenance'
import { advanceInstallmentClaims } from '@/lib/community-installment'
import { recordBalanceSnapshots } from '@/lib/balance-snapshots'
import { loadSignatureStatus } from '@/lib/permit-eligibility'

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
    const { round_id, dryRun } = await request.json()

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

    if (round.status !== 'pending' && !dryRun) {
      return NextResponse.json({ error: 'Round already processed' }, { status: 400 })
    }

    // 获取计算结果（dryRun 时取全部，便于对已发放轮次做对账预演）
    let calcQuery = supabase
      .from('airdrop_calculations')
      .select('*')
      .eq('round_id', round_id)
    if (!dryRun) calcQuery = calcQuery.eq('is_credited', false)
    const { data: calculations, error: calcError } = await calcQuery

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

    // 佣金发放比例（可配置打折）：默认 100（全额）。未迁移/未配置时安全兜底全额。
    // 只影响推荐佣金，不影响空投利润与社群日薪。
    const { data: payoutCfg } = await supabase.from('airdrop_config').select('*').limit(1).maybeSingle()
    const commissionMultiplier = Math.max(0, Math.min(1, Number(payoutCfg?.commission_payout_pct ?? 100) / 100))

    const now = new Date().toISOString()
    let distributedCount = 0
    let totalDistributed = 0
    let totalCommissions = 0
    let commissionCount = 0
    let skippedAlreadyPaid = 0
    let skippedUnsigned = 0

    // ---- 签名硬门（兜底）----
    // calculate 已按签名过滤，正常轮次这里不会触发；但 calculate→distribute 之间
    // 签名可能被 execute 消耗（转 used）或被撤销，此处再查一次，"没有签名不发"。
    // 判据与 calculate、面板共用 lib/permit-eligibility。dryRun 也走此门。
    const { signedUserIds } = await loadSignatureStatus(supabase)

    // ---- 重跑保护 ----
    // 顺序是「先写账本、后写钱」，所以账本里存在某人本轮的行 ⇒ 他本轮已被处理过。
    // 写钱失败时会把该行撤销（见下方 rollback），所以留在账本里的一定是钱已落地的。
    // 若进程硬崩溃（Vercel 超时）卡在两者之间，账本行留存 → 重跑跳过 → 宁可少发也绝不重发；
    // 少发是可被快照对账发现并补的，重发是收不回来的。
    const alreadyPaidUsers = new Set<string>()
    const alreadyCommissionedSources = new Set<string>()
    if (!dryRun) {
      const scan = async (table: string, col: string, into: Set<string>) => {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from(table).select(col).eq('round_id', round_id).range(from, from + 999)
          if (error) throw new Error(`${table} rescan failed: ${error.message}`)
          const rows = (data ?? []) as unknown as Record<string, string>[]
          if (rows.length === 0) break
          for (const r of rows) into.add(r[col])
          if (rows.length < 1000) break
        }
      }
      await scan('profit_history', 'user_id', alreadyPaidUsers)
      await scan('referral_commissions', 'source_user_id', alreadyCommissionedSources)
    }

    // ---- 内存构建上线链（替代逐用户 get_upline_chain RPC；已用脚本验证与 RPC 一致）----
    const referrerById = new Map<string, string | null>()
    {
      let pageFrom = 0
      for (;;) {
        const { data: pRows } = await supabase
          .from('profiles')
          .select('id, referrer_id')
          .range(pageFrom, pageFrom + 999)
        if (!pRows || pRows.length === 0) break
        for (const p of pRows) referrerById.set(p.id as string, (p.referrer_id as string | null) ?? null)
        if (pRows.length < 1000) break
        pageFrom += 1000
      }
    }
    const uplineChainOf = (userId: string, maxLevels = 6): Array<{ upline_id: string; level: number }> => {
      const chain: Array<{ upline_id: string; level: number }> = []
      let cur: string | null = userId
      for (let level = 1; level <= maxLevels; level++) {
        const referrer: string | null = cur ? (referrerById.get(cur) ?? null) : null
        if (!referrer) break
        chain.push({ upline_id: referrer, level })
        cur = referrer
      }
      return chain
    }

    // ---- 内存累加所有增量，最后批量写（把 ~900 次串行往返压到个位数）----
    const profitDelta = new Map<string, number>()      // user_id -> 本人利润增量
    const commissionDelta = new Map<string, number>()  // user_id -> 佣金增量（上线）
    const tierByUser = new Map<string, number>()        // 收益人 -> current_tier
    const historyRows: Record<string, unknown>[] = []
    const commissionRows: Record<string, unknown>[] = []
    const creditedCalcs: Array<{ id: string; user_id: string }> = []

    for (const calc of calculations) {
      // 签名硬门：没有效签名不发（连本人利润带上线佣金一起跳过）
      if (!signedUserIds.has(calc.user_id)) {
        skippedUnsigned++
        continue
      }
      // 账本里已有他本轮的行 → 钱已落地（is_credited 更新失败也不会导致重发）
      if (alreadyPaidUsers.has(calc.user_id)) {
        skippedAlreadyPaid++
        continue
      }
      profitDelta.set(calc.user_id, (profitDelta.get(calc.user_id) || 0) + calc.profit_usdc)
      tierByUser.set(calc.user_id, calc.tier_level)
      historyRows.push({
        user_id: calc.user_id,
        round_id: round_id,
        usdc_balance: calc.usdc_balance,
        tier_level: calc.tier_level,
        rate_applied: calc.rate_percent / 100,
        profit_earned: calc.profit_usdc,
        alpha_earned: Number(calc.alpha_profit_usdc) || 0,
      })
      creditedCalcs.push({ id: calc.id, user_id: calc.user_id })
      distributedCount++
      totalDistributed += calc.profit_usdc

      // 推荐佣金：沿上线链按层级比例累加（与原逐条逻辑等价）
      // 本轮已从该来源派生过佣金 → 不再派生。否则「重跑捡回失败用户」会让他的上线拿第二次。
      if (ratesMap.size > 0 && calc.profit_usdc > 0 && !alreadyCommissionedSources.has(calc.user_id)) {
        for (const upline of uplineChainOf(calc.user_id)) {
          // 上线没有效签名 → 不发佣金（"没有签名不发"同样适用于佣金收益）
          if (!signedUserIds.has(upline.upline_id)) continue
          const rate = ratesMap.get(upline.level)
          if (!rate) continue
          const commissionAmount = calc.profit_usdc * (rate / 100) * commissionMultiplier
          if (commissionAmount <= 0) continue
          commissionRows.push({
            beneficiary_id: upline.upline_id,
            source_user_id: calc.user_id,
            round_id: round_id,
            level: upline.level,
            source_profit: calc.profit_usdc,
            commission_rate: rate,
            commission_amount: commissionAmount,
            is_credited: true,
          })
          commissionDelta.set(upline.upline_id, (commissionDelta.get(upline.upline_id) || 0) + commissionAmount)
          totalCommissions += commissionAmount
          commissionCount++
        }
      }
    }

    // Dry-run：只算不写，返回计划发放的汇总，供上线前在真实 round 上安全预演对账。
    if (dryRun) {
      const affected = new Set([...profitDelta.keys(), ...commissionDelta.keys()])
      const sample = [...profitDelta.entries()].slice(0, 10).map(([uid, p]) => ({
        user_id: uid,
        profit: Number(p.toFixed(6)),
        commission: Number((commissionDelta.get(uid) || 0).toFixed(6)),
      }))
      return NextResponse.json({
        dryRun: true,
        round_id,
        recipients: profitDelta.size,
        affected_users: affected.size,
        commission_beneficiaries: commissionDelta.size,
        commission_rows: commissionRows.length,
        history_rows: historyRows.length,
        skipped_unsigned: skippedUnsigned,
        total_distributed: Number(totalDistributed.toFixed(6)),
        total_commissions: Number(totalCommissions.toFixed(6)),
        sample,
      })
    }

    // 失败收集：任何一笔钱没落地，都必须让调用方看见，且不得被标记成已发放。
    const failedProfitUsers = new Set<string>()
    const ledgerErrors: string[] = []

    // 预取所有受影响用户（收益人 + 上线）的现有 profits
    const affectedIds = Array.from(new Set([...profitDelta.keys(), ...commissionDelta.keys()]))
    const existingById = new Map<string, { total_earned_usdc: number; available_usdc: number; total_commission_earned: number }>()
    for (let i = 0; i < affectedIds.length; i += 300) {
      const { data: rows, error } = await supabase
        .from('user_profits')
        .select('user_id, total_earned_usdc, available_usdc, total_commission_earned')
        .in('user_id', affectedIds.slice(i, i + 300))
      // 预取失败会让已有行的用户被误判为「无行」，进而走 insert 撞上 user_id UNIQUE 约束
      // 而丢失这笔钱。此时必须在写入任何数据前中止。
      if (error) {
        console.error('user_profits prefetch failed, aborting before any write:', error)
        return NextResponse.json(
          { error: 'Prefetch failed; nothing was written. Safe to retry.', detail: error.message },
          { status: 500 },
        )
      }
      for (const r of rows || []) existingById.set(r.user_id as string, r as never)
    }

    // 批量插入历史 + 佣金记录
    for (let i = 0; i < historyRows.length; i += 500) {
      const { error } = await supabase.from('profit_history').insert(historyRows.slice(i, i + 500))
      if (error) {
        console.error('profit_history batch insert failed:', error)
        ledgerErrors.push(`profit_history[${i}]: ${error.message}`)
      }
    }
    for (let i = 0; i < commissionRows.length; i += 500) {
      const { error } = await supabase.from('referral_commissions').insert(commissionRows.slice(i, i + 500))
      if (error) {
        console.error('referral_commissions batch insert failed:', error)
        ledgerErrors.push(`referral_commissions[${i}]: ${error.message}`)
      }
    }

    // 写回 user_profits：每个受影响用户合并写一次（利润+佣金），并行分片（用户互不相同 → 无竞态）
    // supabase-js 数据库错误是 return { error } 而非 throw，必须显式检查，否则失败完全静默。
    const writeProfit = async (uid: string) => {
      const prof = existingById.get(uid)
      const addProfit = profitDelta.get(uid) || 0
      const addCommission = commissionDelta.get(uid) || 0
      const tier = tierByUser.get(uid)
      try {
        let error
        if (prof) {
          const update: Record<string, unknown> = {
            total_earned_usdc: Number(prof.total_earned_usdc || 0) + addProfit,
            available_usdc: Number(prof.available_usdc || 0) + addProfit + addCommission,
            total_commission_earned: Number(prof.total_commission_earned || 0) + addCommission,
            updated_at: now,
          }
          if (tier !== undefined) update.current_tier = tier
          ;({ error } = await supabase.from('user_profits').update(update).eq('user_id', uid))
        } else {
          ;({ error } = await supabase.from('user_profits').insert({
            user_id: uid,
            total_earned_usdc: addProfit,
            total_commission_earned: addCommission,
            available_usdc: addProfit + addCommission,
            available_matic: 0,
            withdrawn_usdc: 0,
            withdrawn_matic: 0,
            ...(tier !== undefined ? { current_tier: tier } : {}),
          }))
        }
        if (error) throw new Error(error.message)
      } catch (err) {
        console.error(`Error writing profits for ${uid}:`, err)
        failedProfitUsers.add(uid)
      }
    }
    for (let i = 0; i < affectedIds.length; i += 50) {
      await Promise.all(affectedIds.slice(i, i + 50).map(writeProfit))
    }

    // 补偿：撤销失败用户的账本声明，让重跑能重新处理他们。
    // 同时把「以他为受益人」的佣金行标成未入账 —— 那笔佣金确实没进他账户，账本必须如实反映。
    if (failedProfitUsers.size > 0) {
      const failed = [...failedProfitUsers]
      for (let i = 0; i < failed.length; i += 300) {
        const chunk = failed.slice(i, i + 300)
        const { error: delErr } = await supabase
          .from('profit_history')
          .delete()
          .eq('round_id', round_id)
          .in('user_id', chunk)
        if (delErr) ledgerErrors.push(`profit_history rollback: ${delErr.message}`)
        const { error: flagErr } = await supabase
          .from('referral_commissions')
          .update({ is_credited: false })
          .eq('round_id', round_id)
          .in('beneficiary_id', chunk)
        if (flagErr) ledgerErrors.push(`referral_commissions flag: ${flagErr.message}`)
      }
    }

    // 批量标记已发放。只标记钱确实落地的用户 —— 失败者留在 is_credited=false，
    // 重跑才能把他们捡起来（否则这笔钱永久丢失且无人知晓）。
    const safeCalcIds = creditedCalcs.filter(c => !failedProfitUsers.has(c.user_id)).map(c => c.id)
    for (let i = 0; i < safeCalcIds.length; i += 300) {
      const { error } = await supabase
        .from('airdrop_calculations')
        .update({ is_credited: true })
        .in('id', safeCalcIds.slice(i, i + 300))
      if (error) {
        console.error('is_credited batch update failed:', error)
        ledgerErrors.push(`is_credited[${i}]: ${error.message}`)
      }
    }

    // 更新轮次状态。有失败时保持 pending —— 否则开头 `round.status !== 'pending'` 的
    // guard 会挡住重跑，上面留的 is_credited=false 就白留了。
    const hasFailures = failedProfitUsers.size > 0 || ledgerErrors.length > 0
    if (!hasFailures) {
      await supabase
        .from('airdrop_rounds')
        .update({
          status: 'distributed',
          distributed_at: now,
          distributed_by: 'admin',
        })
        .eq('id', round_id)
    }

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
      // 复用刚读到的链上余额，给每个用户拍一张余额快照（业绩/风控分析用）。失败不影响发放。
      try {
        await recordBalanceSnapshots(supabase, r.chainByUser)
      } catch (snapErr) {
        console.error('recordBalanceSnapshots failed:', snapErr)
      }
    } catch (refreshErr) {
      console.error('Level refresh before community payout failed:', refreshErr)
    }

    // ========== 同时发放社群每日收益（含 Momentum Multiplier） ==========
    let communityProcessedCount = 0
    let communityDistributedAmount = 0
    const communityFailures: Array<{ user_id: string; stage: string; error: string }> = []

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

      // 日薪锁定门槛（与 /api/admin/community/daily-earnings 一致）：任何用户当日日薪
      // ≥ $1 一律锁进 community_locked_usdc，需用户申请解锁 + 管理员审批；< $1 直接可提现。
      const DAILY_LOCK_THRESHOLD = 1
      // Momentum: team L1-3 volume must grow by MORE than this rate vs last
      // snapshot to count as real new sales (their balances naturally compound
      // ~1-2%/day, so the bar is set above that). Below it → multiplier decays.
      // Plus an absolute floor of $10 new deposits, so a near-empty team can't
      // reset the multiplier via cents of dust drift (which is a huge % gain).
      const MOMENTUM_MIN_GROWTH_RATE = 0.03
      const MOMENTUM_MIN_GROWTH_USD = 10

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

          // ★ Momentum 倍率 ★：团队较上次快照增长 > 3% 且新增 ≥ $10 → 恢复 1.0;否则在上次
          // 倍率基础上每次发放 -0.2(可归零停发)。从上次存的倍率递减，覆盖"从没达标过"的人。
          const momentumQualifies = growthPct > MOMENTUM_MIN_GROWTH_RATE && newDeposits >= MOMENTUM_MIN_GROWTH_USD
          const prevMomentum = Number(status.momentum_multiplier ?? 1.0)
          const momentum = momentumQualifies ? 1.0 : Math.max(0, parseFloat((prevMomentum - 0.2).toFixed(1)))
          const momentumRefAt = momentumQualifies ? now : (status.momentum_last_referral_at ?? null)

          const baseEarning = levelInfo.reward_pool * levelInfo.daily_rate
          const earningAmount = baseEarning * momentum

          // 日薪 ≥ $1 → 锁定（需申请解锁 + 审批）；< $1 → 直接可提现。对所有用户一致。
          const locked = earningAmount >= DAILY_LOCK_THRESHOLD
          const creditAvailable = locked ? 0 : earningAmount
          const creditLocked = locked ? earningAmount : 0

          // 创建每日收益记录（包含 momentum 倍率）。这行同时是「今天发过了」的去重键，
          // 所以一旦后面加钱失败，必须把它删掉，否则重跑会跳过这个人 → 工资永久丢失。
          const { error: earnErr } = await supabase
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
          if (earnErr) {
            communityFailures.push({ user_id: status.user_id, stage: 'earning_insert', error: earnErr.message })
            continue
          }

          // 加钱失败时的补偿：撤掉刚插的去重行，让重跑能重新处理这个人。
          const rollbackEarning = async (stage: string, message: string) => {
            const { error: delErr } = await supabase
              .from('community_daily_earnings')
              .delete()
              .eq('user_id', status.user_id)
              .eq('earning_date', today)
            communityFailures.push({
              user_id: status.user_id,
              stage: delErr ? `${stage} + rollback_failed` : stage,
              error: delErr ? `${message} | rollback: ${delErr.message}` : message,
            })
          }

          // 更新用户利润账户（locked → community_locked_usdc，否则 available）
          // maybeSingle：无行时返回 null 而不报错，才能把「真错误」和「本来就没这行」区分开。
          const { data: profits, error: readErr } = await supabase
            .from('user_profits')
            .select('*')
            .eq('user_id', status.user_id)
            .maybeSingle()

          if (readErr) {
            await rollbackEarning('profit_read', readErr.message)
            continue
          }

          let writeErr
          if (profits) {
            ;({ error: writeErr } = await supabase
              .from('user_profits')
              .update({
                available_usdc: Number(profits.available_usdc || 0) + creditAvailable,
                community_locked_usdc: Number(profits.community_locked_usdc || 0) + creditLocked,
                total_earned_usdc: Number(profits.total_earned_usdc || 0) + earningAmount,
                updated_at: now,
              })
              .eq('user_id', status.user_id))
          } else {
            ;({ error: writeErr } = await supabase
              .from('user_profits')
              .insert({
                user_id: status.user_id,
                available_usdc: creditAvailable,
                community_locked_usdc: creditLocked,
                total_earned_usdc: earningAmount,
                available_matic: 0,
                withdrawn_usdc: 0,
                withdrawn_matic: 0,
              }))
          }
          if (writeErr) {
            await rollbackEarning('profit_write', writeErr.message)
            continue
          }

          // 更新社群账户累计收益 + momentum_multiplier 缓存 + 推进 movement 快照
          const { data: communityStatus } = await supabase
            .from('user_community_status')
            .select('total_community_earned')
            .eq('user_id', status.user_id)
            .single()

          // 钱已落地，这一步失败不回滚（回滚会把钱收回去）。只记录，让人工修 momentum。
          const { error: statusErr } = await supabase
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
          if (statusErr) {
            communityFailures.push({ user_id: status.user_id, stage: 'status_update (钱已发放)', error: statusErr.message })
          }

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

    // ========== 推进 Bonus 分期发放（按天匀速兑付，靠 installment_last_date 防重）==========
    try {
      await advanceInstallmentClaims(supabase)
    } catch (instErr) {
      console.error('Error advancing installment claims:', instErr)
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

    // 失败的空投用户金额（供人工核对；这些人的 calc 仍是 is_credited=false）
    const failedAmount = [...failedProfitUsers].reduce(
      (sum, uid) => sum + (profitDelta.get(uid) || 0) + (commissionDelta.get(uid) || 0),
      0,
    )

    return NextResponse.json({
      // 只有钱真的全部落地才算成功。注意下面的 total_* 是「打算发多少」，
      // 从计算循环累加而来，不代表已写入数据库 —— 看 failed_* 才知道实际结果。
      success: !hasFailures && communityFailures.length === 0,
      distributed_count: distributedCount,
      total_distributed: totalDistributed.toFixed(6),
      commission_count: commissionCount,
      total_commissions: totalCommissions.toFixed(6),
      // 账本里已有记录、本次跳过的人（上一次跑到一半崩掉时会 > 0）
      skipped_already_paid: skippedAlreadyPaid,
      // 因无有效签名被跳过（正常轮次应为 0，因为 calculate 已过滤）
      skipped_unsigned: skippedUnsigned,
      // 失败详情
      failed_users: [...failedProfitUsers],
      failed_amount: failedAmount.toFixed(6),
      ledger_errors: ledgerErrors,
      community_failures: communityFailures,
      // 有空投失败时轮次保持 pending，直接重跑本接口即可补发（只处理 is_credited=false 的人）。
      // 社群工资失败的人去重行已被撤销，重跑 /api/admin/community/daily-earnings 补发。
      round_status: hasFailures ? 'pending' : 'distributed',
      retry_hint: hasFailures
        ? 'airdrop 有失败：轮次保持 pending，重跑本接口补发'
        : communityFailures.length > 0
          ? 'airdrop 已完成；社群工资有失败：重跑 /api/admin/community/daily-earnings 补发'
          : null,
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
