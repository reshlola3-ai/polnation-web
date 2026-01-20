import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// 获取上次社群每日收益发放时间
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取最近一次发放记录
    const { data: lastEarning } = await supabaseAdmin
      .from('community_daily_earnings')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      lastDistribution: lastEarning?.created_at || null,
    })
  } catch (error) {
    console.error('Error fetching last distribution:', error)
    return NextResponse.json({ lastDistribution: null })
  }
}
