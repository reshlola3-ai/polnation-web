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

// 验证管理员 token
async function verifyAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  return !!token
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
