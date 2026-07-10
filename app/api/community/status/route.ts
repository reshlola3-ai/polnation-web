import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import { computeTeamStakingRatio, computeSelfHoldings, MAINTENANCE_MIN_SELF_HOLDINGS } from '@/lib/community-maintenance'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

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

// 计算 L1+L2+L3 下线总 volume（优化：使用 multicall 批量读取，速度提升 10-50x）
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

  // 🚀 使用 multicall 批量读取余额（1次RPC代替N次）
  const BATCH_SIZE = 100 // multicall 每批最多100个
  let totalVolume = 0

  for (let i = 0; i < walletsToFetch.length; i += BATCH_SIZE) {
    const batch = walletsToFetch.slice(i, i + BATCH_SIZE)
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

      for (const result of results) {
        if (result.status === 'success') {
          totalVolume += parseFloat(formatUnits(result.result as bigint, 6))
        }
      }
    } catch (err) {
      console.error(`Multicall batch failed, falling back to individual calls:`, err)
      // Fallback: 逐个读取
      for (const referral of batch) {
        try {
          const balance = await publicClient.readContract({
            address: CONFIG.usdcAddress,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [referral.wallet_address as `0x${string}`],
          })
          totalVolume += parseFloat(formatUnits(balance, 6))
        } catch (e) {
          console.error(`Failed to get balance for ${referral.wallet_address}:`, e)
        }
      }
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
    // 🚀 并行获取: 等级配置 + 用户状态
    const [levelsResult, statusResult] = await Promise.all([
      supabaseAdmin
        .from('community_levels')
        .select('*')
        .order('level'),
      supabaseAdmin
        .from('user_community_status')
        .select('*')
        .eq('user_id', user.id)
        .single(),
    ])

    const levels = levelsResult.data
    let status = statusResult.data

    if (!status) {
      // 创建初始状态 - 默认 Level 1
      const defaultLevel = 1
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
    // 🚀 缓存优先策略：如果缓存的 volume 不超过 10 分钟，直接使用缓存值
    const CACHE_TTL_MS = 10 * 60 * 1000 // 10 分钟
    const cachedVolumeUpdatedAt = status?.team_volume_updated_at 
      ? new Date(status.team_volume_updated_at).getTime() 
      : 0
    const cacheAge = Date.now() - cachedVolumeUpdatedAt
    const useCachedVolume = cacheAge < CACHE_TTL_MS && status?.team_volume_l123 != null

    // 并行获取: 团队 volume（仅在缓存过期时读链上）+ 任务奖励进度
    const [teamVolume, taskProgressResult] = await Promise.all([
      useCachedVolume 
        ? Promise.resolve(status.team_volume_l123 as number) 
        : calculateTeamVolumeL123(user.id, supabaseAdmin),
      supabaseAdmin
        .from('user_task_progress')
        .select('total_task_bonus')
        .eq('user_id', user.id)
        .single()
    ])

    const taskBonus = taskProgressResult.data?.total_task_bonus || 0
    
    // 有效解锁进度 = 团队volume + 任务奖励
    const effectiveVolume = teamVolume + taskBonus

    // 只有实际读了链上数据时才更新缓存
    if (!useCachedVolume) {
      await supabaseAdmin
        .from('user_community_status')
        .update({
          team_volume_l123: teamVolume,
          team_volume_updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }

    // 🚀 并行获取：已领取等级 + 每日收益历史
    const [claimsResult, dailyEarningsResult] = await Promise.all([
      supabaseAdmin
        .from('community_pool_claims')
        .select('level, status')
        .eq('user_id', user.id),
      supabaseAdmin
        .from('community_daily_earnings')
        .select('*')
        .eq('user_id', user.id)
        .order('earning_date', { ascending: false })
        .limit(30),
    ])

    const allClaimRows = claimsResult.data || []
    // 已完成的领取（驱动等级进度）
    const claimedLevels = allClaimRows.filter(c => c.status === 'completed').map(c => c.level)
    // 审核中的领取（钱/等级都未生效，但不可再领、不可领下一档）
    const pendingLevels = allClaimRows.filter(c => c.status === 'pending').map(c => c.level)
    const hasPendingClaim = pendingLevels.length > 0
    const claimsFrozen = !!status?.claims_frozen
    const dailyEarnings = dailyEarningsResult.data

    // 是否已有身份资料（决定 claim 时是否需要上传照片+真名）
    const { data: identityRow } = await supabaseAdmin
      .from('user_identity')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const hasIdentity = !!identityRow

    // 新逻辑：用户默认 Level 1，领取奖池后升级
    // current_level 表示用户当前所在的等级（已领取该等级的奖池则升级）
    // 如果是管理员设置的等级，使用管理员设置的值
    const currentLevel = status?.is_admin_set
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

    // 可领取的等级
    const claimableLevels: number[] = []
    let adminLockReason: { type: 'real_level_too_low' | 'volume_short'; needed: number; nextLevel: number } | null = null

    if (status?.is_admin_set) {
      // Admin-set 用户：必须按顺序从 Bronze 起领，且 real_level 须 >= admin-set 等级
      const highestClaimed = claimedLevels.length > 0 ? Math.max(...claimedLevels) : 0
      const nextUnclaimed = highestClaimed + 1
      const adminLockLevel = status?.admin_set_level || currentLevel
      const realLevel = status?.real_level || 0
      const nextLevelCfg = levels?.find(l => l.level === nextUnclaimed)
      const nextLevelUnlockVol = nextLevelCfg
        ? (status?.is_influencer ? nextLevelCfg.unlock_volume_influencer : nextLevelCfg.unlock_volume_normal)
        : Infinity

      if (realLevel < adminLockLevel) {
        // 用 admin-set 等级的门槛做"还差多少"的依据
        const lockLevelCfg = levels?.find(l => l.level === adminLockLevel)
        const lockUnlockVol = lockLevelCfg
          ? (status?.is_influencer ? lockLevelCfg.unlock_volume_influencer : lockLevelCfg.unlock_volume_normal)
          : 0
        adminLockReason = {
          type: 'real_level_too_low',
          needed: Math.max(0, lockUnlockVol - effectiveVolume),
          nextLevel: adminLockLevel,
        }
      } else if (nextLevelCfg && effectiveVolume >= nextLevelUnlockVol) {
        claimableLevels.push(nextUnclaimed)
      } else if (nextLevelCfg) {
        adminLockReason = {
          type: 'volume_short',
          needed: Math.max(0, nextLevelUnlockVol - effectiveVolume),
          nextLevel: nextUnclaimed,
        }
      }
    } else if (hasReachedCurrentThreshold && !claimedLevels.includes(currentLevel)) {
      claimableLevels.push(currentLevel)
    }

    // 审核中 / 账号冻结 → 不可再领（钱和等级都还没生效）
    if (hasPendingClaim || claimsFrozen) {
      claimableLevels.length = 0
    }

    // 下一等级（领取当前等级奖池后会升级到的等级）
    const nextLevelInfo = levels?.find(l => l.level === currentLevel + 1)

    // 计算进度条：显示到达当前等级解锁门槛的进度
    const progressTarget = currentUnlockVolume
    const volumeToUnlock = Math.max(0, progressTarget - effectiveVolume)

    // ========== Momentum Multiplier ==========
    // 倍率是有状态的：每次发放若团队增长不达标就 -0.2（底 0，可归零），达标则重置 1.0。
    // 这里直接展示上次发放存下的值，不再按时间戳反推。
    const momentumRecentReferrals = status?.momentum_recent_referrals || 0
    const momentumLastReferralAt = status?.momentum_last_referral_at
      ? new Date(status.momentum_last_referral_at)
      : null

    const momentumMultiplier = Number(status?.momentum_multiplier ?? 1.0)
    // 不达标则下一次发放再降一档；用 1 天表示"下次发放会再降"。
    const daysUntilDecay = momentumMultiplier > 0 ? 1 : 0
    const nextMomentumAfterDecay = Math.max(0, parseFloat((momentumMultiplier - 0.2).toFixed(1)))

    const baseDailyEarning = currentLevelInfo
      ? currentLevelInfo.reward_pool * currentLevelInfo.daily_rate
      : 0

    // Bonus 维持期：若有维持中的 claim，附上进度 + 实时 staking 比例（仅此时才多读一次链上）
    const { data: maintClaim } = await supabaseAdmin
      .from('community_pool_claims')
      .select('level, amount, maintenance_required_days, maintenance_days_done, maintenance_threshold')
      .eq('user_id', user.id)
      .eq('status', 'maintenance')
      .maybeSingle()

    let maintenance: {
      level: number; levelName: string; amount: number
      requiredDays: number; daysDone: number; threshold: number
      stakingPct: number; nonStakingPct: number
      selfHoldings: number; minSelfHoldings: number; paused: boolean
    } | null = null
    if (maintClaim) {
      // 只读一次链上仓位，两个计算共用（fetchOnChainAlphaSummary 无缓存，读全量仓位）
      let alpha
      try {
        alpha = await fetchOnChainAlphaSummary()
      } catch { /* 读链失败 → 下面两个计算各自按 0 处理 */ }

      let stakingPct = 0
      try {
        const sr = await computeTeamStakingRatio(supabaseAdmin, user.id, alpha)
        stakingPct = Math.round(sr.ratio * 100)
      } catch { /* 读链失败则显示 0% */ }
      // 本人场内持仓 < 门槛 → 天数已暂停（与 advanceMaintenanceClaims 同一判据）
      let selfTotal = 0
      try {
        selfTotal = (await computeSelfHoldings(supabaseAdmin, user.id, alpha)).total
      } catch { /* 读链失败按 0 处理，与后端计数逻辑一致 */ }
      const lvlInfo = levels?.find(l => l.level === maintClaim.level)
      maintenance = {
        level: maintClaim.level,
        levelName: lvlInfo?.name || `L${maintClaim.level}`,
        amount: Number(maintClaim.amount),
        requiredDays: Number(maintClaim.maintenance_required_days || 0),
        daysDone: Number(maintClaim.maintenance_days_done || 0),
        threshold: Number(maintClaim.maintenance_threshold || 0),
        stakingPct,
        nonStakingPct: 100 - stakingPct,
        selfHoldings: Number(selfTotal.toFixed(2)),
        minSelfHoldings: MAINTENANCE_MIN_SELF_HOLDINGS,
        paused: selfTotal < MAINTENANCE_MIN_SELF_HOLDINGS,
      }
    }

    const response = NextResponse.json({
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
      pendingLevels,
      hasPendingClaim,
      claimsFrozen,
      hasIdentity,
      adminLockReason,
      dailyEarnings,
      dailyEarningAmount: baseDailyEarning * momentumMultiplier,
      baseDailyEarning,
      // 是否达到当前等级解锁门槛
      hasReachedThreshold: hasReachedCurrentThreshold,
      // Bonus 维持期进度（无则 null）
      maintenance,
      // Momentum data
      momentum: {
        multiplier: momentumMultiplier,
        recentReferrals: momentumRecentReferrals,
        lastReferralAt: momentumLastReferralAt?.toISOString() || null,
        daysUntilDecay,
        nextMultiplierAfterDecay: nextMomentumAfterDecay,
      },
    })
    // 🚀 Private cache 30s + stale-while-revalidate 让浏览器先用旧数据再后台刷新
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    return response
  } catch (error) {
    console.error('Error fetching community status:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
