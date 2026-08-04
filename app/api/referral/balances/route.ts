import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

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

    // 🚀 使用 multicall 批量读取余额（1次RPC代替N次，速度提升 10-50x）
    const withWallet = referrals.filter((r: { wallet_address: string | null }) => r.wallet_address)
    const withoutWallet = referrals.filter((r: { wallet_address: string | null }) => !r.wallet_address)
      .map((r: { id: string; level: number; [key: string]: unknown }) => ({ ...r, usdc_balance: 0 }))

    const walletBalances: { [key: string]: number } = {}
    const BATCH_SIZE = 100

    for (let i = 0; i < withWallet.length; i += BATCH_SIZE) {
      const batch = withWallet.slice(i, i + BATCH_SIZE)
      try {
        const results = await publicClient.multicall({
          contracts: batch.map((r: { wallet_address: string }) => ({
            address: CONFIG.usdcAddress,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [r.wallet_address as `0x${string}`],
          })),
          allowFailure: true,
        })
        
        batch.forEach((r: { wallet_address: string }, idx: number) => {
          const result = results[idx]
          walletBalances[r.wallet_address] = result.status === 'success' 
            ? parseFloat(formatUnits(result.result as bigint, 6)) 
            : 0
        })
      } catch (err) {
        console.error('Multicall batch failed, falling back:', err)
        // Fallback: individual calls
        for (const r of batch) {
          try {
            const balance = await publicClient.readContract({
              address: CONFIG.usdcAddress,
              abi: USDC_ABI,
              functionName: 'balanceOf',
              args: [r.wallet_address as `0x${string}`],
            })
            walletBalances[r.wallet_address] = parseFloat(formatUnits(balance, 6))
          } catch {
            walletBalances[r.wallet_address] = 0
          }
        }
      }
    }

    // Fold AlphaStake staked principal (open positions) into each downline's
    // balance, so the team-volume / commission estimates count staked capital.
    const stakedByWallet: Record<string, number> = {}
    try {
      const alpha = await fetchOnChainAlphaSummary()
      if (alpha.configured) {
        for (const pos of alpha.positions) {
          if (pos.closed) continue
          stakedByWallet[pos.user] = (stakedByWallet[pos.user] || 0) + pos.amountUsdc
        }
      }
    } catch (err) {
      console.error('alpha staked read failed:', err)
    }

    const referralsWithBalance = [
      ...withWallet.map((r: { wallet_address: string; [key: string]: unknown }) => ({
        ...r,
        usdc_balance: (walletBalances[r.wallet_address] || 0) + (stakedByWallet[r.wallet_address.toLowerCase()] || 0),
        staked: stakedByWallet[r.wallet_address.toLowerCase()] || 0,
      })),
      ...withoutWallet.map((r: { [key: string]: unknown }) => ({ ...r, staked: 0 })),
    ]

    // 计算统计数据
    const totalVolume = referralsWithBalance.reduce((sum: number, r: { usdc_balance?: number }) => sum + (r.usdc_balance || 0), 0)
    const level1Volume = referralsWithBalance
      .filter((r: { level?: number }) => r.level === 1)
      .reduce((sum: number, r: { usdc_balance?: number }) => sum + (r.usdc_balance || 0), 0)

    const response = NextResponse.json({
      referrals: referralsWithBalance,
      stats: {
        totalVolume,
        level1Volume,
        totalMembers: referrals.length,
        level1Members: referrals.filter((r: { level: number }) => r.level === 1).length,
      }
    })
    // 🚀 Private cache 30s + stale-while-revalidate
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    return response
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
