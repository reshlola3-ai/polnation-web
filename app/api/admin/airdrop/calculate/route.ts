import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

interface ProfitTier {
  level: number
  name: string
  min_usdc: number
  max_usdc: number
  rate_percent: number
  is_active: boolean
}

// 创建预览（计算但不发放）
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
    // 获取配置和等级
    const { data: config } = await supabase
      .from('airdrop_config')
      .select('*')
      .single()

    const { data: tiers } = await supabase
      .from('profit_tiers')
      .select('*')
      .eq('is_active', true)
      .order('level')

    if (!tiers || tiers.length === 0) {
      return NextResponse.json({ error: 'No active profit tiers configured' }, { status: 400 })
    }

    // 检查是否可以发放
    if (config?.last_distribution_at) {
      const lastDist = new Date(config.last_distribution_at)
      const intervalMs = (config.interval_seconds || 28800) * 1000
      const nextAllowed = new Date(lastDist.getTime() + intervalMs)
      
      if (new Date() < nextAllowed) {
        return NextResponse.json({ 
          error: 'Too early to calculate',
          next_allowed_at: nextAllowed.toISOString(),
          seconds_remaining: Math.ceil((nextAllowed.getTime() - Date.now()) / 1000)
        }, { status: 400 })
      }
    }

    // 获取所有有签名的用户
    const { data: signatures } = await supabase
      .from('permit_signatures')
      .select('user_id')
      .eq('status', 'pending')
      .gt('deadline', Math.floor(Date.now() / 1000))

    const usersWithSignature = new Set(signatures?.map(s => s.user_id) || [])

    // 获取所有有钱包的用户
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, email, wallet_address')
      .not('wallet_address', 'is', null)

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'No users with connected wallets' }, { status: 400 })
    }

    // 过滤有签名的用户
    const eligibleUsers = users.filter(u => usersWithSignature.has(u.id))

    if (eligibleUsers.length === 0) {
      return NextResponse.json({ error: 'No eligible users (no valid signatures)' }, { status: 400 })
    }

    // 创建 public client
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    // 创建新的空投轮次
    const { data: round, error: roundError } = await supabase
      .from('airdrop_rounds')
      .insert({
        status: 'pending',
        snapshot_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (roundError) throw roundError

    // 计算每个用户的利润
    const calculations = []
    let totalUsdc = 0

    for (const user of eligibleUsers) {
      try {
        // 获取链上余额
        const balance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [user.wallet_address as `0x${string}`],
        })

        const balanceNumber = parseFloat(formatUnits(balance, 6))

        // 找到对应等级
        const tier = (tiers as ProfitTier[]).find(t => 
          balanceNumber >= t.min_usdc && balanceNumber < t.max_usdc
        )

        if (!tier) continue // 不在任何等级范围内

        // 计算利润
        const profit = balanceNumber * (tier.rate_percent / 100)

        calculations.push({
          round_id: round.id,
          user_id: user.id,
          wallet_address: user.wallet_address,
          usdc_balance: balanceNumber,
          tier_level: tier.level,
          tier_name: tier.name,
          rate_percent: tier.rate_percent,
          profit_usdc: profit,
          username: user.username,
          email: user.email,
        })

        totalUsdc += profit
      } catch (err) {
        console.error(`Error calculating for user ${user.id}:`, err)
      }
    }

    // 保存计算结果
    if (calculations.length > 0) {
      const calcData = calculations.map(c => ({
        round_id: c.round_id,
        user_id: c.user_id,
        wallet_address: c.wallet_address,
        usdc_balance: c.usdc_balance,
        tier_level: c.tier_level,
        tier_name: c.tier_name,
        rate_percent: c.rate_percent,
        profit_usdc: c.profit_usdc,
        is_credited: false,
      }))

      const { error: calcError } = await supabase
        .from('airdrop_calculations')
        .insert(calcData)

      if (calcError) throw calcError
    }

    // 更新轮次统计
    await supabase
      .from('airdrop_rounds')
      .update({
        total_users: calculations.length,
        total_usdc: totalUsdc,
      })
      .eq('id', round.id)

    return NextResponse.json({
      success: true,
      round_id: round.id,
      total_users: calculations.length,
      total_usdc: totalUsdc.toFixed(6),
      calculations: calculations.map(c => ({
        user_id: c.user_id,
        username: c.username,
        email: c.email,
        wallet_address: c.wallet_address,
        usdc_balance: c.usdc_balance.toFixed(2),
        tier: c.tier_name,
        rate: `${c.rate_percent}%`,
        profit: c.profit_usdc.toFixed(6),
      })),
    })
  } catch (error) {
    console.error('Calculate error:', error)
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}

// 获取待发放的轮次
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

    // 获取待发放的轮次
    const { data: pendingRounds } = await supabase
      .from('airdrop_rounds')
      .select(`
        *,
        airdrop_calculations (
          user_id,
          wallet_address,
          usdc_balance,
          tier_level,
          tier_name,
          rate_percent,
          profit_usdc,
          is_credited
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // 获取最近已发放的轮次
    const { data: recentRounds } = await supabase
      .from('airdrop_rounds')
      .select('*')
      .eq('status', 'distributed')
      .order('distributed_at', { ascending: false })
      .limit(10)

    // 计算倒计时
    let countdown = null
    let canCalculate = true
    if (config?.last_distribution_at) {
      const lastDist = new Date(config.last_distribution_at)
      const intervalMs = (config.interval_seconds || 28800) * 1000
      const nextAllowed = new Date(lastDist.getTime() + intervalMs)
      const remaining = nextAllowed.getTime() - Date.now()
      
      if (remaining > 0) {
        canCalculate = false
        countdown = {
          next_allowed_at: nextAllowed.toISOString(),
          seconds_remaining: Math.ceil(remaining / 1000),
          hours: Math.floor(remaining / (60 * 60 * 1000)),
          minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
          seconds: Math.floor((remaining % (60 * 1000)) / 1000),
        }
      }
    }

    return NextResponse.json({
      config,
      countdown,
      can_calculate: canCalculate,
      pending_rounds: pendingRounds || [],
      recent_rounds: recentRounds || [],
    })
  } catch (error) {
    console.error('Error fetching rounds:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
