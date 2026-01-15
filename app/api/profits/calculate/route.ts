import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

// 这个 API 需要定时调用（每8小时一次）
// 可以使用 Vercel Cron Jobs 或外部 cron 服务

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  cronSecret: process.env.CRON_SECRET,
}

const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

// 利润等级配置
const PROFIT_TIERS = [
  { level: 1, name: 'Bronze', min: 10, max: 20, rate: 0.0025 },
  { level: 2, name: 'Silver', min: 20, max: 100, rate: 0.003 },
  { level: 3, name: 'Gold', min: 100, max: 500, rate: 0.0035 },
  { level: 4, name: 'Platinum', min: 500, max: 2000, rate: 0.004 },
  { level: 5, name: 'Diamond', min: 2000, max: 10000, rate: 0.005 },
  { level: 6, name: 'Elite', min: 10000, max: 50000, rate: 0.006 },
]

function getTier(balance: number) {
  return PROFIT_TIERS.find(t => balance >= t.min && balance < t.max) || null
}

export async function POST(request: NextRequest) {
  // 验证 cron secret（安全）
  const authHeader = request.headers.get('authorization')
  if (CONFIG.cronSecret && authHeader !== `Bearer ${CONFIG.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const now = new Date()
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000)

    // 获取所有有有效签名的用户
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, wallet_address')
      .not('wallet_address', 'is', null)

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users to process', processed: 0 })
    }

    // 获取有效签名的用户
    const { data: validSignatures } = await supabaseAdmin
      .from('permit_signatures')
      .select('user_id')
      .eq('status', 'pending')
      .gt('deadline', Math.floor(Date.now() / 1000))

    const usersWithSignature = new Set(validSignatures?.map(s => s.user_id) || [])

    // 创建 public client
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    let processed = 0
    let totalProfit = 0

    for (const user of users) {
      // 只处理有有效签名的用户
      if (!usersWithSignature.has(user.id)) {
        continue
      }

      try {
        // 获取用户当前 USDC 余额
        const balance = await publicClient.readContract({
          address: CONFIG.usdcAddress,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [user.wallet_address as `0x${string}`],
        })

        const balanceNumber = parseFloat(formatUnits(balance, 6))
        
        // 获取等级
        const tier = getTier(balanceNumber)
        if (!tier) {
          continue // 余额不在任何等级范围内
        }

        // 计算利润
        const profit = balanceNumber * tier.rate

        // 获取或创建用户利润记录
        const { data: existingProfit } = await supabaseAdmin
          .from('user_profits')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (existingProfit) {
          // 检查是否已经在8小时内计算过
          const lastCalc = new Date(existingProfit.last_calculated_at)
          if (lastCalc > eightHoursAgo) {
            continue // 跳过，还没到8小时
          }

          // 更新利润
          await supabaseAdmin
            .from('user_profits')
            .update({
              total_earned_usdc: existingProfit.total_earned_usdc + profit,
              available_usdc: existingProfit.available_usdc + profit,
              current_tier: tier.level,
              last_calculated_at: now.toISOString(),
            })
            .eq('user_id', user.id)
        } else {
          // 创建新记录
          await supabaseAdmin
            .from('user_profits')
            .insert({
              user_id: user.id,
              total_earned_usdc: profit,
              available_usdc: profit,
              current_tier: tier.level,
              last_calculated_at: now.toISOString(),
            })
        }

        // 记录历史
        await supabaseAdmin
          .from('profit_history')
          .insert({
            user_id: user.id,
            usdc_balance: balanceNumber,
            tier_level: tier.level,
            rate_applied: tier.rate,
            profit_earned: profit,
            period_start: eightHoursAgo.toISOString(),
            period_end: now.toISOString(),
          })

        processed++
        totalProfit += profit

      } catch (err) {
        console.error(`Error processing user ${user.id}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      totalProfit: totalProfit.toFixed(6),
      timestamp: now.toISOString(),
    })

  } catch (error) {
    console.error('Profit calculation error:', error)
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}

// 允许手动触发（管理员）
export async function GET(request: NextRequest) {
  // 重定向到 POST
  return POST(request)
}
