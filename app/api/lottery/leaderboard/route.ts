import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll() } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// 本周(ISO 周, 周一 00:00 UTC)起点
export function isoWeekStart(d = new Date()): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() // 0=周日
  const diff = (day === 0 ? 6 : day - 1) // 距离本周一的天数
  date.setUTCDate(date.getUTCDate() - diff)
  return date
}

function maskName(username: string | null, tg: string | null): string {
  const raw = (tg || username || '').replace(/^@/, '').trim()
  if (!raw) return 'user***'
  if (raw.length <= 2) return raw[0] + '***'
  return raw.slice(0, 2) + '***'
}

export const PRIZES = [5, 3, 2] // top1/2/3 USDC

// GET: 本周邀请周榜（按本周新增下线人数排名）+ 调用者自己的排名
export async function GET() {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ top: [], me: null, prizes: PRIZES })

  try {
    const weekStart = isoWeekStart().toISOString()

    // 本周新注册且有推荐人的下线 → 按 referrer_id 聚合计数
    const { data: rows } = await admin
      .from('profiles')
      .select('referrer_id')
      .not('referrer_id', 'is', null)
      .gte('created_at', weekStart)
      .limit(5000)

    const counts = new Map<string, number>()
    for (const r of rows || []) {
      const id = r.referrer_id as string
      counts.set(id, (counts.get(id) || 0) + 1)
    }

    const ranked = Array.from(counts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)

    const meId = await getUserId()
    const meIndex = meId ? ranked.findIndex((r) => r.userId === meId) : -1
    const me = meId
      ? {
          rank: meIndex >= 0 ? meIndex + 1 : null,
          count: meIndex >= 0 ? ranked[meIndex].count : (counts.get(meId) || 0),
        }
      : null

    const topRanked = ranked.slice(0, 10)
    const ids = topRanked.map((r) => r.userId)
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id, username, telegram_username').in('id', ids)
      : { data: [] }
    const nameById = new Map(
      (profiles || []).map((p) => [p.id, maskName(p.username, p.telegram_username)]),
    )

    const top = topRanked.map((r, i) => ({
      rank: i + 1,
      name: nameById.get(r.userId) || 'user***',
      count: r.count,
      prize: PRIZES[i] ?? 0,
      isMe: r.userId === meId,
    }))

    return NextResponse.json({ top, me, prizes: PRIZES })
  } catch (err) {
    console.error('leaderboard error:', err)
    return NextResponse.json({ top: [], me: null, prizes: PRIZES })
  }
}
