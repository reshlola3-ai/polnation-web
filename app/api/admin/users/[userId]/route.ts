import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface UplineEntry {
  id: string
  username: string | null
  email: string | null
  level: number
}

interface ReferralRow {
  id: string
  username: string | null
  email: string | null
  country_code: string | null
  telegram_username: string | null
  wallet_address: string | null
  created_at: string
  level: number
  team_count: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { userId } = await params

  try {
    // 1. Profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*, referrer:referrer_id(id, username, email)')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2. Last sign-in time (from auth.users)
    let lastSignInAt: string | null = null
    let authCreatedAt: string | null = null
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      lastSignInAt = authUser?.user?.last_sign_in_at ?? null
      authCreatedAt = authUser?.user?.created_at ?? null
    } catch {
      // ignore if not available
    }

    // 3. Upline (recursive up to 3 levels)
    const upline: UplineEntry[] = []
    let currentReferrerId: string | null = profile.referrer_id
    for (let lvl = 1; lvl <= 3 && currentReferrerId; lvl++) {
      const { data: parent } = await supabaseAdmin
        .from('profiles')
        .select('id, username, email, referrer_id')
        .eq('id', currentReferrerId)
        .single()
      if (!parent) break
      upline.push({
        id: parent.id,
        username: parent.username,
        email: parent.email,
        level: lvl,
      })
      currentReferrerId = parent.referrer_id
    }

    // 4. Downline via RPC (returns all levels up to 10)
    const { data: referrals } = await supabaseAdmin.rpc('get_all_referrals', { user_id: userId })
    const downline: ReferralRow[] = (referrals || []).map((r: ReferralRow) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      country_code: r.country_code,
      telegram_username: r.telegram_username,
      wallet_address: r.wallet_address,
      created_at: r.created_at,
      level: r.level,
      team_count: Number(r.team_count) || 0,
    }))

    // 5. Lottery records (full list, client paginates)
    const { data: lotteryRecords } = await supabaseAdmin
      .from('lottery_records')
      .select('id, prize_type, prize_amount, prize_label, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 5b. Withdrawals (full list, client paginates)
    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('id, token_type, amount, usd_amount, wallet_address, status, tx_hash, error_message, processed_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 5b-2. Profit account (可提现余额)
    const { data: profits } = await supabaseAdmin
      .from('user_profits')
      .select('available_usdc, available_matic, total_earned_usdc, withdrawn_usdc, withdrawn_matic')
      .eq('user_id', userId)
      .single()

    // 5c. Wallet binding audit (首次绑定 + 被拦截的换绑尝试)
    const { data: walletAudit } = await supabaseAdmin
      .from('wallet_binding_audit')
      .select('id, event, old_address, new_address, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 6. Community status
    const { data: communityInfo } = await supabaseAdmin
      .rpc('get_user_community_info', { target_user_id: userId })
    const community = communityInfo?.[0] || null

    // Levels config (for display of all unlock thresholds)
    const { data: communityLevels } = await supabaseAdmin
      .from('community_levels')
      .select('level, name, reward_pool, daily_rate, unlock_volume_normal, unlock_volume_influencer')
      .order('level', { ascending: true })

    // Pool claims
    const { data: poolClaims } = await supabaseAdmin
      .from('community_pool_claims')
      .select('level, amount, claim_type, status, claimed_at')
      .eq('user_id', userId)
      .order('level', { ascending: true })

    // Daily earnings (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const { data: dailyEarnings } = await supabaseAdmin
      .from('community_daily_earnings')
      .select('earning_date, level, earning_amount, is_credited')
      .eq('user_id', userId)
      .gte('earning_date', thirtyDaysAgo)
      .order('earning_date', { ascending: false })

    return NextResponse.json({
      profile: {
        ...profile,
        auth_created_at: authCreatedAt,
        last_sign_in_at: lastSignInAt,
      },
      upline,
      downline,
      lottery: lotteryRecords || [],
      withdrawals: withdrawals || [],
      profits: profits || null,
      wallet_audit: walletAudit || [],
      community: {
        info: community,
        levels: communityLevels || [],
        claims: poolClaims || [],
        daily_earnings: dailyEarnings || [],
      },
    })
  } catch (error) {
    console.error('Error fetching user detail:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
