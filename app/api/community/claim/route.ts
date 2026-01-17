import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

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

// Claim 奖励池
export async function POST(request: NextRequest) {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { level } = await request.json()

    if (!level || level < 1) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }

    // 获取用户状态
    const { data: status } = await supabaseAdmin
      .from('user_community_status')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!status) {
      return NextResponse.json({ error: 'User status not found' }, { status: 404 })
    }

    // 检查是否是管理员设置的等级（不能 claim）
    if (status.is_admin_set) {
      return NextResponse.json({ 
        error: '管理员设置的等级无法领取奖励池' 
      }, { status: 400 })
    }

    // 检查是否已升级到下一等级（只有升级后才能领取前一等级）
    if (level >= status.real_level) {
      return NextResponse.json({ 
        error: '需要升级到下一等级后才能领取此奖励池' 
      }, { status: 400 })
    }

    // 检查是否已领取
    const { data: existingClaim } = await supabaseAdmin
      .from('community_pool_claims')
      .select('*')
      .eq('user_id', user.id)
      .eq('level', level)
      .single()

    if (existingClaim) {
      return NextResponse.json({ 
        error: '此等级奖励池已领取' 
      }, { status: 400 })
    }

    // 获取等级信息
    const { data: levelInfo } = await supabaseAdmin
      .from('community_levels')
      .select('*')
      .eq('level', level)
      .single()

    if (!levelInfo) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 })
    }

    const claimAmount = levelInfo.reward_pool

    // 创建领取记录
    await supabaseAdmin
      .from('community_pool_claims')
      .insert({
        user_id: user.id,
        level,
        amount: claimAmount,
        claim_type: 'natural',
        status: 'completed',
        credited_at: new Date().toISOString(),
      })

    // 更新用户利润账户
    const { data: profits } = await supabaseAdmin
      .from('user_profits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profits) {
      await supabaseAdmin
        .from('user_profits')
        .update({
          available_usdc: profits.available_usdc + claimAmount,
          total_earned_usdc: profits.total_earned_usdc + claimAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    } else {
      await supabaseAdmin
        .from('user_profits')
        .insert({
          user_id: user.id,
          available_usdc: claimAmount,
          total_earned_usdc: claimAmount,
          available_matic: 0,
          withdrawn_usdc: 0,
          withdrawn_matic: 0,
        })
    }

    // 更新社群账户累计收益
    await supabaseAdmin
      .from('user_community_status')
      .update({
        total_community_earned: (status.total_community_earned || 0) + claimAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      claimed_level: level,
      claimed_amount: claimAmount,
      message: `成功领取 Level ${level} 奖励池 $${claimAmount}`,
    })
  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
