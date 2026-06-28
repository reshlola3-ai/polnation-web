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
    // 🚀 并行获取所有独立的数据查询（7个串行 → 1次并行，速度提升 ~5x）
    const [
      configResult,
      tiersResult,
      profitsResult,
      historyResult,
      withdrawalsResult,
      commissionsResult,
      profileResult,
    ] = await Promise.all([
      // 获取配置
      supabaseAdmin.from('airdrop_config').select('*').single(),
      // 获取利润等级
      supabaseAdmin.from('profit_tiers').select('*').eq('is_active', true).order('level'),
      // 获取用户利润
      supabaseAdmin.from('user_profits').select('*').eq('user_id', user.id).single(),
      // 获取利润历史（最近50条）
      supabaseAdmin.from('profit_history').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50),
      // 获取提现记录（最近30条）
      supabaseAdmin.from('withdrawals').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(30),
      // 获取佣金记录（最近50条）
      (async () => {
        try {
          const res = await supabaseAdmin.from('referral_commissions')
            .select(`*, source_user:profiles!referral_commissions_source_user_id_fkey(username, email)`)
            .eq('beneficiary_id', user.id)
            .order('created_at', { ascending: false }).limit(50)
          return res
        } catch {
          return { data: [] }
        }
      })(),
      // 获取用户绑定的钱包地址 + 注册时间
      supabaseAdmin.from('profiles').select('wallet_address, created_at').eq('id', user.id).single(),
    ])

    const config = configResult.data
    const tiers = tiersResult.data
    const profits = profitsResult.data
    const history = historyResult.data
    const withdrawals = withdrawalsResult.data
    const commissions = commissionsResult.data || []
    let profile = profileResult.data
    // 注册时间在 profile 可能被自动绑定逻辑覆盖前先存下来
    const registeredAt = (profileResult.data as { created_at?: string } | null)?.created_at ?? null

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
          profile = { wallet_address: walletAddress, created_at: registeredAt }
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

    // ========== 收入构成 ==========
    // 用户最近一轮空投 = 用户自己最近一条 profit_history
    const lastRow = (history && history[0]) || null
    const lastRoundId = lastRow?.round_id ?? null
    const lastDate = lastRow?.created_at ? String(lastRow.created_at).slice(0, 10) : null

    const lastTotal = Number(lastRow?.profit_earned) || 0
    const lastAlpha = Number(lastRow?.alpha_earned) || 0
    const lastAgentic = Math.max(0, lastTotal - lastAlpha)
    const lastCommission = (commissions || [])
      .filter((c: { round_id?: string }) => c.round_id === lastRoundId)
      .reduce((s: number, c: { commission_amount?: number }) => s + (Number(c.commission_amount) || 0), 0)

    let lastCommunity = 0
    if (lastDate) {
      const { data: cd } = await supabaseAdmin
        .from('community_daily_earnings')
        .select('earning_amount')
        .eq('user_id', user.id)
        .eq('earning_date', lastDate)
      lastCommunity = (cd || []).reduce((s, r) => s + (Number(r.earning_amount) || 0), 0)
    }

    // 累计各项
    const [allPhRes, commStatusRes, lotteryRes] = await Promise.all([
      supabaseAdmin.from('profit_history').select('profit_earned, alpha_earned').eq('user_id', user.id),
      supabaseAdmin.from('user_community_status').select('total_community_earned, team_volume_l123').eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('lottery_records').select('prize_amount').eq('user_id', user.id).like('prize_type', 'usdc_%').eq('reward_credited', true),
    ])

    let lifeTotal = 0
    let lifeAlpha = 0
    for (const r of allPhRes.data || []) {
      lifeTotal += Number(r.profit_earned) || 0
      lifeAlpha += Number(r.alpha_earned) || 0
    }
    const lifeAgentic = Math.max(0, lifeTotal - lifeAlpha)
    const lifeCommunity = Number(commStatusRes.data?.total_community_earned) || 0
    const lifeCommission = Number(profits?.total_commission_earned) || 0
    const lifeLottery = (lotteryRes.data || []).reduce((s, r) => s + (Number(r.prize_amount) || 0), 0)

    const breakdown = {
      last_round: {
        date: lastRow?.created_at ?? null,
        agentic: lastAgentic,
        alpha: lastAlpha,
        commission: lastCommission,
        community: lastCommunity,
        total: lastAgentic + lastAlpha + lastCommission + lastCommunity,
      },
      lifetime: {
        agentic: lifeAgentic,
        alpha: lifeAlpha,
        commission: lifeCommission,
        community: lifeCommunity,
        lottery: lifeLottery,
        total: lifeAgentic + lifeAlpha + lifeCommission + lifeCommunity + lifeLottery,
      },
    }

    const response = NextResponse.json({
      breakdown,
      profits: profits || {
        total_earned_usdc: 0,
        total_commission_earned: 0,
        available_usdc: 0,
        community_locked_usdc: 0,
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
      registered_at: registeredAt,
      team_volume: Number(commStatusRes.data?.team_volume_l123) || 0,
      hasSignature: hasSignature,
    })
    
    // Private cache for 30 seconds (user-specific data)
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=15')
    return response
  } catch (error) {
    console.error('Error fetching user profits:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
