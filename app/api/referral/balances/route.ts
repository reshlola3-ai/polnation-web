import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
}

const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

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

export async function GET(request: NextRequest) {
  const { supabase, user } = await getSupabaseUser()
  
  if (!user || !supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 获取所有下线
    const { data: referrals, error } = await supabase
      .rpc('get_all_referrals', { user_id: user.id })

    if (error) {
      console.error('Error fetching referrals:', error)
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
    }

    if (!referrals || referrals.length === 0) {
      return NextResponse.json({ referrals: [], stats: { totalVolume: 0, level1Volume: 0 } })
    }

    // 创建 public client
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    // 获取所有有钱包地址的下线的余额
    const referralsWithBalance = await Promise.all(
      referrals.map(async (r: { id: string; wallet_address: string | null; level: number; [key: string]: unknown }) => {
        if (!r.wallet_address) {
          return { ...r, usdc_balance: 0 }
        }

        try {
          const balance = await publicClient.readContract({
            address: CONFIG.usdcAddress,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [r.wallet_address as `0x${string}`],
          })
          
          return {
            ...r,
            usdc_balance: parseFloat(formatUnits(balance, 6)),
          }
        } catch (err) {
          console.error(`Failed to get balance for ${r.wallet_address}:`, err)
          return { ...r, usdc_balance: 0 }
        }
      })
    )

    // 计算统计数据
    const totalVolume = referralsWithBalance.reduce((sum, r) => sum + (r.usdc_balance || 0), 0)
    const level1Volume = referralsWithBalance
      .filter(r => r.level === 1)
      .reduce((sum, r) => sum + (r.usdc_balance || 0), 0)

    return NextResponse.json({
      referrals: referralsWithBalance,
      stats: {
        totalVolume,
        level1Volume,
        totalMembers: referrals.length,
        level1Members: referrals.filter((r: { level: number }) => r.level === 1).length,
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
