import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getSupabaseUser() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { supabase: null, user: null }
  
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })
  
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取配置
    const { data: config } = await supabaseAdmin
      .from('airdrop_config')
      .select('*')
      .single()

    // 获取利润等级
    const { data: tiers } = await supabaseAdmin
      .from('profit_tiers')
      .select('*')
      .eq('is_active', true)
      .order('level')

    // 获取用户利润
    const { data: profits } = await supabaseAdmin
      .from('user_profits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 获取利润历史（最近20条）
    const { data: history } = await supabaseAdmin
      .from('profit_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // 获取提现记录
    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // 获取佣金记录（最近20条）
    const { data: commissions } = await supabaseAdmin
      .from('referral_commissions')
      .select(`
        *,
        source_user:profiles!referral_commissions_source_user_id_fkey(username, email)
      `)
      .eq('beneficiary_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // 计算下次发放时间
    let nextDistribution = null
    if (config?.last_distribution_at) {
      const lastDist = new Date(config.last_distribution_at)
      const intervalMs = (config.interval_seconds || 28800) * 1000
      const nextTime = new Date(lastDist.getTime() + intervalMs)
      const remaining = nextTime.getTime() - Date.now()
      
      if (remaining > 0) {
        nextDistribution = {
          next_at: nextTime.toISOString(),
          seconds_remaining: Math.ceil(remaining / 1000),
        }
      }
    }

    return NextResponse.json({
      profits: profits || {
        total_earned_usdc: 0,
        total_commission_earned: 0,
        available_usdc: 0,
        available_matic: 0,
        withdrawn_usdc: 0,
        withdrawn_matic: 0,
        current_tier: null,
      },
      history: history || [],
      commissions: commissions || [],
      withdrawals: withdrawals || [],
      tiers: tiers || [],
      config: {
        interval_seconds: config?.interval_seconds || 28800,
        min_withdrawal_usdc: config?.min_withdrawal_usdc || 0.1,
        min_withdrawal_matic: config?.min_withdrawal_matic || 0.1,
        last_distribution_at: config?.last_distribution_at,
      },
      next_distribution: nextDistribution,
    })
  } catch (error) {
    console.error('Error fetching user profits:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
