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

    // 检查用户邮箱是否绑定
    const userEmail = user.email || ''
    if (userEmail.endsWith('@wallet.polnation.com')) {
      return NextResponse.json({ 
        error: 'Please bind your email first to claim rewards' 
      }, { status: 400 })
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

    // 查询已领过的 levels（用于 admin-set 的顺序判定，以及通用的已领检查）
    const { data: priorClaims } = await supabaseAdmin
      .from('community_pool_claims')
      .select('level')
      .eq('user_id', user.id)

    const claimedLevels = (priorClaims || []).map(c => c.level as number)
    const highestClaimed = claimedLevels.length > 0 ? Math.max(...claimedLevels) : 0
    const nextUnclaimed = highestClaimed + 1

    if (claimedLevels.includes(level)) {
      return NextResponse.json({
        error: 'This level reward pool has already been claimed'
      }, { status: 400 })
    }

    if (status.is_admin_set) {
      // Admin-set 用户：必须按顺序领，且 real_level 必须追上 admin-set 等级
      if (level !== nextUnclaimed) {
        return NextResponse.json({
          error: `Must claim Level ${nextUnclaimed} next`
        }, { status: 400 })
      }

      const adminLockLevel = status.current_level || 0
      const realLevel = status.real_level || 0
      if (realLevel < adminLockLevel) {
        return NextResponse.json({
          error: `Locked: real level must reach Level ${adminLockLevel} to unlock claims`
        }, { status: 400 })
      }
    } else {
      // 自然用户：每次只能领当前等级
      const currentLevel = Math.max(1, status.current_level || 1)
      if (level !== currentLevel) {
        return NextResponse.json({
          error: 'Can only claim current level reward pool'
        }, { status: 400 })
      }
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

    // 计算有效解锁进度
    const teamVolume = status.team_volume_l123 || 0
    
    // 获取任务奖励进度
    const { data: taskProgress } = await supabaseAdmin
      .from('user_task_progress')
      .select('total_task_bonus')
      .eq('user_id', user.id)
      .single()
    
    const taskBonus = taskProgress?.total_task_bonus || 0
    const effectiveVolume = teamVolume + taskBonus

    // 获取当前等级的解锁门槛
    const unlockVolume = status.is_influencer 
      ? levelInfo.unlock_volume_influencer 
      : levelInfo.unlock_volume_normal

    // 检查是否达到解锁门槛
    if (effectiveVolume < unlockVolume) {
      return NextResponse.json({ 
        error: `Need $${unlockVolume - effectiveVolume} more progress to claim this reward` 
      }, { status: 400 })
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

    const nextLevel = level + 1

    // 自然用户：领取后升级到下一等级；admin-set 用户：current_level / real_level 不动
    const statusUpdate: Record<string, unknown> = {
      total_community_earned: (status.total_community_earned || 0) + claimAmount,
      updated_at: new Date().toISOString(),
    }
    if (!status.is_admin_set) {
      statusUpdate.current_level = nextLevel
      statusUpdate.real_level = nextLevel
    }

    await supabaseAdmin
      .from('user_community_status')
      .update(statusUpdate)
      .eq('user_id', user.id)

    // 获取下一等级信息（用于返回消息）
    const { data: nextLevelInfo } = await supabaseAdmin
      .from('community_levels')
      .select('name')
      .eq('level', nextLevel)
      .single()

    const message = status.is_admin_set
      ? `🎉 Claimed $${claimAmount} from ${levelInfo.name}!`
      : `🎉 Claimed $${claimAmount} from ${levelInfo.name}! Upgraded to ${nextLevelInfo?.name || `Level ${nextLevel}`}!`

    return NextResponse.json({
      success: true,
      claimed_level: level,
      claimed_amount: claimAmount,
      new_level: status.is_admin_set ? status.current_level : nextLevel,
      new_level_name: nextLevelInfo?.name || `Level ${nextLevel}`,
      message,
    })
  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
