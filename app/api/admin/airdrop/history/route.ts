import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface MiniProfile {
  username: string | null
  email: string | null
}

// 管理后台：空投发放历史 + 单轮逐人明细
export async function GET(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const roundId = new URL(request.url).searchParams.get('round_id')

  try {
    // 收集所有涉及的 user_id，统一查一次 profiles 再映射，避免 FK 嵌入歧义
    const profileCache = new Map<string, MiniProfile>()
    const loadProfiles = async (ids: string[]) => {
      const missing = [...new Set(ids)].filter((id) => id && !profileCache.has(id))
      if (missing.length === 0) return
      const { data } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', missing)
      for (const p of data || []) {
        profileCache.set(p.id, { username: p.username, email: p.email })
      }
    }
    const pf = (id: string | null) => (id ? profileCache.get(id) || null : null)

    // ============ 单轮逐人明细 ============
    if (roundId) {
      const { data: round } = await supabase
        .from('airdrop_rounds')
        .select('*')
        .eq('id', roundId)
        .single()

      if (!round) {
        return NextResponse.json({ error: 'Round not found' }, { status: 404 })
      }

      const roundDate = (round.distributed_at || round.snapshot_at || '').split('T')[0]

      const [{ data: airdrops }, { data: commissions }, { data: community }] = await Promise.all([
        supabase
          .from('airdrop_calculations')
          .select('user_id, usdc_balance, tier_level, rate_percent, profit_usdc')
          .eq('round_id', roundId)
          .order('profit_usdc', { ascending: false }),
        supabase
          .from('referral_commissions')
          .select('beneficiary_id, source_user_id, level, source_profit, commission_rate, commission_amount')
          .eq('round_id', roundId)
          .order('commission_amount', { ascending: false }),
        roundDate
          ? supabase
              .from('community_daily_earnings')
              .select('user_id, level, reward_pool, daily_rate, momentum_multiplier, earning_amount')
              .eq('earning_date', roundDate)
              .order('earning_amount', { ascending: false })
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      ])

      // 预加载所有用户资料
      await loadProfiles([
        ...(airdrops || []).map((a) => a.user_id),
        ...(commissions || []).flatMap((c) => [c.beneficiary_id, c.source_user_id]),
        ...(community || []).map((c) => c.user_id as string),
      ])

      return NextResponse.json({
        round: {
          id: round.id,
          round_number: round.round_number,
          distributed_at: round.distributed_at,
          snapshot_at: round.snapshot_at,
        },
        airdrops: (airdrops || []).map((a) => ({
          ...a,
          profile: pf(a.user_id),
        })),
        commissions: (commissions || []).map((c) => ({
          ...c,
          beneficiary: pf(c.beneficiary_id),
          source: pf(c.source_user_id),
        })),
        community: (community || []).map((c) => ({
          ...c,
          profile: pf(c.user_id as string),
        })),
      })
    }

    // ============ 历史发放列表 ============
    const { data: rounds } = await supabase
      .from('airdrop_rounds')
      .select('id, round_number, snapshot_at, total_users, total_usdc, distributed_at')
      .eq('status', 'distributed')
      .order('distributed_at', { ascending: false })
      .limit(60)

    const roundList = rounds || []
    const roundIds = roundList.map((r) => r.id)

    // 佣金按 round_id 聚合
    const commByRound = new Map<string, { sum: number; count: number }>()
    if (roundIds.length > 0) {
      const { data: comms } = await supabase
        .from('referral_commissions')
        .select('round_id, commission_amount')
        .in('round_id', roundIds)
      for (const c of comms || []) {
        const e = commByRound.get(c.round_id) || { sum: 0, count: 0 }
        e.sum += Number(c.commission_amount) || 0
        e.count += 1
        commByRound.set(c.round_id, e)
      }
    }

    // 社群池按发放日期聚合（community_daily_earnings 无 round_id，按日期对齐）
    const commByDate = new Map<string, { sum: number; count: number }>()
    const dates = [...new Set(roundList.map((r) => (r.distributed_at || '').split('T')[0]).filter(Boolean))]
    if (dates.length > 0) {
      const { data: earns } = await supabase
        .from('community_daily_earnings')
        .select('earning_date, earning_amount')
        .in('earning_date', dates)
      for (const e of earns || []) {
        const cur = commByDate.get(e.earning_date) || { sum: 0, count: 0 }
        cur.sum += Number(e.earning_amount) || 0
        cur.count += 1
        commByDate.set(e.earning_date, cur)
      }
    }

    const list = roundList.map((r) => {
      const comm = commByRound.get(r.id) || { sum: 0, count: 0 }
      const dateKey = (r.distributed_at || '').split('T')[0]
      const community = commByDate.get(dateKey) || { sum: 0, count: 0 }
      return {
        id: r.id,
        round_number: r.round_number,
        distributed_at: r.distributed_at,
        snapshot_at: r.snapshot_at,
        total_users: r.total_users,
        total_usdc: r.total_usdc,
        commission_total: comm.sum,
        commission_count: comm.count,
        community_total: community.sum,
        community_count: community.count,
      }
    })

    return NextResponse.json({ rounds: list })
  } catch (error) {
    console.error('Airdrop history error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
