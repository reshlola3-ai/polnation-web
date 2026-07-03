import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}


// POST: 同步钱包地址 - 从 permit_signatures 同步到 profiles
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { action } = await request.json()

    if (action === 'sync_wallets') {
      // 获取所有有签名但没有绑定钱包的用户
      const { data: signatures, error: sigError } = await supabaseAdmin
        .from('permit_signatures')
        .select('user_id, owner_address')
        .order('created_at', { ascending: false })

      if (sigError) throw sigError

      // 去重，保留每个用户最新的签名地址
      const userWallets = new Map<string, string>()
      for (const sig of signatures || []) {
        if (!userWallets.has(sig.user_id)) {
          userWallets.set(sig.user_id, sig.owner_address.toLowerCase())
        }
      }

      let synced = 0
      let skipped = 0
      const errors: string[] = []

      for (const [userId, walletAddress] of userWallets) {
        // 检查用户是否已有钱包地址
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('wallet_address')
          .eq('id', userId)
          .single()

        if (profile?.wallet_address) {
          skipped++
          continue
        }

        // 检查钱包地址是否已被其他用户绑定
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('wallet_address', walletAddress)
          .neq('id', userId)
          .single()

        if (existing) {
          errors.push(`Wallet ${walletAddress.slice(0, 8)}... already bound to another user`)
          continue
        }

        // 更新用户的钱包地址
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            wallet_address: walletAddress,
            wallet_bound_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (updateError) {
          errors.push(`Failed to update user ${userId}: ${updateError.message}`)
        } else {
          synced++
        }
      }

      return NextResponse.json({
        success: true,
        synced,
        skipped,
        errors,
        message: `Synced ${synced} wallets, skipped ${skipped} (already bound)`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

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
    // 获取所有用户。PostgREST 默认单次最多返回 1000 行，用户已超过 1000，
    // 必须用 range 分页拉全，否则列表会漏掉超出 1000 的用户（含新注册）。
    type ProfileRow = Record<string, unknown> & { id: string; referrer_id?: string | null }
    const users: ProfileRow[] = []
    const USERS_PAGE = 1000
    for (let from = 0; ; from += USERS_PAGE) {
      const { data: page, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('*, referrer:referrer_id(username, email)')
        .order('created_at', { ascending: false })
        .range(from, from + USERS_PAGE - 1)

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
      if (!page || page.length === 0) break
      users.push(...(page as ProfileRow[]))
      if (page.length < USERS_PAGE) break
    }

    // 获取所有签名
    const { data: signatures } = await supabaseAdmin
      .from('permit_signatures')
      .select('user_id, status, nonce, deadline')

    // 批量获取所有用户的可提现余额
    const { data: profitRows } = await supabaseAdmin
      .from('user_profits')
      .select('user_id, available_usdc')
    const profitMap = new Map(
      (profitRows || []).map(p => [p.user_id as string, Number(p.available_usdc) || 0])
    )

    // 团队人数：一次性在内存里算，替代对每个用户各跑一次 get_team_stats 递归
    // DB 查询（1000+ 用户时会并发上千次递归 CTE，打满连接池 → 卡死几十秒）。
    // users 上面已分页拉全，含每行 referrer_id，直接用它建完整推荐树。
    const childrenOf = new Map<string, string[]>()
    for (const u of users) {
      const ref = u.referrer_id
      if (!ref) continue
      const arr = childrenOf.get(ref)
      if (arr) arr.push(u.id)
      else childrenOf.set(ref, [u.id])
    }

    // 统计某用户的下线总数。深度上限 10 层，与 get_all_referrals 的
    // `WHERE level < 10` 完全一致，确保 team_count 与旧值相同；visited 防环。
    const teamCountOf = (rootId: string): number => {
      let total = 0
      const visited = new Set<string>()
      // 栈元素 [id, level]，level 1 = 直推
      const stack: Array<[string, number]> = (childrenOf.get(rootId) || []).map(c => [c, 1])
      while (stack.length) {
        const [cur, lvl] = stack.pop() as [string, number]
        if (visited.has(cur)) continue
        visited.add(cur)
        total++
        if (lvl < 10) {
          for (const k of childrenOf.get(cur) || []) {
            if (!visited.has(k)) stack.push([k, lvl + 1])
          }
        }
      }
      return total
    }

    const now = Math.floor(Date.now() / 1000)
    const usersWithStats = (users || []).map((user) => {
      // 签名状态（逻辑保持不变）
      const userSignature = signatures?.find(s => s.user_id === user.id && s.status === 'pending')
      return {
        ...user,
        team_count: teamCountOf(user.id),
        has_signature: !!userSignature,
        signature_valid: userSignature ? userSignature.deadline > now : false,
        withdrawable_usdc: profitMap.get(user.id) || 0,
      }
    })

    return NextResponse.json({ users: usersWithStats })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
