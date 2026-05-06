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

// Defensive referral code generator — mirrors lib/dashboard-data.ts
// ensureReferralCode. Idempotent; only generates when null.
async function ensureReferralCode(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  current: string | null,
): Promise<string | null> {
  if (current || !admin) return current
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const { error } = await admin
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', userId)
      .is('referral_code', null)
    if (!error) return code
    if (error.code !== '23505') break
  }
  return null
}

// GET: Check available spins & get history
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  // Parallelize all 4 reads — total wait time = slowest single query, not sum.
  const [spinRes, historyRes, airdropRes, profileRes, profitsRes, inviteCountRes] = await Promise.all([
    admin.from('user_lottery_spins').select('*').eq('user_id', user.id).single(),
    admin
      .from('lottery_records')
      .select('id, prize_type, prize_label, prize_amount, reward_credited, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('airdrop_calculations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_credited', true),
    admin
      .from('profiles')
      .select('referral_code, wallet_address, telegram_username, referrer_id')
      .eq('id', user.id)
      .single(),
    admin.from('user_profits').select('available_usdc').eq('user_id', user.id).maybeSingle(),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', user.id),
  ])

  // Resolve referrer display name (TG username preferred, polnation username fallback)
  let referredBy: string | null = null
  if (profileRes.data?.referrer_id) {
    const { data: ref } = await admin
      .from('profiles')
      .select('telegram_username, username')
      .eq('id', profileRes.data.referrer_id)
      .single()
    referredBy = ref?.telegram_username || ref?.username || null
  }

  let spinData = spinRes.data
  // 如果没有记录，创建一条
  if (!spinData) {
    const { data: newData } = await admin
      .from('user_lottery_spins')
      .insert({ user_id: user.id, total_spins: 0, used_spins: 0, is_influencer: false })
      .select()
      .single()
    spinData = newData
  }

  // Backfill referral_code if null (one-time per legacy user).
  const referralCode = await ensureReferralCode(
    admin,
    user.id,
    profileRes.data?.referral_code ?? null,
  )

  const isInfluencer = spinData?.is_influencer || false
  const totalSpins = spinData?.total_spins || 0
  const usedSpins = spinData?.used_spins || 0
  const remainingSpins = totalSpins - usedSpins
  const canSpin = remainingSpins > 0

  const selfAirdropCount = airdropRes.data?.length || 0
  const nextMilestone = (Math.floor(selfAirdropCount / 7) + 1) * 7
  const progressToNextSpin = selfAirdropCount % 7

  return NextResponse.json({
    canSpin,
    isInfluencer,
    totalSpins,
    usedSpins,
    remainingSpins: Math.max(0, remainingSpins),
    selfAirdropCount,
    progressToNextSpin,
    nextMilestone,
    history: historyRes.data || [],
    referralCode,
    walletAddress: profileRes.data?.wallet_address ?? null,
    availableUsdc: profitsRes.data?.available_usdc ?? 0,
    telegramUsername: profileRes.data?.telegram_username ?? null,
    referredBy,
    invitedCount: inviteCountRes.count ?? 0,
  })
}
