import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// 获取配置
export async function GET() {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取配置
    const { data: config } = await supabase
      .from('airdrop_config')
      .select('*')
      .single()

    // 获取利润等级
    const { data: tiers } = await supabase
      .from('profit_tiers')
      .select('*')
      .order('level')

    return NextResponse.json({ config, tiers })
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

// 更新配置
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'update_config') {
      const { interval_seconds, min_withdrawal_usdc, min_withdrawal_matic, distributor_contract } = body

      const { error } = await supabase
        .from('airdrop_config')
        .update({
          interval_seconds,
          min_withdrawal_usdc,
          min_withdrawal_matic,
          distributor_contract,
          updated_at: new Date().toISOString(),
        })
        .not('id', 'is', null) // 更新所有记录（实际只有一条）

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'update_tier') {
      const { level, name, min_usdc, max_usdc, rate_percent, is_active } = body

      const { error } = await supabase
        .from('profit_tiers')
        .update({
          name,
          min_usdc,
          max_usdc,
          rate_percent,
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('level', level)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'add_tier') {
      const { level, name, min_usdc, max_usdc, rate_percent } = body

      const { error } = await supabase
        .from('profit_tiers')
        .insert({
          level,
          name,
          min_usdc,
          max_usdc,
          rate_percent,
          is_active: true,
        })

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'delete_tier') {
      const { level } = body

      const { error } = await supabase
        .from('profit_tiers')
        .delete()
        .eq('level', level)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
