import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabaseUser() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { user: null }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  return { user }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ canStake: false, reason: 'login_required' })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ canStake: false, reason: 'config_unavailable' }, { status: 500 })
  }

  try {
    const [{ data: config }, { data: profile }, { data: allowlist }] = await Promise.all([
      supabase.from('alpha_stake_config').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('profiles')
        .select('wallet_address, referral_code')
        .eq('id', user.id)
        .single(),
      supabase
        .from('alpha_stake_allowlist')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const stakingOpen = config?.staking_open ?? false
    const allowlistRequired = config?.allowlist_required ?? true
    const hasWallet = Boolean(profile?.wallet_address)
    const isAllowlisted = Boolean(allowlist)

    const walletAddress = profile?.wallet_address ?? null
    const referralCode = profile?.referral_code ?? null

    if (!stakingOpen) {
      return NextResponse.json({
        canStake: false,
        reason: 'capacity_full',
        stakingOpen,
        allowlistRequired,
        hasWallet,
        isAllowlisted,
        walletAddress,
        referralCode,
        minStakeUsdc: 1,
      })
    }

    if (!hasWallet) {
      return NextResponse.json({
        canStake: false,
        reason: 'wallet_required',
        stakingOpen,
        allowlistRequired,
        hasWallet,
        isAllowlisted,
        walletAddress,
        referralCode,
        minStakeUsdc: 1,
      })
    }

    if (allowlistRequired && !isAllowlisted) {
      return NextResponse.json({
        canStake: false,
        reason: 'not_allowlisted',
        stakingOpen,
        allowlistRequired,
        hasWallet,
        isAllowlisted,
        walletAddress,
        referralCode,
        minStakeUsdc: 1,
      })
    }

    return NextResponse.json({
      canStake: true,
      reason: 'allowed',
      stakingOpen,
      allowlistRequired,
      hasWallet,
      isAllowlisted,
      walletAddress,
      minStakeUsdc: 1,
    })
  } catch (err) {
    console.error('[alpha/stake-access] GET failed:', err)
    return NextResponse.json({ canStake: false, reason: 'error' }, { status: 500 })
  }
}
