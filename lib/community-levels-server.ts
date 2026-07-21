import { createPublicClient, http, parseAbi, formatUnits, type PublicClient } from 'viem'
import { polygon } from 'viem/chains'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

interface ProfileRow {
  id: string
  referrer_id: string | null
  wallet_address: string | null
}

interface LevelRow {
  level: number
  unlock_volume_normal: number
  unlock_volume_influencer: number
}

interface StatusRow {
  user_id: string
  current_level: number
  real_level: number
  is_admin_set: boolean
  is_influencer: boolean
  team_volume_l123: number
}

export interface RefreshResult {
  scanned: number
  updated: number
  failedWalletReads: number
  // 每个用户的链上有效余额（钱包 USDC + AlphaStake 本金），供余额快照零成本复用
  chainByUser: Map<string, number>
  changes: Array<{
    userId: string
    volumeBefore: number
    volumeAfter: number
    levelBefore: number
    levelAfter: number
  }>
}

// earnedBase = 已达到解锁门槛的最高等级；real_level/current_level = earnedBase + 1（起步 L1，每过一档 +1）
function earnedBaseFor(volume: number, isInfluencer: boolean, levels: LevelRow[]): number {
  let earnedBase = 0
  for (const l of levels) {
    const unlock = isInfluencer ? l.unlock_volume_influencer : l.unlock_volume_normal
    if (volume >= unlock) earnedBase = l.level
    else break
  }
  return earnedBase
}

/**
 * 按链上 USDC 余额重算所有自然用户（非 admin-set）的团队业绩与等级。
 * 用去重钱包 + 内存下线树 + 批量读链，避免逐用户逐钱包的放大开销。
 * admin-set 用户的 current_level 不动，但其 real_level（真实等级）仍按业绩更新。
 */
export async function refreshAllNaturalLevels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  client?: PublicClient,
): Promise<RefreshResult> {
  const publicClient =
    client ?? createPublicClient({ chain: polygon, transport: http(RPC_URL) })

  const [{ data: profiles }, { data: levels }, { data: statuses }] = await Promise.all([
    supabase.from('profiles').select('id, referrer_id, wallet_address'),
    supabase.from('community_levels').select('level, unlock_volume_normal, unlock_volume_influencer').order('level'),
    supabase
      .from('user_community_status')
      .select('user_id, current_level, real_level, is_admin_set, is_influencer, team_volume_l123'),
  ])

  const result: RefreshResult = { scanned: 0, updated: 0, failedWalletReads: 0, chainByUser: new Map(), changes: [] }
  if (!profiles || !levels || !statuses) return result

  const profileList = profiles as ProfileRow[]
  const levelList = levels as LevelRow[]

  // 下线树：referrer_id -> 直接下线 id 列表
  const childrenByParent = new Map<string, string[]>()
  const walletByUser = new Map<string, string>()
  for (const p of profileList) {
    if (p.referrer_id) {
      const arr = childrenByParent.get(p.referrer_id) || []
      arr.push(p.id)
      childrenByParent.set(p.referrer_id, arr)
    }
    if (p.wallet_address) walletByUser.set(p.id, p.wallet_address.toLowerCase())
  }

  // 一次性读取全部去重钱包余额（multicall：一次 RPC 读 100 个，比逐个 readContract 快 ~5x）
  const uniqueWallets = Array.from(new Set(walletByUser.values()))
  const balanceByWallet = new Map<string, number>()
  const BATCH = 100
  for (let i = 0; i < uniqueWallets.length; i += BATCH) {
    const batch = uniqueWallets.slice(i, i + BATCH)
    try {
      const reads = await publicClient.multicall({
        contracts: batch.map(w => ({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [w as `0x${string}`],
        })),
        allowFailure: true,
      })
      for (let j = 0; j < reads.length; j++) {
        const r = reads[j]
        if (r.status === 'success') {
          balanceByWallet.set(batch[j], parseFloat(formatUnits(r.result as bigint, 6)))
        } else {
          result.failedWalletReads++
        }
      }
    } catch {
      // multicall 整批失败 → 回退逐个读，保证不因一批失败漏读整批
      const reads = await Promise.allSettled(
        batch.map(w =>
          publicClient.readContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [w as `0x${string}`],
          }),
        ),
      )
      for (let j = 0; j < reads.length; j++) {
        const r = reads[j]
        if (r.status === 'fulfilled') {
          balanceByWallet.set(batch[j], parseFloat(formatUnits(r.value as bigint, 6)))
        } else {
          result.failedWalletReads++
        }
      }
    }
  }

  // 把 AlphaStake 质押本金(未平仓)并入各钱包的"有效余额",这样下线质押不会
  // 让其团队业绩贡献缩水。复用已有的批量链上汇总读取。
  try {
    const alpha = await fetchOnChainAlphaSummary()
    if (alpha.configured) {
      for (const pos of alpha.positions) {
        if (pos.closed) continue
        balanceByWallet.set(pos.user, (balanceByWallet.get(pos.user) || 0) + pos.amountUsdc)
      }
    }
  } catch (err) {
    console.error('[community] alpha staked read failed:', err)
  }

  // 每个用户的链上有效余额（钱包 + 质押），供余额快照复用（零额外链上读取）
  for (const [userId, wallet] of walletByUser) {
    if (balanceByWallet.has(wallet)) result.chainByUser.set(userId, balanceByWallet.get(wallet)!)
  }

  // 计算某用户 L1-L3 下线的(钱包余额 + 质押本金)之和
  function teamVolume(userId: string): number {
    let total = 0
    let frontier = [userId]
    for (let depth = 1; depth <= 3; depth++) {
      const next: string[] = []
      for (const parent of frontier) {
        for (const child of childrenByParent.get(parent) || []) {
          next.push(child)
          const w = walletByUser.get(child)
          if (w && balanceByWallet.has(w)) total += balanceByWallet.get(w)!
        }
      }
      frontier = next
      if (frontier.length === 0) break
    }
    return total
  }

  const now = new Date().toISOString()
  for (const s of statuses as StatusRow[]) {
    result.scanned++
    const volume = teamVolume(s.user_id)
    const earnedBase = earnedBaseFor(volume, s.is_influencer, levelList)
    const newRealLevel = earnedBase + 1

    // admin-set 用户：只更新 real_level（真实等级）与缓存业绩，current_level 保持管理员设定
    const update: Record<string, unknown> = {
      team_volume_l123: volume,
      team_volume_updated_at: now,
      real_level: newRealLevel,
      updated_at: now,
    }
    if (!s.is_admin_set) update.current_level = newRealLevel

    const levelChanged = s.is_admin_set
      ? s.real_level !== newRealLevel
      : s.current_level !== newRealLevel || s.real_level !== newRealLevel
    const volumeChanged = Math.abs(Number(s.team_volume_l123) - volume) > 0.01

    if (!levelChanged && !volumeChanged) continue

    const { error } = await supabase
      .from('user_community_status')
      .update(update)
      .eq('user_id', s.user_id)
    if (error) continue

    result.updated++
    result.changes.push({
      userId: s.user_id,
      volumeBefore: Number(s.team_volume_l123),
      volumeAfter: volume,
      levelBefore: s.is_admin_set ? s.real_level : s.current_level,
      levelAfter: newRealLevel,
    })
  }

  return result
}
