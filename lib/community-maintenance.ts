// Bonus 维持期（防刷奖励）共享逻辑。
// - 团队 staking 比例 = L1-3 下线在 AlphaStake 合约的未平仓本金 ÷ 团队总 volume
//   （合约本金 + 钱包 USDC）。< 50% 时管理员可让奖金进入“维持期”。
// - 维持期内每天检查：effectiveVolume ≥ 定格门槛 → 达标天 +1（非连续）。
//   达标天 ≥ N 或 staking 比例 ≥ 50% → 放行奖金到可提现。
// - 由每日发放任务（daily-earnings 与 airdrop/distribute 两条路径）调用，
//   靠 maintenance_last_counted_date 防重，重复调用不会多计。

import type { SupabaseClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

export const MAINTENANCE_RELEASE_RATIO = 0.5 // staking 比例 ≥ 50% 提前放行
export const DEFAULT_MAINTENANCE_DAYS = 15

const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

export interface StakingRatio {
  totalVolume: number
  stakedVolume: number
  walletVolume: number
  ratio: number // stakedVolume / totalVolume（0 表示无 volume）
}

interface MaintenanceClaim {
  id: string
  user_id: string
  amount: number
  level: number
  maintenance_days_done: number | null
  maintenance_required_days: number | null
  maintenance_threshold: number | null
  maintenance_last_counted_date: string | null
}

// 计算某用户 L1-3 团队的 staking 比例（合约本金 vs 钱包 USDC）。
export async function computeTeamStakingRatio(
  supabase: SupabaseClient,
  userId: string,
): Promise<StakingRatio> {
  const { data: referrals } = await supabase.rpc('get_all_referrals', { user_id: userId })
  const l123 = (referrals || []).filter(
    (r: { level: number; wallet_address: string | null }) => r.level <= 3 && r.wallet_address,
  )
  if (l123.length === 0) return { totalVolume: 0, stakedVolume: 0, walletVolume: 0, ratio: 0 }

  const wallets: string[] = l123.map((r: { wallet_address: string }) => r.wallet_address)
  const publicClient = createPublicClient({ chain: polygon, transport: http(RPC_URL) })

  // 钱包 USDC 合计（non-staking）
  let walletVolume = 0
  const BATCH = 100
  for (let i = 0; i < wallets.length; i += BATCH) {
    const batch = wallets.slice(i, i + BATCH)
    try {
      const results = await publicClient.multicall({
        contracts: batch.map((w) => ({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [w as `0x${string}`],
        })),
        allowFailure: true,
      })
      for (const r of results) {
        if (r.status === 'success') walletVolume += parseFloat(formatUnits(r.result as bigint, 6))
      }
    } catch {
      for (const w of batch) {
        try {
          const b = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [w as `0x${string}`],
          })
          walletVolume += parseFloat(formatUnits(b, 6))
        } catch {
          /* ignore single-wallet failure */
        }
      }
    }
  }

  // AlphaStake 合约未平仓本金（staking）
  const walletSet = new Set(wallets.map((w) => w.toLowerCase()))
  let stakedVolume = 0
  try {
    const alpha = await fetchOnChainAlphaSummary()
    if (alpha.configured) {
      for (const pos of alpha.positions) {
        if (pos.closed) continue
        if (walletSet.has(pos.user)) stakedVolume += pos.amountUsdc
      }
    }
  } catch (e) {
    console.error('computeTeamStakingRatio: alpha read failed', e)
  }

  const totalVolume = walletVolume + stakedVolume
  const ratio = totalVolume > 0 ? stakedVolume / totalVolume : 0
  return { totalVolume, stakedVolume, walletVolume, ratio }
}

// 放行一笔维持中的奖金：入账可提现 + 累计收益，claim 转 completed。
// 等级已在批准进入维持期时升过，这里不再动等级。
export async function releaseMaintenanceClaim(
  supabase: SupabaseClient,
  claim: MaintenanceClaim,
): Promise<void> {
  const now = new Date().toISOString()
  const amount = Number(claim.amount)

  const { data: profits } = await supabase
    .from('user_profits')
    .select('available_usdc, total_earned_usdc')
    .eq('user_id', claim.user_id)
    .single()

  if (profits) {
    await supabase
      .from('user_profits')
      .update({
        available_usdc: Number(profits.available_usdc || 0) + amount,
        total_earned_usdc: Number(profits.total_earned_usdc || 0) + amount,
        updated_at: now,
      })
      .eq('user_id', claim.user_id)
  } else {
    await supabase.from('user_profits').insert({
      user_id: claim.user_id,
      available_usdc: amount,
      total_earned_usdc: amount,
      available_matic: 0,
      withdrawn_usdc: 0,
      withdrawn_matic: 0,
    })
  }

  const { data: status } = await supabase
    .from('user_community_status')
    .select('total_community_earned')
    .eq('user_id', claim.user_id)
    .single()

  await supabase
    .from('user_community_status')
    .update({
      total_community_earned: Number(status?.total_community_earned || 0) + amount,
      updated_at: now,
    })
    .eq('user_id', claim.user_id)

  await supabase
    .from('community_pool_claims')
    .update({ status: 'completed', credited_at: now, reviewed_at: now })
    .eq('id', claim.id)
}

// 推进所有维持中的 claim（每日发放时调用）。返回处理/放行数量。
// 每 UTC 天最多计一次达标（maintenance_last_counted_date 防重）。
export async function advanceMaintenanceClaims(
  supabase: SupabaseClient,
): Promise<{ processed: number; released: number }> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: claims } = await supabase
    .from('community_pool_claims')
    .select('id, user_id, amount, level, maintenance_days_done, maintenance_required_days, maintenance_threshold, maintenance_last_counted_date')
    .eq('status', 'maintenance')

  if (!claims || claims.length === 0) return { processed: 0, released: 0 }

  let released = 0
  for (const claim of claims as MaintenanceClaim[]) {
    try {
      let daysDone = Number(claim.maintenance_days_done || 0)

      // 当天还没计过 → 检查是否达标，计一次
      if (claim.maintenance_last_counted_date !== today) {
        const [{ data: status }, { data: taskProg }] = await Promise.all([
          supabase.from('user_community_status').select('team_volume_l123').eq('user_id', claim.user_id).single(),
          supabase.from('user_task_progress').select('total_task_bonus').eq('user_id', claim.user_id).maybeSingle(),
        ])
        const effectiveVolume = Number(status?.team_volume_l123 || 0) + Number(taskProg?.total_task_bonus || 0)
        const threshold = Number(claim.maintenance_threshold || 0)
        if (effectiveVolume >= threshold) daysDone += 1

        await supabase
          .from('community_pool_claims')
          .update({ maintenance_days_done: daysDone, maintenance_last_counted_date: today })
          .eq('id', claim.id)
      }

      const requiredDays = Number(claim.maintenance_required_days || 0)
      let shouldRelease = requiredDays > 0 && daysDone >= requiredDays

      // 逃生通道：staking 比例 ≥ 50% 立即放行（仅在还没靠天数放行时才算）
      if (!shouldRelease) {
        const { ratio } = await computeTeamStakingRatio(supabase, claim.user_id)
        if (ratio >= MAINTENANCE_RELEASE_RATIO) shouldRelease = true
      }

      if (shouldRelease) {
        await releaseMaintenanceClaim(supabase, claim)
        released++
      }
    } catch (e) {
      console.error('advanceMaintenanceClaims: failed for claim', claim.id, e)
    }
  }

  return { processed: claims.length, released }
}
