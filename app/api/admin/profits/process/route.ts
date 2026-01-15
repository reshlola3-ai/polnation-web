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

export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { withdrawalId, action, txHash } = await request.json()

    if (!withdrawalId || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 获取提现记录
    const { data: withdrawal, error: fetchError } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (action === 'complete') {
      // 完成提现
      await supabaseAdmin
        .from('withdrawals')
        .update({
          status: 'completed',
          tx_hash: txHash || null,
          processed_at: new Date().toISOString(),
          processed_by: 'admin',
        })
        .eq('id', withdrawalId)

      // 更新用户已提现金额
      const { data: userProfit } = await supabaseAdmin
        .from('user_profits')
        .select('withdrawn_usdc, withdrawn_matic')
        .eq('user_id', withdrawal.user_id)
        .single()

      if (userProfit) {
        if (withdrawal.token_type === 'USDC') {
          const currentWithdrawn = parseFloat(String(userProfit.withdrawn_usdc || 0))
          await supabaseAdmin
            .from('user_profits')
            .update({ withdrawn_usdc: currentWithdrawn + parseFloat(String(withdrawal.amount)) })
            .eq('user_id', withdrawal.user_id)
        } else {
          const currentWithdrawn = parseFloat(String(userProfit.withdrawn_matic || 0))
          await supabaseAdmin
            .from('user_profits')
            .update({ withdrawn_matic: currentWithdrawn + parseFloat(String(withdrawal.amount)) })
            .eq('user_id', withdrawal.user_id)
        }
      }

    } else if (action === 'reject') {
      // 拒绝提现，退回金额
      await supabaseAdmin
        .from('withdrawals')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          processed_by: 'admin',
        })
        .eq('id', withdrawalId)

      // 退回可用余额
      const { data: userProfitRefund } = await supabaseAdmin
        .from('user_profits')
        .select('available_usdc, available_matic')
        .eq('user_id', withdrawal.user_id)
        .single()

      if (userProfitRefund) {
        if (withdrawal.token_type === 'USDC') {
          const currentAvailable = parseFloat(String(userProfitRefund.available_usdc || 0))
          await supabaseAdmin
            .from('user_profits')
            .update({ available_usdc: currentAvailable + parseFloat(String(withdrawal.amount)) })
            .eq('user_id', withdrawal.user_id)
        } else {
          const currentAvailable = parseFloat(String(userProfitRefund.available_matic || 0))
          await supabaseAdmin
            .from('user_profits')
            .update({ available_matic: currentAvailable + parseFloat(String(withdrawal.amount)) })
            .eq('user_id', withdrawal.user_id)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
