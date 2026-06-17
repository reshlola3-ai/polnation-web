import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Capture the user's real IP + geo on dashboard entry (server-side).
 *
 * IP: the FIRST entry of x-forwarded-for is the real client (the rest are
 * proxies); fall back to x-real-ip. Geo comes from Vercel's edge headers.
 *
 * Throttled: if the same user already has an event from the same IP in the last
 * 30 min, we skip — so refreshes don't spam the history. Best-effort; never
 * throws into the render path.
 */
export async function recordLogin(userId: string): Promise<void> {
  try {
    const h = await headers()

    const fwd = h.get('x-forwarded-for') || ''
    const ip = (fwd.split(',')[0] || '').trim() || h.get('x-real-ip') || null
    const country = h.get('x-vercel-ip-country') || null
    const cityRaw = h.get('x-vercel-ip-city')
    const city = cityRaw ? decodeURIComponent(cityRaw) : null
    const userAgent = h.get('user-agent') || null

    const admin = getSupabaseAdmin()
    if (!admin) return

    // Throttle: same user + same IP within 30 min → don't record again.
    if (ip) {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: recent } = await admin
        .from('login_events')
        .select('id')
        .eq('user_id', userId)
        .eq('ip', ip)
        .gt('created_at', since)
        .limit(1)
      if (recent && recent.length) return
    }

    await admin.from('login_events').insert({
      user_id: userId,
      ip,
      country,
      city,
      user_agent: userAgent,
    })

    await admin
      .from('profiles')
      .update({
        last_login_ip: ip,
        last_login_country: country,
        last_login_city: city,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', userId)
  } catch (err) {
    console.error('recordLogin failed:', err)
  }
}
