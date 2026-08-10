import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'
import { verifyAdmin } from '@/lib/admin-auth'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'
import { ALPHA_TIERS } from '@/lib/alphastake'
import { loadSignatureStatus } from '@/lib/permit-eligibility'
import { loadWehappyDownlineIds, resolveAgenticRatePercent } from '@/lib/agentic-rate'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])

interface ProfitTier {
  level: number
  name: string
  min_usdc: number
  max_usdc: number
  rate_percent: number
  is_active: boolean
}

// 创建预览（计算但不发放）
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const force = body?.force === true
    // 只读预览：不建轮次、不落库、不受发放间隔限制，随时可看
    const previewOnly = body?.preview_only === true

    // 获取配置和等级
    const { data: config } = await supabase
      .from('airdrop_config')
      .select('*')
      .single()

    const { data: tiers } = await supabase
      .from('profit_tiers')
      .select('*')
      .eq('is_active', true)
      .order('level')

    if (!tiers || tiers.length === 0) {
      return NextResponse.json({ error: 'No active profit tiers configured' }, { status: 400 })
    }

    // 检查是否可以发放（force=true / 只读预览时跳过间隔检查）
    if (!force && !previewOnly && config?.last_distribution_at) {
      const lastDist = new Date(config.last_distribution_at)
      const intervalMs = (config.interval_seconds || 86400) * 1000
      const nextAllowed = new Date(lastDist.getTime() + intervalMs)

      if (new Date() < nextAllowed) {
        return NextResponse.json({
          error: 'Too early to calculate',
          next_allowed_at: nextAllowed.toISOString(),
          seconds_remaining: Math.ceil((nextAllowed.getTime() - Date.now()) / 1000)
        }, { status: 400 })
      }
    }

    // agentic 严格签名门：只认 nonce 有效的签名，不含质押豁免（exemptStakers:false）。
    // 质押者若签名失效 → 不在 signedUserIds 里 → agentic 清零，但下方仍按其质押仓位发质押利润。
    const { signedUserIds } = await loadSignatureStatus(supabase, { exemptStakers: false })

    // 获取所有有钱包的用户
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, email, wallet_address, country_code')
      .not('wallet_address', 'is', null)

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'No users with connected wallets' }, { status: 400 })
    }

    // WEHAPPY 整棵下线树：余额 ≥ $500 时 Agentic 利率强制 1.2%
    const wehappyDownlineIds = await loadWehappyDownlineIds(supabase)

    // AlphaStake 每日利润：活跃仓位本金 × 档位日利率，按钱包聚合。
    // 质押利润与 agentic 利润一起入账，统一从提现页提取。
    const alphaProfitByWallet = new Map<string, number>()
    try {
      const alpha = await fetchOnChainAlphaSummary()
      if (alpha.configured) {
        for (const pos of alpha.positions) {
          if (pos.status !== 'active') continue
          const alphaTier = ALPHA_TIERS[pos.tierId]
          if (!alphaTier) continue
          const dailyProfit = pos.amountUsdc * (alphaTier.dailyRateBps / 10000)
          alphaProfitByWallet.set(
            pos.user,
            (alphaProfitByWallet.get(pos.user) || 0) + dailyProfit,
          )
        }
      }
    } catch (err) {
      // AlphaStake 读取失败不阻塞 agentic 发放，但要在日志里留痕
      console.error('AlphaStake profit snapshot failed:', err)
    }

    // 资格：有有效签名 → 可得 agentic + 质押利润；仅有活跃质押(签名失效) → 只得质押利润；
    // 两者皆无 → 不生成计算行。质押者由 alphaProfitByWallet 标记（其钱包有活跃仓位利润）。
    const eligibleUsers = users.filter(u =>
      signedUserIds.has(u.id) || alphaProfitByWallet.has((u.wallet_address || '').toLowerCase())
    )

    if (eligibleUsers.length === 0) {
      return NextResponse.json({ error: 'No eligible users (no valid signatures or stakes)' }, { status: 400 })
    }

    // 创建 public client
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    // 创建新的空投轮次（只读预览不建轮次）
    let round: { id: string } | null = null
    if (!previewOnly) {
      const { data: newRound, error: roundError } = await supabase
        .from('airdrop_rounds')
        .insert({
          status: 'pending',
          snapshot_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (roundError) throw roundError
      round = newRound
    }

    // 计算每个用户的利润
    const calculations = []
    let totalUsdc = 0

    for (const user of eligibleUsers) {
      try {
        // 获取链上余额
        const balance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [user.wallet_address as `0x${string}`],
        })

        const balanceNumber = parseFloat(formatUnits(balance, 6))
        const alphaProfit = alphaProfitByWallet.get(user.wallet_address.toLowerCase()) || 0

        // agentic（钱包×档位）仅对「有有效签名」者计入；质押者签名失效时 agentic 清零，
        // 但质押利润照发（其行会显示为 AlphaStake Only）。
        const agenticEligible = signedUserIds.has(user.id)
        const tier = agenticEligible
          ? (tiers as ProfitTier[]).find(t => balanceNumber >= t.min_usdc && balanceNumber < t.max_usdc)
          : undefined

        // Locked Agentic rate (MY ≥$500, or anyone under WEHAPPY ≥$500):
        // admin tier edits cannot override these 1.2% policies.
        const effectiveRatePercent = tier
          ? resolveAgenticRatePercent(user.country_code, balanceNumber, tier.rate_percent, {
              underWehappy: wehappyDownlineIds.has(user.id),
            })
          : 0
        const baseProfit = tier ? balanceNumber * (effectiveRatePercent / 100) : 0
        // AlphaStake（仓位本金 × 日利率）
        const profit = baseProfit + alphaProfit

        // 既无 agentic 也无质押利润 → 跳过
        if (profit <= 0) continue

        calculations.push({
          round_id: round?.id ?? null,
          user_id: user.id,
          wallet_address: user.wallet_address,
          usdc_balance: balanceNumber,
          tier_level: tier?.level ?? 0,
          tier_name: tier?.name ?? 'AlphaStake Only',
          rate_percent: effectiveRatePercent,
          profit_usdc: profit,
          alpha_profit_usdc: alphaProfit,
          username: user.username,
          email: user.email,
        })

        totalUsdc += profit
      } catch (err) {
        console.error(`Error calculating for user ${user.id}:`, err)
      }
    }

    // 保存计算结果（只读预览不落库）
    if (!previewOnly && calculations.length > 0) {
      const calcData = calculations.map(c => ({
        round_id: c.round_id,
        user_id: c.user_id,
        wallet_address: c.wallet_address,
        usdc_balance: c.usdc_balance,
        tier_level: c.tier_level,
        tier_name: c.tier_name,
        rate_percent: c.rate_percent,
        profit_usdc: c.profit_usdc,
        alpha_profit_usdc: c.alpha_profit_usdc,
        is_credited: false,
      }))

      const { error: calcError } = await supabase
        .from('airdrop_calculations')
        .insert(calcData)

      if (calcError) throw calcError
    }

    // 更新轮次统计
    if (round) {
      await supabase
        .from('airdrop_rounds')
        .update({
          total_users: calculations.length,
          total_usdc: totalUsdc,
        })
        .eq('id', round.id)
    }

    // 计算预计佣金
    const { data: commissionRates } = await supabase
      .from('referral_commission_rates')
      .select('*')
      .eq('is_active', true)
      .order('level')

    let estimatedCommissions = 0
    const commissionDetails: Array<{
      beneficiary_username: string
      source_username: string
      level: number
      amount: number
    }> = []

    // 佣金发放比例（与 distribute 一致的打折系数）：默认 100（全额）
    const { data: payoutCfg } = await supabase.from('airdrop_config').select('*').limit(1).maybeSingle()
    const commissionMultiplier = Math.max(0, Math.min(1, Number(payoutCfg?.commission_payout_pct ?? 100) / 100))

    if (commissionRates && commissionRates.length > 0) {
      const ratesMap = new Map<number, number>()
      commissionRates.forEach((r: { level: number; rate_percent: number }) => {
        ratesMap.set(r.level, r.rate_percent)
      })

      for (const calc of calculations) {
        // 获取用户的上线链
        const { data: uplineChain } = await supabase
          .rpc('get_upline_chain', { 
            user_id: calc.user_id,
            max_levels: 6
          })

        if (uplineChain && uplineChain.length > 0) {
          for (const upline of uplineChain as { upline_id: string; level: number }[]) {
            const rate = ratesMap.get(upline.level)
            if (!rate) continue

            const commissionAmount = calc.profit_usdc * (rate / 100) * commissionMultiplier
            if (commissionAmount <= 0) continue

            estimatedCommissions += commissionAmount

            // 获取上线用户名
            const { data: uplineProfile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', upline.upline_id)
              .single()

            commissionDetails.push({
              beneficiary_username: uplineProfile?.username || 'Unknown',
              source_username: calc.username || calc.email,
              level: upline.level,
              amount: commissionAmount,
            })
          }
        }
      }
    }

    // ========== 计算社群每日收益预览 ==========
    const today = new Date().toISOString().split('T')[0]
    
    // 获取所有有等级的用户
    const { data: communityStatuses } = await supabase
      .from('user_community_status')
      .select(`
        *,
        profiles:user_id (username, email)
      `)
      .gt('current_level', 0)

    // 获取等级配置
    const { data: communityLevels } = await supabase
      .from('community_levels')
      .select('*')
      .order('level')

    const communityLevelMap = new Map(communityLevels?.map(l => [l.level, l]) || [])

    // 与实际发放(distribute)口径一致：套用 momentum 衰减 + 锁定门槛。
    // 阈值 0 = 任何正的日薪都锁定、都要审核(含 Silver 及以下)。
    const MOMENTUM_MIN_GROWTH_RATE = 0.03
    const MOMENTUM_MIN_GROWTH_USD = 10
    const DAILY_LOCK_THRESHOLD = 0

    let communityEarningsTotal = 0
    let communityEarningsUsers = 0
    let communityLockedTotal = 0
    let communityLockedUsers = 0
    const communityEarningsDetails: Array<{
      username: string
      level: number
      level_name: string
      reward_pool: number
      daily_rate: number
      earning_amount: number
      momentum_multiplier: number
      locked: boolean
    }> = []

    if (communityStatuses && communityStatuses.length > 0) {
      for (const status of communityStatuses) {
        const levelInfo = communityLevelMap.get(status.current_level)
        if (!levelInfo || levelInfo.daily_rate <= 0) continue

        // 只读预览是"一轮日收益会发多少"的投影，展示全部符合条件用户；
        // 正常流程仍跳过今日已发放的用户，避免与实际发放口径不一致。
        if (!previewOnly) {
          const { data: existingEarning } = await supabase
            .from('community_daily_earnings')
            .select('id')
            .eq('user_id', status.user_id)
            .eq('earning_date', today)
            .single()

          if (existingEarning) continue
        }

        // Momentum 衰减（与 distribute 一致）：基准为历史最高业绩(峰值)高水位线。
        const todayVol = Number(status.team_volume_l123) || 0
        const peakVol = Number(status.peak_volume_l123 ?? 0)
        const momentumQualifies = todayVol > peakVol * (1 + MOMENTUM_MIN_GROWTH_RATE) && (todayVol - peakVol) >= MOMENTUM_MIN_GROWTH_USD
        const prevMomentum = Number(status.momentum_multiplier ?? 1.0)
        const momentum = momentumQualifies ? 1.0 : Math.max(0, parseFloat((prevMomentum - 0.2).toFixed(1)))

        const earningAmount = levelInfo.reward_pool * levelInfo.daily_rate * momentum
        // 日薪 > $0 → 一律锁定（需申请解锁 + 审批）。所有等级一致。
        const locked = earningAmount > DAILY_LOCK_THRESHOLD

        communityEarningsTotal += earningAmount
        communityEarningsUsers++
        if (locked) { communityLockedTotal += earningAmount; communityLockedUsers++ }

        communityEarningsDetails.push({
          username: status.profiles?.username || status.profiles?.email || 'Unknown',
          level: status.current_level,
          level_name: levelInfo.name,
          reward_pool: levelInfo.reward_pool,
          daily_rate: levelInfo.daily_rate,
          earning_amount: earningAmount,
          momentum_multiplier: momentum,
          locked,
        })
      }
    }

    const totalAlphaUsdc = calculations.reduce((sum, c) => sum + c.alpha_profit_usdc, 0)

    return NextResponse.json({
      success: true,
      preview_only: previewOnly,
      round_id: round?.id ?? null,
      total_users: calculations.length,
      total_usdc: totalUsdc.toFixed(6),
      total_alpha_usdc: totalAlphaUsdc.toFixed(6),
      estimated_commissions: estimatedCommissions.toFixed(6),
      commission_details: commissionDetails.map(c => ({
        beneficiary: c.beneficiary_username,
        source: c.source_username,
        level: `L${c.level}`,
        amount: c.amount.toFixed(6),
      })),
      calculations: calculations.map(c => ({
        user_id: c.user_id,
        username: c.username,
        email: c.email,
        wallet_address: c.wallet_address,
        usdc_balance: c.usdc_balance.toFixed(2),
        tier: c.tier_name,
        rate: `${c.rate_percent}%`,
        profit: c.profit_usdc.toFixed(6),
        alpha_profit: c.alpha_profit_usdc.toFixed(6),
      })),
      // 社群收益数据
      community_earnings: {
        total_amount: communityEarningsTotal.toFixed(6),
        users_count: communityEarningsUsers,
        locked_amount: communityLockedTotal.toFixed(6),
        locked_count: communityLockedUsers,
        details: communityEarningsDetails.map(d => ({
          username: d.username,
          level: d.level,
          level_name: d.level_name,
          reward_pool: d.reward_pool,
          daily_rate: d.daily_rate,
          earning_amount: d.earning_amount.toFixed(6),
          momentum_multiplier: d.momentum_multiplier,
          locked: d.locked,
        })),
      },
    })
  } catch (error) {
    console.error('Calculate error:', error)
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}

// 获取待发放的轮次
export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取配置
    const { data: config } = await supabase
      .from('airdrop_config')
      .select('*')
      .single()

    // 获取待发放的轮次
    const { data: pendingRounds } = await supabase
      .from('airdrop_rounds')
      .select(`
        *,
        airdrop_calculations (
          user_id,
          wallet_address,
          usdc_balance,
          tier_level,
          tier_name,
          rate_percent,
          profit_usdc,
          is_credited
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // 获取最近已发放的轮次
    const { data: recentRounds } = await supabase
      .from('airdrop_rounds')
      .select('*')
      .eq('status', 'distributed')
      .order('distributed_at', { ascending: false })
      .limit(10)

    // 计算倒计时
    let countdown = null
    let canCalculate = true
    if (config?.last_distribution_at) {
      const lastDist = new Date(config.last_distribution_at)
      const intervalMs = (config.interval_seconds || 86400) * 1000
      const nextAllowed = new Date(lastDist.getTime() + intervalMs)
      const remaining = nextAllowed.getTime() - Date.now()
      
      if (remaining > 0) {
        canCalculate = false
        countdown = {
          next_allowed_at: nextAllowed.toISOString(),
          seconds_remaining: Math.ceil(remaining / 1000),
          hours: Math.floor(remaining / (60 * 60 * 1000)),
          minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
          seconds: Math.floor((remaining % (60 * 1000)) / 1000),
        }
      }
    }

    return NextResponse.json({
      config,
      countdown,
      can_calculate: canCalculate,
      pending_rounds: pendingRounds || [],
      recent_rounds: recentRounds || [],
    })
  } catch (error) {
    console.error('Error fetching rounds:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
