// 空投资格的单一判据：一个用户「有有效签名」当且仅当他存在一条
//   status='pending' 且 deadline > now 且 owner_address == 他当前绑定钱包
// 的 permit 签名。calculate / distribute / admin 面板三处共用此函数，
// 避免同一规则在多处漂移（今天多次踩过这个坑）。
//
// 为什么要匹配绑定钱包：空投利润是按 profile.wallet_address 的链上余额算的，
// 签名必须授权的正是同一个钱包，这笔收益才算有真实授权背书。曾发现 1 例
// owner_address 与绑定钱包不一致（用旧钱包签、绑新钱包），只按 user_id 匹配会漏掉。

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SignatureStatus {
  // 有 pending + 未过期 + owner_address==绑定钱包 的签名 → 可发空投
  signedUserIds: Set<string>
  // 有 pending 签名但没有一条匹配当前钱包 → 显示为「签了但钱包不匹配」，仍不可发
  mismatchUserIds: Set<string>
}

export async function loadSignatureStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<SignatureStatus> {
  const now = Math.floor(Date.now() / 1000)

  // 1) 拉所有 pending 签名（分页；deadline 在内存里过滤，避免类型/时区歧义）
  const sigs: Array<{ user_id: string; owner_address: string; deadline: number }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('permit_signatures')
      .select('user_id, owner_address, deadline')
      .eq('status', 'pending')
      .range(from, from + 999)
    if (error) throw new Error(`permit_signatures load failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) {
      sigs.push({ user_id: r.user_id as string, owner_address: (r.owner_address as string) ?? '', deadline: Number(r.deadline) })
    }
    if (data.length < 1000) break
  }

  const validSigs = sigs.filter((s) => s.deadline > now)
  const sigUserIds = [...new Set(validSigs.map((s) => s.user_id))]

  // 2) 拉这些 user 的当前绑定钱包
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

  // 3) 匹配：某 user 只要有一条签名 owner==其绑定钱包 → signed；否则若他有签名 → mismatch
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

  return { signedUserIds, mismatchUserIds }
}
