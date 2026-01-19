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
    const { walletAddress, autoRegister = false } = await request.json()

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

    // If no profile found and autoRegister is true, create new account
    if ((profileError || !profile) && autoRegister) {
      return await createWalletAccount(normalizedAddress)
    }

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

    // User has account - generate login session
    return await generateLoginSession(profile)

  } catch (error) {
    console.error('Wallet login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// Create new account with wallet (no email required)
async function createWalletAccount(walletAddress: string) {
  try {
    // Generate a unique email for this wallet user (internal use only)
    const walletEmail = `${walletAddress.slice(2, 10).toLowerCase()}@wallet.polnation.com`
    const randomPassword = crypto.randomUUID() + crypto.randomUUID()
    const username = `user_${walletAddress.slice(2, 8).toLowerCase()}`

    // Create user in Supabase Auth
    // The trigger will automatically create a profile with this email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: walletEmail,
      password: randomPassword,
      email_confirm: true, // Auto-confirm since this is wallet auth
      user_metadata: {
        wallet_address: walletAddress,
        auth_type: 'wallet'
      }
    })

    if (authError || !authUser.user) {
      console.error('Failed to create auth user:', authError)
      return NextResponse.json(
        { error: 'Failed to create account: ' + (authError?.message || 'Unknown error') },
        { status: 500 }
      )
    }

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update the profile with wallet address (trigger already created the profile)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        wallet_address: walletAddress.toLowerCase(),
        wallet_bound_at: new Date().toISOString(),
        username: username,
        profile_completed: false
      })
      .eq('id', authUser.user.id)

    if (updateError) {
      console.error('Failed to update profile with wallet:', updateError)
      // Profile exists but update failed - try to continue anyway
    }

    // Generate login session for the new user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: walletEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.polnation.com'}/dashboard`
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Failed to generate login link:', linkError)
      return NextResponse.json(
        { error: 'Account created but login failed. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      isNewUser: true,
      magicLink: linkData.properties.action_link,
      userId: authUser.user.id,
      username: username,
      walletAddress: walletAddress
    })

  } catch (error) {
    console.error('Create wallet account error:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

// Generate login session for existing user
async function generateLoginSession(profile: { id: string; email: string | null; username: string | null }) {
  // If user has no real email (wallet-only user), use wallet email
  const loginEmail = profile.email || `${profile.id.slice(0, 8)}@wallet.polnation.com`

  // Generate magic link
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: loginEmail,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.polnation.com'}/dashboard`
    }
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('Failed to generate magic link:', linkError)
    return NextResponse.json(
      { error: 'Failed to authenticate. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    isNewUser: false,
    magicLink: linkData.properties.action_link,
    userId: profile.id,
    email: profile.email,
    username: profile.username
  })
}
