import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// 获取当前用户的利润信息
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取用户利润账户
    const { data: profits } = await supabase
      .from('user_profits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 获取最近的利润历史
    const { data: history } = await supabase
      .from('profit_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // 获取提现记录
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      profits: profits || {
        total_earned_usdc: 0,
        available_usdc: 0,
        available_matic: 0,
        withdrawn_usdc: 0,
        withdrawn_matic: 0,
        current_tier: 0,
      },
      history: history || [],
      withdrawals: withdrawals || [],
    })

  } catch (error) {
    console.error('Error fetching profits:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
