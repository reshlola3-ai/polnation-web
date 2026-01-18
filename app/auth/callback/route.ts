import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const redirect = searchParams.get('redirect') || '/dashboard'
  const type = searchParams.get('type') // recovery, signup, invite, etc.

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中无法设置 cookies
          }
        },
      },
    }
  )

  // 处理 token_hash 方式（用于密码重置）
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'signup' | 'invite' | 'email',
    })

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/reset-password?type=invite`)
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }
    
    // token_hash 验证失败
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error&error_description=${encodeURIComponent(error.message)}`)
  }

  // 处理 code 方式（PKCE 流程）
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/reset-password?type=invite`)
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // 如果出错，重定向到登录页面
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
