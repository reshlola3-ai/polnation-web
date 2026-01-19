import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Get admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// Get current user
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

// Check if email is a wallet placeholder
function isWalletEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return email.endsWith('@wallet.polnation.com')
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only allow wallet users to bind email
  if (!isWalletEmail(user.email)) {
    return NextResponse.json({ 
      error: 'Your email is already verified',
      code: 'ALREADY_VERIFIED'
    }, { status: 400 })
  }

  const { email, password } = await request.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  // Don't allow binding to another wallet placeholder
  if (email.endsWith('@wallet.polnation.com')) {
    return NextResponse.json({ error: 'Please use a real email address' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // Check if email is already used by another user
    const { data: existingUsers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .neq('id', user.id)

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ 
        error: 'This email is already registered to another account',
        code: 'EMAIL_IN_USE'
      }, { status: 400 })
    }

    // Use Admin API to directly update user email and password (bypasses verification)
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        email: email.toLowerCase(),
        password: password,
        email_confirm: true  // Auto-confirm the email
      }
    )

    if (updateAuthError) {
      console.error('Error updating auth user:', updateAuthError)
      return NextResponse.json({ 
        error: updateAuthError.message || 'Failed to update email'
      }, { status: 500 })
    }

    // Also update profiles table directly (in case trigger doesn't fire)
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        email: email.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError)
      // Don't fail - auth was already updated
    }

    return NextResponse.json({ 
      message: 'Email updated successfully',
      email: email.toLowerCase()
    })

  } catch (error) {
    console.error('Bind email error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
