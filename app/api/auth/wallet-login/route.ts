import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const normalizedAddress = walletAddress.toLowerCase()

    // Find user with this wallet address
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username')
      .eq('wallet_address', normalizedAddress)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { 
          error: 'No account found for this wallet',
          needsRegistration: true,
          walletAddress: normalizedAddress
        },
        { status: 404 }
      )
    }

    // Check if user has email (required for magic link)
    if (!profile.email) {
      return NextResponse.json(
        { error: 'Account has no email. Please login with email/password.' },
        { status: 400 }
      )
    }

    // Generate magic link for this user (won't send email, just get the link)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.polnation.com'}/dashboard`
      }
    })

    if (linkError || !linkData) {
      console.error('Failed to generate magic link:', linkError)
      return NextResponse.json(
        { error: 'Failed to authenticate. Please try email login.' },
        { status: 500 }
      )
    }

    // Extract the token hash from the generated link
    // The link format is: {site_url}/auth/callback#token_hash={hash}&type=magiclink
    const actionLink = linkData.properties?.action_link
    if (!actionLink) {
      return NextResponse.json(
        { error: 'Failed to generate login link' },
        { status: 500 }
      )
    }

    // Use verifyOtp to create a session with the token
    const urlParams = new URL(actionLink)
    const tokenHash = urlParams.searchParams.get('token') || urlParams.hash?.split('token=')[1]?.split('&')[0]
    
    if (!tokenHash) {
      // Alternative: directly verify the user and create session
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.getUserById(profile.id)
      
      if (sessionError || !sessionData.user) {
        return NextResponse.json(
          { error: 'Failed to verify user' },
          { status: 500 }
        )
      }

      // Return the magic link for client-side verification
      return NextResponse.json({
        success: true,
        magicLink: actionLink,
        userId: profile.id,
        email: profile.email,
        username: profile.username
      })
    }

    return NextResponse.json({
      success: true,
      magicLink: actionLink,
      userId: profile.id,
      email: profile.email,
      username: profile.username
    })

  } catch (error) {
    console.error('Wallet login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
