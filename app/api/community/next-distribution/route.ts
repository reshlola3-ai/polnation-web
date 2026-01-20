import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// 获取下一次发放时间
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取最后一次社群收益发放记录
    const { data: lastEarning } = await supabaseAdmin
      .from('community_daily_earnings')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // 默认每24小时发放一次
    const intervalHours = 24
    
    let nextDistributionAt: Date

    if (lastEarning?.created_at) {
      const lastTime = new Date(lastEarning.created_at)
      nextDistributionAt = new Date(lastTime.getTime() + intervalHours * 60 * 60 * 1000)
    } else {
      // 如果没有发放记录，设置为今天晚上8点（UTC+8 的话是 12:00 UTC）
      const now = new Date()
      nextDistributionAt = new Date(now)
      nextDistributionAt.setUTCHours(12, 0, 0, 0) // 设置为 12:00 UTC (20:00 UTC+8)
      
      // 如果已经过了今天的发放时间，设置为明天
      if (nextDistributionAt <= now) {
        nextDistributionAt.setDate(nextDistributionAt.getDate() + 1)
      }
    }

    const now = new Date()
    const secondsRemaining = Math.max(0, Math.floor((nextDistributionAt.getTime() - now.getTime()) / 1000))

    return NextResponse.json({
      next_distribution_at: nextDistributionAt.toISOString(),
      seconds_remaining: secondsRemaining,
      interval_hours: intervalHours,
    })
  } catch (error) {
    console.error('Error fetching next distribution:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
