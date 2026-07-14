// Bonus 分期发放（达标后按天匀速兑付）共享逻辑。
// - approve_installment 批准时：等级立即升、claim 转 installment、钱不动。
// - 每天由发放任务推进：放 round(总额 ÷ 总天数, 6) 到 available_usdc，
//   最后一天补足余数（总额 − 已发），保证总和精确等于奖金；发满转 completed。
// - 无条件时间 vesting：不看团队 volume / 质押，到点就放（与维持的“带条件”区分）。
// - 靠 installment_last_date 每 UTC 天防重，重复调用不会多发。

import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_INSTALLMENT_DAYS = 10

interface InstallmentClaim {
  id: string
  user_id: string
  amount: number
  level: number
  installment_total_days: number | null
  installment_days_done: number | null
  installment_released: number | null
  installment_last_date: string | null
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

// 推进所有分期中的 claim（每日发放时调用）。每 UTC 天最多发一次。
export async function advanceInstallmentClaims(
  supabase: SupabaseClient,
): Promise<{ processed: number; released: number; completed: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const { data: claims } = await supabase
    .from('community_pool_claims')
    .select('id, user_id, amount, level, installment_total_days, installment_days_done, installment_released, installment_last_date')
    .eq('status', 'installment')

  if (!claims || claims.length === 0) return { processed: 0, released: 0, completed: 0 }

  let released = 0
  let completed = 0
  for (const claim of claims as InstallmentClaim[]) {
    try {
      // 当天已发过 → 跳过
      if (claim.installment_last_date === today) continue

      const total = Number(claim.amount) || 0
      const totalDays = Number(claim.installment_total_days) || 0
      if (totalDays <= 0) continue // 配置异常，跳过（不发、不改）

      const daysDone = Number(claim.installment_days_done) || 0
      const prevReleased = Number(claim.installment_released) || 0
      const remaining = round6(total - prevReleased)
      if (remaining <= 0) {
        // 金额已发满但状态没收尾 → 收尾
        await supabase
          .from('community_pool_claims')
          .update({ status: 'completed', credited_at: now, installment_last_date: today })
          .eq('id', claim.id)
        completed++
        continue
      }

      const isLastDay = daysDone + 1 >= totalDays
      const perDay = round6(total / totalDays)
      // 最后一天补足余数；平时按每日额，但绝不超过剩余
      const todayAmount = round6(Math.min(isLastDay ? remaining : perDay, remaining))
      if (todayAmount < 0) continue

      // 入账到 available_usdc（可提现）+ 累计收益
      const { data: profits } = await supabase
        .from('user_profits')
        .select('available_usdc, total_earned_usdc')
        .eq('user_id', claim.user_id)
        .maybeSingle()

      if (profits) {
        await supabase
          .from('user_profits')
          .update({
            available_usdc: Number(profits.available_usdc || 0) + todayAmount,
            total_earned_usdc: Number(profits.total_earned_usdc || 0) + todayAmount,
            updated_at: now,
          })
          .eq('user_id', claim.user_id)
      } else {
        await supabase.from('user_profits').insert({
          user_id: claim.user_id,
          available_usdc: todayAmount,
          total_earned_usdc: todayAmount,
          available_matic: 0,
          withdrawn_usdc: 0,
          withdrawn_matic: 0,
        })
      }

      const { data: cs } = await supabase
        .from('user_community_status')
        .select('total_community_earned')
        .eq('user_id', claim.user_id)
        .single()
      await supabase
        .from('user_community_status')
        .update({ total_community_earned: Number(cs?.total_community_earned || 0) + todayAmount, updated_at: now })
        .eq('user_id', claim.user_id)

      released++

      const newDaysDone = daysDone + 1
      const newReleased = round6(prevReleased + todayAmount)
      const done = newDaysDone >= totalDays || newReleased >= total
      await supabase
        .from('community_pool_claims')
        .update({
          installment_days_done: newDaysDone,
          installment_released: newReleased,
          installment_last_date: today,
          ...(done ? { status: 'completed', credited_at: now } : {}),
        })
        .eq('id', claim.id)
      if (done) completed++
    } catch (e) {
      console.error('advanceInstallmentClaims: failed for claim', claim.id, e)
    }
  }

  return { processed: claims.length, released, completed }
}
