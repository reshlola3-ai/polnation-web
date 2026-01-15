import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tokenType, amount } = await request.json()

    if (!tokenType || !amount) {
      return NextResponse.json({ error: 'Token type and amount required' }, { status: 400 })
    }

    if (tokenType !== 'USDC' && tokenType !== 'MATIC') {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 400 })
    }

    const withdrawAmount = parseFloat(amount)
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // 获取用户利润账户
    const { data: profits } = await supabase
      .from('user_profits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profits) {
      return NextResponse.json({ error: 'No profit account found' }, { status: 400 })
    }

    // 检查余额
    const availableField = tokenType === 'USDC' ? 'available_usdc' : 'available_matic'
    const available = parseFloat(profits[availableField] || '0')

    if (withdrawAmount > available) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // 获取用户钱包地址
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: 'No wallet connected' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    // 创建提现记录
    const { data: withdrawal, error: insertError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        user_id: user.id,
        token_type: tokenType,
        amount: withdrawAmount,
        wallet_address: profile.wallet_address,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating withdrawal:', insertError)
      return NextResponse.json({ error: 'Failed to create withdrawal' }, { status: 500 })
    }

    // 扣除可用余额
    const updateData: Record<string, number> = {}
    updateData[availableField] = available - withdrawAmount

    await supabaseAdmin
      .from('user_profits')
      .update(updateData)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      withdrawal,
      message: 'Withdrawal request submitted',
    })

  } catch (error) {
    console.error('Withdrawal error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
