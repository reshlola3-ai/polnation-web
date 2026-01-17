import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

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

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
}

const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

// 计算 L1+L2+L3 下线总 volume
async function calculateTeamVolumeL123(userId: string, supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  if (!supabase) return 0

  // 获取 L1-L3 下线
  const { data: referrals } = await supabase
    .rpc('get_all_referrals', { user_id: userId })

  if (!referrals || referrals.length === 0) return 0

  // 只取 L1, L2, L3
  const l123Referrals = referrals.filter((r: { level: number }) => r.level <= 3)
  
  // 获取有钱包地址的下线
  const walletsToFetch = l123Referrals.filter((r: { wallet_address: string | null }) => r.wallet_address)
  
  if (walletsToFetch.length === 0) return 0

  // 创建 public client
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(CONFIG.rpcUrl),
  })

  // 获取余额
  let totalVolume = 0
  
  for (const referral of walletsToFetch) {
    try {
      const balance = await publicClient.readContract({
        address: CONFIG.usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [referral.wallet_address as `0x${string}`],
      })
      totalVolume += parseFloat(formatUnits(balance, 6))
    } catch (err) {
      console.error(`Failed to get balance for ${referral.wallet_address}:`, err)
    }
  }

  return totalVolume
}

// 获取用户社群状态
export async function GET(request: NextRequest) {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取等级配置
    const { data: levels } = await supabaseAdmin
      .from('community_levels')
      .select('*')
      .order('level')

    // 获取或创建用户状态
    let { data: status } = await supabaseAdmin
      .from('user_community_status')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!status) {
      // 创建初始状态
      const { data: newStatus } = await supabaseAdmin
        .from('user_community_status')
        .insert({
          user_id: user.id,
          real_level: 0,
          current_level: 0,
        })
        .select()
        .single()
      status = newStatus
    }

    // 计算 L1+L2+L3 团队 volume
    const teamVolume = await calculateTeamVolumeL123(user.id, supabaseAdmin)

    // 获取任务奖励进度
    const { data: taskProgress } = await supabaseAdmin
      .from('user_task_progress')
      .select('total_task_bonus')
      .eq('user_id', user.id)
      .single()
    
    const taskBonus = taskProgress?.total_task_bonus || 0
    
    // 有效解锁进度 = 团队volume + 任务奖励
    const effectiveVolume = teamVolume + taskBonus

    // 更新缓存的 volume
    await supabaseAdmin
      .from('user_community_status')
      .update({
        team_volume_l123: teamVolume,
        team_volume_updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    // 计算真实等级（使用有效解锁进度）
    let realLevel = 0
    for (const level of levels || []) {
      const unlockVolume = status?.is_influencer 
        ? level.unlock_volume_influencer 
        : level.unlock_volume_normal
      
      if (effectiveVolume >= unlockVolume) {
        realLevel = level.level
      } else {
        break
      }
    }

    // 更新真实等级（如果变化）
    if (realLevel !== status?.real_level) {
      await supabaseAdmin
        .from('user_community_status')
        .update({
          real_level: realLevel,
          // 如果不是管理员设置，current_level 跟随 real_level
          ...(status?.is_admin_set ? {} : { current_level: realLevel }),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }

    // 当前生效等级
    const currentLevel = status?.is_admin_set 
      ? (status?.admin_set_level || 0)
      : realLevel

    // 获取当前等级信息
    const currentLevelInfo = levels?.find(l => l.level === currentLevel)
    const nextLevelInfo = levels?.find(l => l.level === currentLevel + 1)

    // 获取已领取的等级
    const { data: claims } = await supabaseAdmin
      .from('community_pool_claims')
      .select('level')
      .eq('user_id', user.id)
      .eq('status', 'completed')

    const claimedLevels = claims?.map(c => c.level) || []

    // 计算可领取的等级（真实升级的，且低于当前等级的，且未领取的）
    // 只有升级到下一等级后才能领取当前等级
    const claimableLevels: number[] = []
    if (!status?.is_admin_set) {
      for (let l = 1; l < realLevel; l++) {
        if (!claimedLevels.includes(l)) {
          claimableLevels.push(l)
        }
      }
    }

    // 获取每日收益历史
    const { data: dailyEarnings } = await supabaseAdmin
      .from('community_daily_earnings')
      .select('*')
      .eq('user_id', user.id)
      .order('earning_date', { ascending: false })
      .limit(30)

    // 计算下一等级解锁条件
    const nextUnlockVolume = nextLevelInfo 
      ? (status?.is_influencer ? nextLevelInfo.unlock_volume_influencer : nextLevelInfo.unlock_volume_normal)
      : 0

    return NextResponse.json({
      status: {
        ...status,
        real_level: realLevel,
        current_level: currentLevel,
        team_volume_l123: teamVolume,
      },
      levels,
      currentLevelInfo,
      nextLevelInfo,
      nextUnlockVolume,
      effectiveVolume,
      taskBonus,
      volumeToNextLevel: Math.max(0, nextUnlockVolume - effectiveVolume),
      claimedLevels,
      claimableLevels,
      dailyEarnings,
      dailyEarningAmount: currentLevelInfo 
        ? currentLevelInfo.reward_pool * currentLevelInfo.daily_rate 
        : 0,
    })
  } catch (error) {
    console.error('Error fetching community status:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
