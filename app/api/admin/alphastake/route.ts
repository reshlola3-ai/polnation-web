import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { fetchOnChainAlphaSummary } from '@/lib/alphastake-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const [chain, configRes, allowlistRes, profilesRes] = await Promise.all([
      fetchOnChainAlphaSummary(),
      supabase.from('alpha_stake_config').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('alpha_stake_allowlist')
        .select('id, user_id, wallet_address, note, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, username, email, wallet_address')
        .not('wallet_address', 'is', null),
    ])

    if (allowlistRes.error && !allowlistRes.error.message.includes('does not exist')) {
      throw allowlistRes.error
    }

    const profileByWallet = new Map<string, {
      id: string
      username: string | null
      email: string | null
      wallet_address: string | null
    }>()

    for (const profile of profilesRes.data || []) {
      if (profile.wallet_address) {
        profileByWallet.set(profile.wallet_address.toLowerCase(), profile)
      }
    }

    const profileById = new Map((profilesRes.data || []).map(p => [p.id, p]))

    const positions = chain.positions.map(pos => {
      const profile = profileByWallet.get(pos.user)
      return {
        ...pos,
        profile: profile
          ? {
              id: profile.id,
              username: profile.username,
              email: profile.email,
            }
          : null,
      }
    })

    const stakerSummary = new Map<string, {
      wallet: string
      profile: { id: string; username: string | null; email: string | null } | null
      openPrincipalUsdc: number
      openPositions: number
      totalPositions: number
    }>()

    for (const pos of positions) {
      const existing = stakerSummary.get(pos.user) || {
        wallet: pos.user,
        profile: pos.profile,
        openPrincipalUsdc: 0,
        openPositions: 0,
        totalPositions: 0,
      }
      existing.totalPositions += 1
      if (!pos.closed) {
        existing.openPrincipalUsdc += pos.amountUsdc
        existing.openPositions += 1
      }
      if (!existing.profile && pos.profile) existing.profile = pos.profile
      stakerSummary.set(pos.user, existing)
    }

    const allowlist = (allowlistRes.data || []).map(row => {
      const profile = profileById.get(row.user_id)
      return {
        ...row,
        username: profile?.username ?? null,
        email: profile?.email ?? null,
        wallet_address: row.wallet_address || profile?.wallet_address || null,
      }
    })

    const eligibleUsers = (profilesRes.data || [])
      .filter(p => p.wallet_address)
      .map(p => {
        const allowed = allowlist.some(a => a.user_id === p.id)
        const staker = stakerSummary.get((p.wallet_address || '').toLowerCase())
        return {
          userId: p.id,
          username: p.username,
          email: p.email,
          walletAddress: p.wallet_address,
          allowlisted: allowed,
          openPrincipalUsdc: staker?.openPrincipalUsdc ?? 0,
          openPositions: staker?.openPositions ?? 0,
        }
      })
      .sort((a, b) => b.openPrincipalUsdc - a.openPrincipalUsdc)

    return NextResponse.json({
      config: configRes.data || {
        staking_open: false,
        allowlist_required: true,
      },
      chain,
      positions,
      stakers: Array.from(stakerSummary.values()).sort(
        (a, b) => b.openPrincipalUsdc - a.openPrincipalUsdc
      ),
      allowlist,
      eligibleUsers,
    })
  } catch (err) {
    console.error('[admin/alphastake] GET failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load AlphaStake data' },
      { status: 500 }
    )
  }
}
