import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

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
    // 获取所有有钱包地址的用户（分页拉全：默认单次 1000 上限，用户已 >1000 会漏）
    type ProfileRel = { id: string; wallet_address: string | null; referrer_id: string | null }
    const users: ProfileRel[] = []
    for (let pageFrom = 0; ; pageFrom += 1000) {
      const { data: page } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_address, referrer_id')
        .not('wallet_address', 'is', null)
        .range(pageFrom, pageFrom + 999)
      if (!page || page.length === 0) break
      users.push(...(page as ProfileRel[]))
      if (page.length < 1000) break
    }

    if (users.length === 0) {
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

    // 并入 AlphaStake 未平仓质押本金：与团队业绩(team_volume)口径一致 = 钱包USDC + 质押本金。
    // 质押后 USDC 离开钱包锁进合约，只读 balanceOf 会把质押用户显示成 ~$0。
    // staked 单独返回，前端可拆开显示"含质押 $X"。
    const staked: Record<string, string> = {}
    try {
      const alpha = await fetchOnChainAlphaSummary()
      if (alpha.configured) {
        for (const pos of alpha.positions) {
          if (pos.closed) continue
          const w = pos.user.toLowerCase()
          staked[w] = (parseFloat(staked[w] || '0') + pos.amountUsdc).toFixed(6)
          balances[w] = (parseFloat(balances[w] || '0') + pos.amountUsdc).toFixed(6)
        }
      }
    } catch (e) {
      console.error('alpha staked merge failed:', e)
    }

    // 计算团队余额（递归获取所有下线的余额总和；balances 已含质押本金）
    const teamBalances: Record<string, string> = {}
    
    // 获取所有用户的下线关系（分页拉全，同上）
    const allUsers: ProfileRel[] = []
    for (let pageFrom = 0; ; pageFrom += 1000) {
      const { data: page } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_address, referrer_id')
        .range(pageFrom, pageFrom + 999)
      if (!page || page.length === 0) break
      allUsers.push(...(page as ProfileRel[]))
      if (page.length < 1000) break
    }

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

    return NextResponse.json({ balances, teamBalances, staked })
  } catch (error) {
    console.error('Error fetching balances:', error)
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 })
  }
}
