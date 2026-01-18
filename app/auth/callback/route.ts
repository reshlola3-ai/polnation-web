import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/dashboard'
  const type = searchParams.get('type') // recovery, signup, invite, etc.

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 如果是密码重置流程，重定向到重置密码页面
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      // 如果是邀请，重定向到设置密码页面
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/reset-password?type=invite`)
      }
      // 其他情况重定向到指定页面
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // 如果出错，重定向到登录页面
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
