import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import { loadSignatureStatus } from '@/lib/permit-eligibility'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])
// 低于 1 分的尘埃余额不列（否则会出现一堆显示为 $0.00 的困惑行）
const MIN_FUNDED_USDC = 0.01

type ProfileRow = { id: string; username: string | null; email: string | null; wallet_address: string | null; wallet_bound_at: string | null }

// 催签名名单：钱包有 USDC，但没有匹配当前绑定钱包的有效签名 → 不会拿到空投。
// 判据与 calculate / distribute 共用 lib/permit-eligibility，列表 == 会被空投门挡掉的人。
export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { signedUserIds, mismatchUserIds } = await loadSignatureStatus(supabase)

    // 拉全部有钱包的用户（分页；1000 上限踩过多次）
    const profiles: ProfileRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, wallet_address, wallet_bound_at')
        .not('wallet_address', 'is', null)
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      profiles.push(...(data as ProfileRow[]))
      if (data.length < 1000) break
    }

    // 只看没有效签名的钱包
    const unsigned = profiles.filter(p => p.wallet_address && !signedUserIds.has(p.id))
    if (unsigned.length === 0) {
      return NextResponse.json({ users: [], scanned: 0 })
    }

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    // multicall 批量读余额（100/批，失败回退单读）
    const balByWallet = new Map<string, number>()
    const BATCH = 100
    for (let i = 0; i < unsigned.length; i += BATCH) {
      const batch = unsigned.slice(i, i + BATCH)
      try {
        const results = await publicClient.multicall({
          contracts: batch.map(u => ({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [u.wallet_address as `0x${string}`],
          })),
          allowFailure: true,
        })
        results.forEach((r, j) => {
          if (r.status === 'success') {
            balByWallet.set(batch[j].wallet_address!.toLowerCase(), parseFloat(formatUnits(r.result as bigint, 6)))
          }
        })
      } catch {
        for (const u of batch) {
          try {
            const b = await publicClient.readContract({
              address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [u.wallet_address as `0x${string}`],
            })
            balByWallet.set(u.wallet_address!.toLowerCase(), parseFloat(formatUnits(b, 6)))
          } catch { /* 单钱包失败忽略 */ }
        }
      }
    }

    const users = unsigned
      .map(p => ({
        id: p.id,
        username: p.username,
        email: p.email,
        wallet_address: p.wallet_address,
        wallet_bound_at: p.wallet_bound_at,
        usdc_balance: balByWallet.get(p.wallet_address!.toLowerCase()) ?? 0,
        // 有 pending 签名但钱包不匹配（用旧钱包签、绑了新钱包）→ 与"完全没签过"区分
        reason: mismatchUserIds.has(p.id) ? 'wallet_mismatch' : 'never_signed',
      }))
      .filter(u => u.usdc_balance >= MIN_FUNDED_USDC)
      .sort((a, b) => b.usdc_balance - a.usdc_balance)

    return NextResponse.json({
      users,
      scanned: unsigned.length,
      total_funded_usdc: Number(users.reduce((s, u) => s + u.usdc_balance, 0).toFixed(2)),
    })
  } catch (error) {
    console.error('unsigned-funded error:', error)
    return NextResponse.json({ error: 'Failed to scan' }, { status: 500 })
  }
}
