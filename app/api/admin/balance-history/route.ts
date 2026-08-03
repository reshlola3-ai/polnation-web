import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { analyzeAllGrowth, userBalanceHistory } from '@/lib/balance-snapshots'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// 资金变动查阅：无 user 参数 → 全站最近两次快照的增减；有 user → 该用户资金时间线。
export async function GET(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

    const url = new URL(request.url)
    let userId = url.searchParams.get('user')
    const search = url.searchParams.get('search')?.trim()
  try {
    // 按用户名/邮箱搜索 → 解析出 user_id
    if (!userId && search) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .or(`username.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(1)
        .maybeSingle()
      if (!data?.id) {
        return NextResponse.json({ history: { username: null, rows: [], notFound: true } })
      }
      userId = data.id as string
    }
    if (userId) {
      const history = await userBalanceHistory(supabase, userId)
      return NextResponse.json({ history })
    }
    const growth = await analyzeAllGrowth(supabase)
    return NextResponse.json({ growth })
  } catch (error) {
    console.error('balance-history error:', error)
    return NextResponse.json({ error: 'Failed to load balance history' }, { status: 500 })
  }
}
