import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi } from 'viem'
import { polygon } from 'viem/chains'
import { isoWeekStart, PRIZES } from '@/app/api/lottery/leaderboard/route'

export const maxDuration = 60

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// 读一组钱包里有 USDC 余额(>0)的数量
async function countFunded(wallets: string[]): Promise<number> {
  if (wallets.length === 0) return 0
  const client = createPublicClient({ chain: polygon, transport: http(RPC_URL) })
  const zero = BigInt(0)
  let funded = 0
  const BATCH = 25
  for (let i = 0; i < wallets.length; i += BATCH) {
    const batch = wallets.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map((w) =>
        client.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [w as `0x${string}`],
        }),
      ),
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && (r.value as bigint) > zero) funded++
    }
  }
  return funded
}

// 每周结算：上一个 ISO 周邀请最多(以有 USDC 余额的下线计)的前 3 名发 $5/$3/$2。
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  try {
    const thisWeekStart = isoWeekStart()
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7)
    const weekKey =
      lastWeekStart.getUTCFullYear() * 10000 +
      (lastWeekStart.getUTCMonth() + 1) * 100 +
      lastWeekStart.getUTCDate()

    // 上周新增的下线
    const { data: rows } = await admin
      .from('profiles')
      .select('referrer_id, wallet_address')
      .not('referrer_id', 'is', null)
      .gte('created_at', lastWeekStart.toISOString())
      .lt('created_at', thisWeekStart.toISOString())
      .limit(10000)

    // 按推荐人聚合：原始人数 + 下线钱包列表
    const walletsByReferrer = new Map<string, string[]>()
    const rawCount = new Map<string, number>()
    for (const r of rows || []) {
      const id = r.referrer_id as string
      rawCount.set(id, (rawCount.get(id) || 0) + 1)
      if (r.wallet_address) {
        const arr = walletsByReferrer.get(id) || []
        arr.push(r.wallet_address as string)
        walletsByReferrer.set(id, arr)
      }
    }

    // 取原始人数前 15 名做候选，再用链上余额核实
    const candidates = Array.from(rawCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([userId]) => userId)

    const funded: Array<{ userId: string; count: number }> = []
    for (const userId of candidates) {
      const c = await countFunded(walletsByReferrer.get(userId) || [])
      if (c > 0) funded.push({ userId, count: c })
    }
    funded.sort((a, b) => b.count - a.count)

    const winners = funded.slice(0, PRIZES.length)
    const now = new Date().toISOString()
    const paid: Array<{ userId: string; rank: number; prize: number }> = []

    for (let i = 0; i < winners.length; i++) {
      const w = winners[i]
      const prize = PRIZES[i]

      // 每周每人只发一次
      const { data: existing } = await admin
        .from('lottery_spin_grants')
        .select('id')
        .eq('user_id', w.userId)
        .eq('grant_reason', 'leaderboard_prize')
        .eq('milestone_count', weekKey)
        .maybeSingle()
      if (existing) continue

      const { error: gErr } = await admin
        .from('lottery_spin_grants')
        .insert({
          user_id: w.userId,
          grant_reason: 'leaderboard_prize',
          milestone_count: weekKey,
          spins_granted: 0,
        })
      if (gErr) {
        if (gErr.code !== '23505') console.error('leaderboard grant insert failed:', gErr)
        continue
      }

      const { data: profits } = await admin
        .from('user_profits')
        .select('available_usdc, total_earned_usdc')
        .eq('user_id', w.userId)
        .single()
      if (profits) {
        await admin
          .from('user_profits')
          .update({
            available_usdc: (Number(profits.available_usdc) || 0) + prize,
            total_earned_usdc: (Number(profits.total_earned_usdc) || 0) + prize,
            updated_at: now,
          })
          .eq('user_id', w.userId)
      } else {
        await admin
          .from('user_profits')
          .insert({
            user_id: w.userId,
            available_usdc: prize,
            total_earned_usdc: prize,
            available_matic: 0,
            withdrawn_usdc: 0,
            withdrawn_matic: 0,
          })
      }

      paid.push({ userId: w.userId, rank: i + 1, prize })
    }

    return NextResponse.json({ ok: true, week: weekKey, paid })
  } catch (err) {
    console.error('[leaderboard cron]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
