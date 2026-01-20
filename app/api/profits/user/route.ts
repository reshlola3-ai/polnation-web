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

    // 获取利润历史（最近50条）
    const { data: history } = await supabaseAdmin
      .from('profit_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    // 获取提现记录（最近30条）
    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    // 获取佣金记录（最近50条）
    let commissions = null
    try {
      const { data } = await supabaseAdmin
        .from('referral_commissions')
        .select(`
          *,
          source_user:profiles!referral_commissions_source_user_id_fkey(username, email)
        `)
        .eq('beneficiary_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      commissions = data
    } catch {
      // 表可能不存在
      commissions = []
    }

    // 获取用户绑定的钱包地址
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    // 如果用户没有绑定钱包，检查是否有签名记录，自动绑定
    if (!profile?.wallet_address) {
      const { data: signature } = await supabaseAdmin
        .from('permit_signatures')
        .select('owner_address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (signature?.owner_address) {
        const walletAddress = signature.owner_address.toLowerCase()
        
        // 检查钱包是否已被其他用户绑定
        const { data: existingBinding } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('wallet_address', walletAddress)
          .neq('id', user.id)
          .single()

        if (!existingBinding) {
          // 自动绑定钱包
          await supabaseAdmin
            .from('profiles')
            .update({
              wallet_address: walletAddress,
              wallet_bound_at: new Date().toISOString(),
            })
            .eq('id', user.id)

          // 更新 profile 变量
          profile = { wallet_address: walletAddress }
          console.log(`Auto-bound wallet ${walletAddress} to user ${user.id}`)
        }
      }
    }

    // 检查用户是否有有效的签名记录
    let hasSignature = false
    if (profile?.wallet_address) {
      const { data: signature } = await supabaseAdmin
        .from('permit_signatures')
        .select('id, status, deadline')
        .eq('owner_address', profile.wallet_address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (signature) {
        const now = Math.floor(Date.now() / 1000)
        // 签名有效：状态为 pending 或 used，且未过期
        if ((signature.status === 'pending' || signature.status === 'used') && 
            Number(signature.deadline) > now) {
          hasSignature = true
        }
      }
    }

    // 计算下次发放时间
    let nextDistribution = null
    if (config?.last_distribution_at) {
      const lastDist = new Date(config.last_distribution_at)
      const intervalMs = (config.interval_seconds || 86400) * 1000
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
        interval_seconds: config?.interval_seconds || 86400,
        min_withdrawal_usdc: config?.min_withdrawal_usdc || 0.1,
        min_withdrawal_matic: config?.min_withdrawal_matic || 0.1,
        last_distribution_at: config?.last_distribution_at,
      },
      next_distribution: nextDistribution,
      wallet_address: profile?.wallet_address || null,
      hasSignature: hasSignature,
    })
  } catch (error) {
    console.error('Error fetching user profits:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
