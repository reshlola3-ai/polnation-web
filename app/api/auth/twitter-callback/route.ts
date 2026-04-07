import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BASE = 'https://polnation.com'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${BASE}/tasks?twitter_error=cancelled`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('tw_state')?.value
  const codeVerifier = cookieStore.get('tw_cv')?.value

  if (!code || !state || state !== savedState || !codeVerifier) {
    return NextResponse.redirect(`${BASE}/tasks?twitter_error=invalid_state`)
  }

  // Exchange code for access token
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${BASE}/api/auth/twitter-callback`,
      code_verifier: codeVerifier,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${BASE}/tasks?twitter_error=token_failed`)
  }

  // Get Twitter user info
  const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=id,username', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  })
  const userData = await userRes.json()
  const twitterId: string = userData?.data?.id
  const twitterUsername: string = userData?.data?.username

  if (!twitterId) {
    return NextResponse.redirect(`${BASE}/tasks?twitter_error=user_fetch_failed`)
  }

  // Get current Supabase user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${BASE}/login`)
  }

  // Check if this Twitter account is already linked to a different Polnation account
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('twitter_id', twitterId)
    .neq('id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.redirect(`${BASE}/tasks?twitter_error=already_linked`)
  }

  // Link Twitter to this account
  await supabaseAdmin
    .from('profiles')
    .update({
      twitter_verified: true,
      twitter_id: twitterId,
      twitter_username: twitterUsername,
    })
    .eq('id', user.id)

  const response = NextResponse.redirect(`${BASE}/tasks`)
  response.cookies.delete('tw_state')
  response.cookies.delete('tw_cv')
  return response
}
