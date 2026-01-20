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
    // 检查用户邮箱是否是钱包占位符（未绑定邮箱）
    const userEmail = user.email || ''
    const isWalletOnlyUser = userEmail.endsWith('@wallet.polnation.com')

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
      // 创建初始状态 - 已绑定邮箱的用户默认 Level 1
      const defaultLevel = isWalletOnlyUser ? 0 : 1
      const { data: newStatus } = await supabaseAdmin
        .from('user_community_status')
        .insert({
          user_id: user.id,
          real_level: defaultLevel,
          current_level: defaultLevel,
        })
        .select()
        .single()
      status = newStatus
    }

    // 如果是钱包用户且未绑定邮箱，返回锁定状态
    if (isWalletOnlyUser) {
      return NextResponse.json({
        isLocked: true,
        lockReason: 'email_required',
        status: {
          real_level: 0,
          current_level: 0,
          is_admin_set: false,
          is_influencer: false,
          team_volume_l123: 0,
          total_community_earned: 0,
        },
        levels,
        currentLevelInfo: null,
        nextLevelInfo: null,
        nextUnlockVolume: 0,
        effectiveVolume: 0,
        taskBonus: 0,
        volumeToNextLevel: 0,
        claimedLevels: [],
        claimableLevels: [],
        dailyEarnings: [],
        dailyEarningAmount: 0,
      })
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

    // 获取已领取的等级
    const { data: claims } = await supabaseAdmin
      .from('community_pool_claims')
      .select('level')
      .eq('user_id', user.id)
      .eq('status', 'completed')

    const claimedLevels = claims?.map(c => c.level) || []

    // 新逻辑：用户默认 Level 1，领取奖池后升级
    // current_level 表示用户当前所在的等级（已领取该等级的奖池则升级）
    // 如果是管理员设置的等级，使用管理员设置的值
    let currentLevel = status?.is_admin_set 
      ? (status?.admin_set_level || 1)
      : Math.max(1, status?.current_level || 1) // 最低为 Level 1

    // 获取当前等级信息
    const currentLevelInfo = levels?.find(l => l.level === currentLevel)
    
    // 计算当前等级的解锁门槛（用于判断是否可以领取奖池）
    const currentUnlockVolume = currentLevelInfo 
      ? (status?.is_influencer ? currentLevelInfo.unlock_volume_influencer : currentLevelInfo.unlock_volume_normal)
      : 0

    // 判断是否达到当前等级的解锁门槛
    const hasReachedCurrentThreshold = effectiveVolume >= currentUnlockVolume

    // 可领取的等级：当前等级且未领取且达到门槛
    const claimableLevels: number[] = []
    if (!status?.is_admin_set && hasReachedCurrentThreshold && !claimedLevels.includes(currentLevel)) {
      claimableLevels.push(currentLevel)
    }

    // 下一等级（领取当前等级奖池后会升级到的等级）
    const nextLevelInfo = levels?.find(l => l.level === currentLevel + 1)

    // 获取每日收益历史
    const { data: dailyEarnings } = await supabaseAdmin
      .from('community_daily_earnings')
      .select('*')
      .eq('user_id', user.id)
      .order('earning_date', { ascending: false })
      .limit(30)

    // 计算进度条：显示到达当前等级解锁门槛的进度
    const progressTarget = currentUnlockVolume
    const volumeToUnlock = Math.max(0, progressTarget - effectiveVolume)

    return NextResponse.json({
      isLocked: false,
      status: {
        ...status,
        current_level: currentLevel,
        team_volume_l123: teamVolume,
      },
      levels,
      currentLevelInfo,
      nextLevelInfo,
      // 进度条显示当前等级的解锁门槛
      nextUnlockVolume: progressTarget,
      effectiveVolume,
      taskBonus,
      volumeToNextLevel: volumeToUnlock,
      claimedLevels,
      claimableLevels,
      dailyEarnings,
      dailyEarningAmount: currentLevelInfo 
        ? currentLevelInfo.reward_pool * currentLevelInfo.daily_rate 
        : 0,
      // 是否达到当前等级解锁门槛
      hasReachedThreshold: hasReachedCurrentThreshold,
    })
  } catch (error) {
    console.error('Error fetching community status:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
