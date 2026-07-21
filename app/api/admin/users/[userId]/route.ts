import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { analyzeTeamGrowth } from '@/lib/balance-snapshots'

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
      .select('available_usdc, community_locked_usdc, available_matic, total_earned_usdc, withdrawn_usdc, withdrawn_matic, withdrawals_frozen')
      .eq('user_id', userId)
      .single()

    // 5b-3. Login history (IP + geo)
    const { data: loginEvents } = await supabaseAdmin
      .from('login_events')
      .select('ip, country, city, user_agent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

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
      login_events: loginEvents || [],
      profits: profits || null,
      wallet_audit: walletAudit || [],
      community: {
        info: community,
        levels: communityLevels || [],
        claims: poolClaims || [],
        daily_earnings: dailyEarnings || [],
      },
      // 团队业绩分析：最近两次快照，L1-3 下线的 入金/撤资/吃息 拆分
      team_growth: await analyzeTeamGrowth(supabaseAdmin, userId).catch(() => null),
    })
  } catch (error) {
    console.error('Error fetching user detail:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST: admin actions on a user. action='freeze_withdrawals' bans withdrawals and
// zeroes the withdrawable balance; action='unfreeze_withdrawals' lifts the ban.
export async function POST(
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
    const { action, reason } = await request.json()

    if (action === 'freeze_withdrawals') {
      const { error } = await supabaseAdmin
        .from('user_profits')
        .update({
          withdrawals_frozen: true,
          frozen_reason: reason || 'admin manual freeze',
          frozen_at: new Date().toISOString(),
          available_usdc: 0,
          available_matic: 0,
          available_commission: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      if (error) {
        console.error('freeze_withdrawals failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, withdrawals_frozen: true })
    }

    if (action === 'unfreeze_withdrawals') {
      const { error } = await supabaseAdmin
        .from('user_profits')
        .update({
          withdrawals_frozen: false,
          frozen_reason: null,
          frozen_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      if (error) {
        console.error('unfreeze_withdrawals failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, withdrawals_frozen: false })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error in user POST action:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
