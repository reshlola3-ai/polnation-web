import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

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
      const newGrants = selfMilestonesEarned - lastSelfGrantIndex

      for (let i = lastSelfGrantIndex + 1; i <= selfMilestonesEarned; i++) {
        const milestoneValue = i * 7
        // 防重复：检查该 milestone 是否已存在
        const { data: exists } = await admin
          .from('lottery_spin_grants')
          .select('id')
          .eq('user_id', user.id)
          .eq('grant_reason', 'self_airdrop_7x')
          .eq('milestone_count', milestoneValue)
          .single()

        if (!exists) {
          await admin
            .from('lottery_spin_grants')
            .insert({
              user_id: user.id,
              grant_reason: 'self_airdrop_7x',
              milestone_count: milestoneValue,
              spins_granted: 1,
            })
          newSpinsGranted += 1
        }
      }
    }
  }

  // ========== 3. 检查推荐人的下线空投领取（下线领取7次 → 推荐人 +1 次）==========
  // 获取自己的直推下线
  const { data: directReferrals } = await admin
    .from('profiles')
    .select('id')
    .eq('referrer_id', user.id)

  if (directReferrals && directReferrals.length > 0) {
    for (const referral of directReferrals) {
      // 计算该下线的空投领取次数
      const { data: referralAirdrops } = await admin
        .from('airdrop_calculations')
        .select('id')
        .eq('user_id', referral.id)
        .eq('is_credited', true)

      const referralClaimCount = referralAirdrops?.length || 0

      // 只有达到7次才发放
      if (referralClaimCount >= 7) {
        // 检查是否已经为该推荐人+下线组合发放过
        const { data: existingGrant } = await admin
          .from('lottery_spin_grants')
          .select('id')
          .eq('user_id', user.id)
          .eq('grant_reason', 'referral_airdrop_7')
          .eq('referral_id', referral.id)
          .single()

        if (!existingGrant) {
          await admin
            .from('lottery_spin_grants')
            .insert({
              user_id: user.id,
              grant_reason: 'referral_airdrop_7',
              referral_id: referral.id,
              milestone_count: 7,
              spins_granted: 1,
            })
          newSpinsGranted += 1
        }
      }
    }
  }

  // ========== 4. 更新 total_spins ==========
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
  })
}
