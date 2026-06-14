import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// 姓名打码：保留前 1-2 个字符，其余用 *** 隐去（社会证明用，不暴露完整身份）
function maskName(username: string | null, tg: string | null): string {
  const raw = (tg || username || '').replace(/^@/, '').trim()
  if (!raw) return 'user***'
  if (raw.length <= 2) return raw[0] + '***'
  return raw.slice(0, 2) + '***'
}

interface Row {
  prize_amount?: number | null
  amount?: number | null
  usd_amount?: number | null
  created_at: string
  profile: { username: string | null; telegram_username: string | null } | null
}

// GET: 真实滚动播报 —— 最近的 USDC 中奖 + 完成的提现（姓名打码）
export async function GET() {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ events: [] })
  }

  try {
    const [winsRes, withdrawalsRes] = await Promise.all([
      admin
        .from('lottery_records')
        .select('prize_amount, created_at, profile:user_id(username, telegram_username)')
        .like('prize_type', 'usdc_%')
        .order('created_at', { ascending: false })
        .limit(25),
      admin
        .from('withdrawals')
        .select('amount, usd_amount, created_at, profile:user_id(username, telegram_username)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    const wins = ((winsRes.data || []) as unknown as Row[]).map((r) => ({
      type: 'win' as const,
      name: maskName(r.profile?.username ?? null, r.profile?.telegram_username ?? null),
      amount: Number(r.prize_amount) || 0,
      at: r.created_at,
    }))

    const withdrawals = ((withdrawalsRes.data || []) as unknown as Row[]).map((r) => ({
      type: 'withdrawal' as const,
      name: maskName(r.profile?.username ?? null, r.profile?.telegram_username ?? null),
      amount: Number(r.usd_amount) || Number(r.amount) || 0,
      at: r.created_at,
    }))

    // 合并后按时间倒序，去掉金额为 0 的，取前 30 条
    const events = [...wins, ...withdrawals]
      .filter((e) => e.amount > 0)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30)
      .map(({ type, name, amount }) => ({ type, name, amount }))

    return NextResponse.json({ events })
  } catch (err) {
    console.error('ticker error:', err)
    return NextResponse.json({ events: [] })
  }
}
