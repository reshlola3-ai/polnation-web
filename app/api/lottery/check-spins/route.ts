import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { createPublicClient, http, parseAbi } from 'viem'
import { polygon } from 'viem/chains'

const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
const USDC_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)'])
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'

// 统计被邀请人里"钱包有 USDC 余额(>0)"的人数；达到 cap 即提前停止。
async function countFundedInvitees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  cap: number,
): Promise<number> {
  const { data: invRows } = await admin
    .from('profiles')
    .select('wallet_address')
    .eq('referrer_id', userId)
    .not('wallet_address', 'is', null)
    .limit(100)

  const wallets: string[] = (invRows || []).map((r: { wallet_address: string }) => r.wallet_address)
  if (wallets.length === 0) return 0

  const client = createPublicClient({ chain: polygon, transport: http(RPC_URL) })
  const zero = BigInt(0)
  let funded = 0
  const BATCH = 25
  for (let i = 0; i < wallets.length; i += BATCH) {
    const batch = wallets.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map((w) =>
        client.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [w as `0x${string}`],
        }),
      ),
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && (r.value as bigint) > zero) {
        funded++
        if (funded >= cap) return funded
      }
    }
  }
  return funded
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST: 检查并发放抽奖次数（用户主动调用 或 空投发放后调用）
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  let newSpinsGranted = 0

  // ========== 1. 检查 influencer 状态 ==========
  const { data: communityStatus } = await admin
    .from('user_community_status')
    .select('is_influencer')
    .eq('user_id', user.id)
    .single()

  const isInfluencer = communityStatus?.is_influencer || false

  // 确保用户有 user_lottery_spins 记录
  let { data: spinData } = await admin
    .from('user_lottery_spins')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!spinData) {
    const { data: newData } = await admin
      .from('user_lottery_spins')
      .insert({
        user_id: user.id,
        total_spins: 0,
        used_spins: 0,
        is_influencer: isInfluencer,
      })
      .select()
      .single()
    spinData = newData
  } else if (spinData.is_influencer !== isInfluencer) {
    // 同步 influencer 状态
    await admin
      .from('user_lottery_spins')
      .update({ is_influencer: isInfluencer, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
  }

  // ========== 2. 检查自己的空投领取次数（每达到7的倍数 +1 次抽奖）==========
  const { data: selfAirdrops, error: selfErr } = await admin
    .from('airdrop_calculations')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_credited', true)

  if (!selfErr && selfAirdrops) {
    const selfClaimCount = selfAirdrops.length
    // 每7次获得1次抽奖：7→1, 14→2, 21→3...
    const selfMilestonesEarned = Math.floor(selfClaimCount / 7)

    // 检查已发放了多少个 self_airdrop_7x 里程碑
    const { data: existingSelfGrants } = await admin
      .from('lottery_spin_grants')
      .select('milestone_count')
      .eq('user_id', user.id)
      .eq('grant_reason', 'self_airdrop_7x')
      .order('milestone_count', { ascending: false })
      .limit(1)

    const lastSelfMilestone = existingSelfGrants?.[0]?.milestone_count || 0
    const lastSelfGrantIndex = lastSelfMilestone / 7 // e.g. milestone_count=7 → index=1

    if (selfMilestonesEarned > lastSelfGrantIndex) {
      // 有新的里程碑，发放差额次数
      for (let i = lastSelfGrantIndex + 1; i <= selfMilestonesEarned; i++) {
        const milestoneValue = i * 7
        // 防重复：检查该 milestone 是否已存在
        // limit(1) → array (never errors on duplicates the way .single() does);
        // increment only if the insert actually created the row (unique index
        // makes a re-grant fail with 23505 → treated as "already granted").
        const { data: exists } = await admin
          .from('lottery_spin_grants')
          .select('id')
          .eq('user_id', user.id)
          .eq('grant_reason', 'self_airdrop_7x')
          .eq('milestone_count', milestoneValue)
          .limit(1)

        if (!exists?.length) {
          const { error: gErr } = await admin
            .from('lottery_spin_grants')
            .insert({
              user_id: user.id,
              grant_reason: 'self_airdrop_7x',
              milestone_count: milestoneValue,
              spins_granted: 1,
            })
          if (!gErr) newSpinsGranted += 1
          else if (gErr.code !== '23505') console.error('self_airdrop grant insert failed:', gErr)
        }
      }
    }
  }

  // ========== 3. 直推下线认证（TG 或 Twitter 任一即可）→ 推荐人 +1 ==========
  // OR 逻辑：每个 referral 只发一次 spin，无论后续是否再补另一项认证。
  // 去重时同时检查老的两个 reason（referral_twitter_verified /
  // referral_telegram_joined），避免已经发过 spin 的老下线再补发。
  const { data: verifiedReferrals } = await admin
    .from('profiles')
    .select('id, twitter_verified, telegram_chat_id')
    .eq('referrer_id', user.id)

  const eligibleReferrals = (verifiedReferrals || []).filter(
    r => r.twitter_verified === true || r.telegram_chat_id != null
  )

  if (eligibleReferrals.length > 0) {
    for (const referral of eligibleReferrals) {
      const { data: existingGrant } = await admin
        .from('lottery_spin_grants')
        .select('id')
        .eq('user_id', user.id)
        .eq('referral_id', referral.id)
        .in('grant_reason', [
          'referral_verified',
          'referral_twitter_verified',
          'referral_telegram_joined',
        ])
        .limit(1)

      if (!existingGrant?.length) {
        const { error: gErr } = await admin
          .from('lottery_spin_grants')
          .insert({
            user_id: user.id,
            grant_reason: 'referral_verified',
            referral_id: referral.id,
            milestone_count: 1,
            spins_granted: 1,
          })
        if (!gErr) newSpinsGranted += 1
        else if (gErr.code !== '23505') console.error('referral grant insert failed:', gErr)
      }
    }
  }

  // ========== 5. Welcome bonus: 加入 TG 群组 → +1 spin（一次性） ==========
  // 与第 4 条不同：第 4 条是"我邀请的人加群" → 推荐人 +1
  // 第 5 条是"我自己加群" → 自己 +1（首次永久解锁，离开再加入不重复）
  const requiredChatId = process.env.TELEGRAM_REQUIRED_CHAT_ID
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (requiredChatId && botToken) {
    const { data: existingWelcome } = await admin
      .from('lottery_spin_grants')
      .select('id')
      .eq('user_id', user.id)
      .eq('grant_reason', 'welcome_join_telegram')
      .limit(1)

    if (!existingWelcome?.length) {
      const { data: profile } = await admin
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', user.id)
        .single()

      if (profile?.telegram_chat_id) {
        try {
          const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(requiredChatId)}&user_id=${profile.telegram_chat_id}`
          const res = await fetch(url, { cache: 'no-store' })
          const data = await res.json()
          const status = data.ok ? data.result?.status : null
          const isMember = status === 'creator' || status === 'administrator' || status === 'member' || status === 'restricted'

          if (isMember) {
            const { error: gErr } = await admin
              .from('lottery_spin_grants')
              .insert({
                user_id: user.id,
                grant_reason: 'welcome_join_telegram',
                milestone_count: 1,
                spins_granted: 1,
              })
            if (!gErr) newSpinsGranted += 1
            else if (gErr.code !== '23505') console.error('welcome grant insert failed:', gErr)
          }
        } catch (err) {
          console.error('welcome bonus group check failed:', err)
          // silent — user retries on next page load
        }
      }
    }
  }

  // ========== 5b. 邀请里程碑：3人→$1，10人→$5+5次抽奖（各一次性） ==========
  // 只计算"钱包有 USDC 余额"的被邀请人（防纯空号刷里程碑）；cap=10 提前停止。
  const fundedInvites = await countFundedInvitees(admin, user.id, 10)

  const MILESTONES = [
    { reason: 'invite_milestone_3', threshold: 3, usdc: 1, spins: 0 },
    { reason: 'invite_milestone_10', threshold: 10, usdc: 5, spins: 5 },
  ]

  for (const m of MILESTONES) {
    if (fundedInvites < m.threshold) continue

    const { data: existing } = await admin
      .from('lottery_spin_grants')
      .select('id')
      .eq('user_id', user.id)
      .eq('grant_reason', m.reason)
      .limit(1)
    if (existing?.length) continue

    const { error: gErr } = await admin
      .from('lottery_spin_grants')
      .insert({
        user_id: user.id,
        grant_reason: m.reason,
        milestone_count: m.threshold,
        spins_granted: m.spins,
      })
    if (gErr) {
      if (gErr.code !== '23505') console.error('milestone grant insert failed:', gErr)
      continue
    }

    // 发放 USDC（进入可提现余额）
    if (m.usdc > 0) {
      const { data: profits } = await admin
        .from('user_profits')
        .select('available_usdc, total_earned_usdc')
        .eq('user_id', user.id)
        .single()
      if (profits) {
        await admin
          .from('user_profits')
          .update({
            available_usdc: (Number(profits.available_usdc) || 0) + m.usdc,
            total_earned_usdc: (Number(profits.total_earned_usdc) || 0) + m.usdc,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await admin
          .from('user_profits')
          .insert({
            user_id: user.id,
            available_usdc: m.usdc,
            total_earned_usdc: m.usdc,
            available_matic: 0,
            withdrawn_usdc: 0,
            withdrawn_matic: 0,
          })
      }
    }

    newSpinsGranted += m.spins
  }

  // ========== 6. 更新 total_spins ==========
  if (newSpinsGranted > 0) {
    await admin
      .from('user_lottery_spins')
      .update({
        total_spins: (spinData?.total_spins || 0) + newSpinsGranted,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  }

  // 重新读取最新数据
  const { data: updatedSpinData } = await admin
    .from('user_lottery_spins')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const totalSpins = updatedSpinData?.total_spins || 0
  const usedSpins = updatedSpinData?.used_spins || 0
  const updatedInfluencer = updatedSpinData?.is_influencer || false

  return NextResponse.json({
    success: true,
    newSpinsGranted,
    isInfluencer: updatedInfluencer,
    totalSpins,
    usedSpins,
    remainingSpins: Math.max(0, totalSpins - usedSpins),
    canSpin: (totalSpins - usedSpins) > 0,
    inviteFundedCount: fundedInvites,
  })
}
