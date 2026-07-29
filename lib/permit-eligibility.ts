// 空投资格的单一判据：一个用户「有有效签名」当且仅当他存在一条
//   status='pending' 且 deadline > now 且 owner_address == 他当前绑定钱包
//   且 签名的 nonce == 该钱包当前链上 USDC nonce
// 的 permit 签名。calculate / distribute / admin 面板 / 提现门共用此判据，
// 避免同一规则在多处漂移（今天多次踩过这个坑）。
//
// 为什么要匹配绑定钱包：空投利润是按 profile.wallet_address 的链上余额算的，
// 签名必须授权的正是同一个钱包，这笔收益才算有真实授权背书。曾发现 1 例
// owner_address 与绑定钱包不一致（用旧钱包签、绑新钱包），只按 user_id 匹配会漏掉。
//
// 为什么要校验 nonce：permit 是 EIP-2612，只有在「签名时的 nonce == 当前链上
// nonce」时才可执行。用户参与 AlphaStake（stakeWithPermit）会推进 USDC nonce，
// 使之前那张空投 permit 永久失效（"Nonce mismatch / Cannot execute"）。不校验
// nonce 就会给一张根本执行不了的签名照发奖励。稳健起见：只有在「确认链上 nonce
// 与签名 nonce 不一致」时才排除；读链失败/取不到 nonce 时退回旧判据，避免 RPC
// 抖动误伤正常用户。

import type { SupabaseClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi } from 'viem'
import { polygon } from 'viem/chains'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const NONCES_ABI = parseAbi(['function nonces(address owner) view returns (uint256)'])

function alphaPublicClient() {
  return createPublicClient({ chain: polygon, transport: http(RPC_URL) })
}

// 质押豁免：有活跃(未平仓)AlphaStake 仓位的钱包。参与质押的 stakeWithPermit 会用掉
// permit、令旧空投签名 nonce 失效——不应因此扣他们的奖励。读链失败 → 空集(退回仅签名)。
async function activeStakerWallets(): Promise<Set<string>> {
  try {
    const alpha = await fetchOnChainAlphaSummary()
    if (!alpha.configured) return new Set()
    return new Set(alpha.positions.filter((p) => !p.closed).map((p) => p.user.toLowerCase()))
  } catch {
    return new Set()
  }
}

// 单用户：该用户当前是否有活跃质押仓位（用于提现门/发放的质押豁免）。
export async function isActiveStaker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', userId)
    .maybeSingle()
  const wallet = ((profile?.wallet_address as string | null) ?? null)?.toLowerCase() ?? null
  if (!wallet) return false
  const stakers = await activeStakerWallets()
  return stakers.has(wallet)
}

export interface SignatureStatus {
  // 有 pending + 未过期 + owner_address==绑定钱包 + nonce 匹配 的签名 → 可发空投
  signedUserIds: Set<string>
  // 有 pending 签名但没有一条匹配当前钱包 → 显示为「签了但钱包不匹配」，仍不可发
  mismatchUserIds: Set<string>
}

// 单用户版本，与 loadSignatureStatus 同一判据（pending + 未过期 + owner==绑定钱包 + nonce 匹配）。
// 用于提现门与 profits/user 的 canWithdraw：单次请求只查一个人，避免全表扫描。
export async function hasValidSignature(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', userId)
    .maybeSingle()
  const wallet = ((profile?.wallet_address as string | null) ?? null)?.toLowerCase() ?? null
  if (!wallet) return false

  const now = Math.floor(Date.now() / 1000)
  const { data: sigs } = await supabase
    .from('permit_signatures')
    .select('owner_address, deadline, nonce')
    .eq('user_id', userId)
    .eq('status', 'pending')

  const candidates = (sigs || []).filter(
    (s) => (((s.owner_address as string) ?? '').toLowerCase() === wallet) && Number(s.deadline) > now,
  )
  if (candidates.length === 0) return false

  // 链上 nonce 校验。读失败 → 退回旧判据（此处即视为有效），不因 RPC 抖动误伤。
  let onChainNonce: bigint | null = null
  try {
    onChainNonce = (await alphaPublicClient().readContract({
      address: USDC_ADDRESS,
      abi: NONCES_ABI,
      functionName: 'nonces',
      args: [wallet as `0x${string}`],
    })) as bigint
  } catch {
    onChainNonce = null
  }
  if (onChainNonce === null) return true

  return candidates.some((s) => {
    if (s.nonce == null) return true // 无存储 nonce → 无法校验，不新增排除
    try {
      return BigInt(s.nonce as number | string) === onChainNonce
    } catch {
      return true
    }
  })
}

export async function loadSignatureStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<SignatureStatus> {
  const now = Math.floor(Date.now() / 1000)

  // 1) 拉所有 pending 签名（分页；deadline 在内存里过滤，避免类型/时区歧义）
  const sigs: Array<{ user_id: string; owner_address: string; deadline: number; nonce: string | number | null }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('permit_signatures')
      .select('user_id, owner_address, deadline, nonce')
      .eq('status', 'pending')
      .range(from, from + 999)
    if (error) throw new Error(`permit_signatures load failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) {
      sigs.push({
        user_id: r.user_id as string,
        owner_address: (r.owner_address as string) ?? '',
        deadline: Number(r.deadline),
        nonce: (r.nonce as string | number | null) ?? null,
      })
    }
    if (data.length < 1000) break
  }

  const deadlineValid = sigs.filter((s) => s.deadline > now)

  // 2) 批量读链上 nonce（去重 owner，multicall allowFailure）。读失败的 owner 不参与排除。
  const owners = [...new Set(deadlineValid.map((s) => s.owner_address.toLowerCase()).filter(Boolean))]
  const nonceByOwner = new Map<string, bigint>()
  if (owners.length > 0) {
    const client = alphaPublicClient()
    const BATCH = 100
    for (let i = 0; i < owners.length; i += BATCH) {
      const batch = owners.slice(i, i + BATCH)
      try {
        const reads = await client.multicall({
          contracts: batch.map((w) => ({
            address: USDC_ADDRESS,
            abi: NONCES_ABI,
            functionName: 'nonces',
            args: [w as `0x${string}`],
          })),
          allowFailure: true,
        })
        reads.forEach((r, j) => {
          if (r.status === 'success') nonceByOwner.set(batch[j], r.result as bigint)
        })
      } catch {
        // 整批读失败 → 这批 owner 不参与 nonce 排除（退回旧判据）
      }
    }
  }

  // 只有「确认链上 nonce 与签名 nonce 不一致」才丢弃该签名；其余情况保留。
  const validSigs = deadlineValid.filter((s) => {
    if (s.nonce == null) return true
    const oc = nonceByOwner.get(s.owner_address.toLowerCase())
    if (oc === undefined) return true // 读失败/未取到 → 不新增排除
    try {
      return BigInt(s.nonce) === oc
    } catch {
      return true
    }
  })

  const sigUserIds = [...new Set(validSigs.map((s) => s.user_id))]

  // 3) 拉这些 user 的当前绑定钱包
  const walletByUser = new Map<string, string | null>()
  for (let i = 0; i < sigUserIds.length; i += 300) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, wallet_address')
      .in('id', sigUserIds.slice(i, i + 300))
    if (error) throw new Error(`profiles load failed: ${error.message}`)
    for (const p of data || []) {
      walletByUser.set(p.id as string, ((p.wallet_address as string | null) ?? null)?.toLowerCase() ?? null)
    }
  }

  // 4) 匹配：某 user 只要有一条签名 owner==其绑定钱包 → signed；否则若他有签名 → mismatch
  const signedUserIds = new Set<string>()
  const usersWithAnySig = new Set<string>()
  for (const s of validSigs) {
    usersWithAnySig.add(s.user_id)
    const wallet = walletByUser.get(s.user_id) ?? null
    if (wallet && s.owner_address.toLowerCase() === wallet) signedUserIds.add(s.user_id)
  }
  const mismatchUserIds = new Set<string>()
  for (const uid of usersWithAnySig) {
    if (!signedUserIds.has(uid)) mismatchUserIds.add(uid)
  }

  // 质押豁免：有活跃质押仓位的用户，即使签名失效/未签也计入发放资格
  // （质押已用掉 permit 使旧签名失效，不因此扣奖励；用户端仍会提醒重签）。
  const stakerWallets = await activeStakerWallets()
  if (stakerWallets.size > 0) {
    const walletsArr = [...stakerWallets]
    for (let i = 0; i < walletsArr.length; i += 300) {
      const { data } = await supabase
        .from('profiles')
        .select('id, wallet_address')
        .in('wallet_address', walletsArr.slice(i, i + 300))
      for (const p of data || []) {
        if (!p.wallet_address) continue
        signedUserIds.add(p.id as string)
        mismatchUserIds.delete(p.id as string)
      }
    }
  }

  return { signedUserIds, mismatchUserIds }
}
