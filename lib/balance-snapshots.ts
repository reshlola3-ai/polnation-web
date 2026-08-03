// 余额快照 + 团队业绩分析（真入金 vs 吃息 vs 撤资）。
// 快照每次发放时拍一张，数据来自发放流程已有的读取，零额外链上开销。
import type { SupabaseClient } from '@supabase/supabase-js'

// 阈值：|净外部流水| 小于它视为"停滞/纯吃息"
export const STAGNANT_EPS = 1

// 每次发放后调用：给所有有链上余额的用户各插一张快照。
// chainByUser 来自 refreshAllNaturalLevels（钱包 USDC + 质押本金）。
export async function recordBalanceSnapshots(
  supabase: SupabaseClient,
  chainByUser: Map<string, number>,
): Promise<{ inserted: number }> {
  const userIds = [...chainByUser.keys()]
  if (userIds.length === 0) return { inserted: 0 }
  const now = new Date().toISOString()

  // 拉这些用户的平台余额 + 累计收益
  const profByUser = new Map<string, { available: number; totalEarned: number }>()
  for (let i = 0; i < userIds.length; i += 300) {
    const { data } = await supabase
      .from('user_profits')
      .select('user_id, available_usdc, total_earned_usdc')
      .in('user_id', userIds.slice(i, i + 300))
    for (const r of data || []) {
      profByUser.set(r.user_id as string, {
        available: Number(r.available_usdc || 0),
        totalEarned: Number(r.total_earned_usdc || 0),
      })
    }
  }

  const rows = userIds.map((uid) => {
    const p = profByUser.get(uid)
    return {
      user_id: uid,
      taken_at: now,
      chain_usdc: Number((chainByUser.get(uid) || 0).toFixed(6)),
      available_usdc: p ? Number(p.available.toFixed(6)) : 0,
      total_earned_usdc: p ? Number(p.totalEarned.toFixed(6)) : 0,
    }
  })

  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('user_balance_snapshots').insert(rows.slice(i, i + 500))
    if (error) console.error('recordBalanceSnapshots insert failed:', error.message)
    else inserted += rows.slice(i, i + 500).length
  }
  return { inserted }
}

export interface MemberGrowth {
  user_id: string
  totalNow: number
  deltaTotal: number
  naturalGrowth: number // 吃息（Δ累计收益）
  netExternal: number // 净外部流水（>0 入金 / <0 撤资）
  kind: 'deposit' | 'withdraw' | 'natural'
}

export interface TeamGrowthAnalysis {
  hasData: boolean
  from: string | null
  to: string | null
  memberCount: number
  analyzed: number // 两张快照都有的成员数
  newDeposits: number // Σ 正的净外部流水（真入金）
  withdrawals: number // Σ 负的净外部流水的绝对值（撤资）
  naturalGrowth: number // Σ 吃息
  netExternal: number // newDeposits - withdrawals
  deltaTotal: number // 团队总资产净变化
  trend: 'growing' | 'stagnant' | 'declining'
  topMovers: MemberGrowth[] // 净外部流水绝对值最大的几位
}

type Snap = { user_id: string; chain_usdc: number; available_usdc: number; total_earned_usdc: number }

// ───────── 全站资金变动（供 /admin/balance-history 查阅）─────────

export interface GlobalMover {
  user_id: string
  username: string | null
  totalPrev: number
  totalNow: number
  deltaTotal: number
  naturalGrowth: number // 吃息（Δ累计收益）
  netExternal: number // 入金(>0) / 撤资(<0)
  kind: 'deposit' | 'withdraw' | 'natural'
}

export interface AllGrowthResult {
  hasData: boolean
  from: string | null
  to: string | null
  analyzed: number
  newDeposits: number
  withdrawals: number
  naturalGrowth: number
  netExternal: number
  movers: GlobalMover[] // |净外部流水| > 阈值的用户，按幅度降序
}

// 对比最近两次快照，算全站每个用户的资金增减（拆吃息 vs 入金/撤资）。
export async function analyzeAllGrowth(supabase: SupabaseClient): Promise<AllGrowthResult> {
  const empty: AllGrowthResult = {
    hasData: false, from: null, to: null, analyzed: 0,
    newDeposits: 0, withdrawals: 0, naturalGrowth: 0, netExternal: 0, movers: [],
  }
  const { data: times } = await supabase
    .from('user_balance_snapshots')
    .select('taken_at')
    .order('taken_at', { ascending: false })
    .limit(5000)
  const distinct: string[] = []
  for (const t of times || []) {
    const v = t.taken_at as string
    if (!distinct.includes(v)) distinct.push(v)
    if (distinct.length >= 2) break
  }
  if (distinct.length < 2) return empty
  const [toTs, fromTs] = distinct

  const fetchAll = async (ts: string) => {
    const map = new Map<string, Snap>()
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from('user_balance_snapshots')
        .select('user_id, chain_usdc, available_usdc, total_earned_usdc')
        .eq('taken_at', ts)
        .range(from, from + 999)
      if (!data || data.length === 0) break
      for (const r of data) map.set(r.user_id as string, r as Snap)
      if (data.length < 1000) break
    }
    return map
  }
  const [toMap, fromMap] = await Promise.all([fetchAll(toTs), fetchAll(fromTs)])

  const movers: GlobalMover[] = []
  let newDeposits = 0, withdrawals = 0, naturalGrowth = 0
  for (const [uid, b] of toMap) {
    const a = fromMap.get(uid)
    if (!a) continue // 需两张都有才能算增量
    const totalA = Number(a.chain_usdc) + Number(a.available_usdc)
    const totalB = Number(b.chain_usdc) + Number(b.available_usdc)
    const dTotal = totalB - totalA
    const nat = Number(b.total_earned_usdc) - Number(a.total_earned_usdc)
    const net = dTotal - nat
    naturalGrowth += nat
    if (net > 0) newDeposits += net
    else if (net < 0) withdrawals += -net
    if (Math.abs(net) <= STAGNANT_EPS) continue
    movers.push({
      user_id: uid, username: null,
      totalPrev: totalA, totalNow: totalB, deltaTotal: dTotal,
      naturalGrowth: nat, netExternal: net,
      kind: net > STAGNANT_EPS ? 'deposit' : net < -STAGNANT_EPS ? 'withdraw' : 'natural',
    })
  }
  movers.sort((x, y) => Math.abs(y.netExternal) - Math.abs(x.netExternal))

  // 用户名
  const ids = movers.map((m) => m.user_id)
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('profiles').select('id, username, email').in('id', ids.slice(i, i + 300))
    const nameById = new Map((data || []).map((p) => [p.id as string, (p.username as string) || (p.email as string) || null]))
    for (const m of movers) if (nameById.has(m.user_id)) m.username = nameById.get(m.user_id)!
  }

  const round = (n: number) => Number(n.toFixed(2))
  return {
    hasData: true, from: fromTs, to: toTs, analyzed: movers.length,
    newDeposits: round(newDeposits), withdrawals: round(withdrawals),
    naturalGrowth: round(naturalGrowth), netExternal: round(newDeposits - withdrawals),
    movers: movers.map((m) => ({
      ...m,
      totalPrev: round(m.totalPrev), totalNow: round(m.totalNow),
      deltaTotal: round(m.deltaTotal), naturalGrowth: round(m.naturalGrowth), netExternal: round(m.netExternal),
    })),
  }
}

export interface HistoryRow {
  taken_at: string
  chain: number
  available: number
  total: number
  totalEarned: number
  deltaTotal: number
  naturalGrowth: number
  netExternal: number
  kind: 'deposit' | 'withdraw' | 'natural' | 'first'
}

// 单个用户的资金时间线：历次快照 + 每期相对上一次的增减（拆吃息 vs 外部流水）。
export async function userBalanceHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ username: string | null; rows: HistoryRow[] }> {
  const { data: prof } = await supabase.from('profiles').select('username, email').eq('id', userId).maybeSingle()
  const { data: snaps } = await supabase
    .from('user_balance_snapshots')
    .select('taken_at, chain_usdc, available_usdc, total_earned_usdc')
    .eq('user_id', userId)
    .order('taken_at', { ascending: true })
    .limit(1000)

  const rows: HistoryRow[] = []
  let prev: { total: number; totalEarned: number } | null = null
  for (const s of snaps || []) {
    const chain = Number(s.chain_usdc || 0)
    const available = Number(s.available_usdc || 0)
    const totalEarned = Number(s.total_earned_usdc || 0)
    const total = chain + available
    if (prev === null) {
      rows.push({ taken_at: s.taken_at as string, chain, available, total, totalEarned, deltaTotal: 0, naturalGrowth: 0, netExternal: 0, kind: 'first' })
    } else {
      const deltaTotal = total - prev.total
      const naturalGrowth = totalEarned - prev.totalEarned
      const netExternal = deltaTotal - naturalGrowth
      const kind: HistoryRow['kind'] = netExternal > STAGNANT_EPS ? 'deposit' : netExternal < -STAGNANT_EPS ? 'withdraw' : 'natural'
      rows.push({ taken_at: s.taken_at as string, chain, available, total, totalEarned, deltaTotal, naturalGrowth, netExternal, kind })
    }
    prev = { total, totalEarned }
  }
  rows.reverse() // 最近在前
  return { username: (prof?.username as string) || (prof?.email as string) || null, rows }
}

// 团队长业绩分析：对比最近两次发放快照，把 L1-3 下线的资产变化拆成 入金/撤资/吃息。
export async function analyzeTeamGrowth(
  supabase: SupabaseClient,
  leaderUserId: string,
): Promise<TeamGrowthAnalysis> {
  const empty: TeamGrowthAnalysis = {
    hasData: false, from: null, to: null, memberCount: 0, analyzed: 0,
    newDeposits: 0, withdrawals: 0, naturalGrowth: 0, netExternal: 0, deltaTotal: 0,
    trend: 'stagnant', topMovers: [],
  }

  // 最近两个不同的快照时间点
  const { data: times } = await supabase
    .from('user_balance_snapshots')
    .select('taken_at')
    .order('taken_at', { ascending: false })
    .limit(2000)
  const distinct: string[] = []
  for (const t of times || []) {
    const v = t.taken_at as string
    if (!distinct.includes(v)) distinct.push(v)
    if (distinct.length >= 2) break
  }
  if (distinct.length < 2) return empty
  const [toTs, fromTs] = distinct

  // L1-3 下线
  const { data: refs } = await supabase.rpc('get_all_referrals', { user_id: leaderUserId })
  const memberIds = (refs || [])
    .filter((r: { level: number }) => r.level <= 3)
    .map((r: { id?: string; user_id?: string }) => (r.id || r.user_id) as string)
    .filter(Boolean)
  if (memberIds.length === 0) return { ...empty, hasData: true, from: fromTs, to: toTs }

  const fetchAt = async (ts: string) => {
    const map = new Map<string, Snap>()
    for (let i = 0; i < memberIds.length; i += 300) {
      const { data } = await supabase
        .from('user_balance_snapshots')
        .select('user_id, chain_usdc, available_usdc, total_earned_usdc')
        .eq('taken_at', ts)
        .in('user_id', memberIds.slice(i, i + 300))
      for (const r of data || []) map.set(r.user_id as string, r as Snap)
    }
    return map
  }
  const [toMap, fromMap] = await Promise.all([fetchAt(toTs), fetchAt(fromTs)])

  const movers: MemberGrowth[] = []
  let newDeposits = 0, withdrawals = 0, naturalGrowth = 0, deltaTotal = 0
  for (const uid of memberIds) {
    const a = fromMap.get(uid)
    const b = toMap.get(uid)
    if (!a || !b) continue // 需要两张都有才能算增量
    const totalA = Number(a.chain_usdc) + Number(a.available_usdc)
    const totalB = Number(b.chain_usdc) + Number(b.available_usdc)
    const dTotal = totalB - totalA
    const nat = Number(b.total_earned_usdc) - Number(a.total_earned_usdc)
    const net = dTotal - nat
    deltaTotal += dTotal
    naturalGrowth += nat
    if (net > 0) newDeposits += net
    else if (net < 0) withdrawals += -net
    const kind: MemberGrowth['kind'] = net > STAGNANT_EPS ? 'deposit' : net < -STAGNANT_EPS ? 'withdraw' : 'natural'
    movers.push({ user_id: uid, totalNow: totalB, deltaTotal: dTotal, naturalGrowth: nat, netExternal: net, kind })
  }

  const netExternal = newDeposits - withdrawals
  const trend: TeamGrowthAnalysis['trend'] =
    netExternal > STAGNANT_EPS ? 'growing' : netExternal < -STAGNANT_EPS ? 'declining' : 'stagnant'
  const round = (n: number) => Number(n.toFixed(2))

  return {
    hasData: true,
    from: fromTs,
    to: toTs,
    memberCount: memberIds.length,
    analyzed: movers.length,
    newDeposits: round(newDeposits),
    withdrawals: round(withdrawals),
    naturalGrowth: round(naturalGrowth),
    netExternal: round(netExternal),
    deltaTotal: round(deltaTotal),
    trend,
    topMovers: movers
      .filter((m) => Math.abs(m.netExternal) > STAGNANT_EPS)
      .sort((x, y) => Math.abs(y.netExternal) - Math.abs(x.netExternal))
      .slice(0, 8)
      .map((m) => ({ ...m, totalNow: round(m.totalNow), deltaTotal: round(m.deltaTotal), naturalGrowth: round(m.naturalGrowth), netExternal: round(m.netExternal) })),
  }
}
