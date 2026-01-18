import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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
    // 获取所有用户
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*, referrer:referrer_id(username, email)')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 获取所有签名
    const { data: signatures } = await supabaseAdmin
      .from('permit_signatures')
      .select('user_id, status, nonce, deadline')

    // 获取团队统计
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        // 获取团队数量
        const { data: teamStats } = await supabaseAdmin
          .rpc('get_team_stats', { user_id: user.id })
        
        const stats = teamStats?.[0] || { total_team_members: 0, level1_members: 0 }
        
        // 检查签名状态
        const userSignature = signatures?.find(s => s.user_id === user.id && s.status === 'pending')
        const now = Math.floor(Date.now() / 1000)
        
        return {
          ...user,
          team_count: stats.total_team_members,
          has_signature: !!userSignature,
          signature_valid: userSignature ? userSignature.deadline > now : false,
        }
      })
    )

    return NextResponse.json({ users: usersWithStats })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
