import 'server-only'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createServerClient } from './supabase-server'

/**
 * Cached helpers for dashboard server-side data.
 * React `cache()` dedupes calls within the same request, so layout and page
 * can both call these without doubling up network traffic.
 */

export const getServerSupabase = cache(async () => {
  return createServerClient()
})

export const getAuthUser = cache(async () => {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
})

export const getProfile = cache(async () => {
  const user = await getAuthUser()
  const supabase = await getServerSupabase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, wallet_address, profile_completed, referral_code, email')
    .eq('id', user.id)
    .single()
  return profile
})

export const getTeamStats = cache(async () => {
  const user = await getAuthUser()
  const supabase = await getServerSupabase()
  const { data } = await supabase.rpc('get_team_stats', { user_id: user.id })
  return (data?.[0] as { total_team_members: number; level1_members: number } | undefined)
    ?? { total_team_members: 0, level1_members: 0 }
})

/**
 * Defensive: fill in referral_code if it's null. Uses service-role client.
 * Returns the (possibly updated) profile. Idempotent — safe to call repeatedly.
 */
export async function ensureReferralCode(profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>) {
  if (profile.referral_code) return profile

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) return profile

  const user = await getAuthUser()
  const admin = createClient(adminUrl, adminKey)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const { error } = await admin
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', user.id)
      .is('referral_code', null)
    if (!error) {
      console.log(`Auto-generated referral_code ${code} for user ${user.id}`)
      return { ...profile, referral_code: code }
    }
    if (error.code !== '23505') {
      console.error('Failed to auto-generate referral_code:', error)
      break
    }
  }
  return profile
}
