import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

async function verifyAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  return !!token
}

export async function GET(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取提现请求
    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false })

    // 获取统计
    const { data: profits } = await supabaseAdmin
      .from('user_profits')
      .select('total_earned_usdc, withdrawn_usdc, withdrawn_matic')

    const totalEarned = profits?.reduce((sum, p) => sum + parseFloat(String(p.total_earned_usdc || 0)), 0) || 0
    const totalWithdrawn = profits?.reduce((sum, p) => 
      sum + parseFloat(String(p.withdrawn_usdc || 0)) + parseFloat(String(p.withdrawn_matic || 0)), 0) || 0
    const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending').length || 0

    return NextResponse.json({
      withdrawals,
      stats: {
        totalEarned,
        totalWithdrawn,
        pendingWithdrawals,
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
