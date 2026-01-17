import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

// 验证管理员 session
async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  return !!session
}

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
}

const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

export async function GET(request: NextRequest) {
  // 验证管理员
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取所有有钱包地址的用户
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, wallet_address, referrer_id')
      .not('wallet_address', 'is', null)

    if (!users || users.length === 0) {
      return NextResponse.json({ balances: {}, teamBalances: {} })
    }

    // 创建 public client
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    // 批量获取余额
    const balances: Record<string, string> = {}
    const walletToUserId: Record<string, string> = {}
    
    // 创建地址到用户ID的映射
    for (const user of users) {
      if (user.wallet_address) {
        walletToUserId[user.wallet_address.toLowerCase()] = user.id
      }
    }

    // 并行获取所有余额
    const balancePromises = users
      .filter(u => u.wallet_address)
      .map(async (user) => {
        try {
          const balance = await publicClient.readContract({
            address: CONFIG.usdcAddress,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [user.wallet_address as `0x${string}`],
          })
          return {
            address: user.wallet_address!.toLowerCase(),
            balance: formatUnits(balance, 6),
            userId: user.id,
          }
        } catch {
          return {
            address: user.wallet_address!.toLowerCase(),
            balance: '0',
            userId: user.id,
          }
        }
      })

    const results = await Promise.all(balancePromises)
    
    for (const result of results) {
      balances[result.address] = result.balance
    }

    // 计算团队余额（递归获取所有下线的余额总和）
    const teamBalances: Record<string, string> = {}
    
    // 获取所有用户的下线关系
    const { data: allUsers } = await supabaseAdmin
      .from('profiles')
      .select('id, wallet_address, referrer_id')

    // 构建下线映射
    const referralMap: Record<string, string[]> = {}
    for (const user of allUsers || []) {
      if (user.referrer_id) {
        if (!referralMap[user.referrer_id]) {
          referralMap[user.referrer_id] = []
        }
        referralMap[user.referrer_id].push(user.id)
      }
    }

    // 递归计算团队余额
    function getTeamBalance(userId: string, visited: Set<string> = new Set()): number {
      if (visited.has(userId)) return 0
      visited.add(userId)

      let total = 0
      const directReferrals = referralMap[userId] || []
      
      for (const referralId of directReferrals) {
        const referral = allUsers?.find(u => u.id === referralId)
        if (referral?.wallet_address) {
          total += parseFloat(balances[referral.wallet_address.toLowerCase()] || '0')
        }
        // 递归获取下线的团队余额
        total += getTeamBalance(referralId, visited)
      }
      
      return total
    }

    // 计算每个用户的团队余额
    for (const user of allUsers || []) {
      teamBalances[user.id] = getTeamBalance(user.id).toFixed(2)
    }

    return NextResponse.json({ balances, teamBalances })
  } catch (error) {
    console.error('Error fetching balances:', error)
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 })
  }
}
