import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { generateAdminToken } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

// Brute-force throttle (DB-backed via system_cache so it works across serverless
// instances; no extra table/migration needed).
const RL_WINDOW_MS = 15 * 60 * 1000 // 15 min sliding window
const RL_MAX_FAILS = 5              // allowed failed attempts per IP per window

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // ── Rate limit by client IP ────────────────────────────────────────────
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    const rlKey = `adminlogin:${ip}`
    const now = Date.now()
    const { data: rlRow } = await supabaseAdmin
      .from('system_cache').select('data').eq('key', rlKey).maybeSingle()
    const rl = rlRow?.data as { count?: number; windowStart?: number } | undefined
    const inWindow = rl?.windowStart != null && now - rl.windowStart < RL_WINDOW_MS
    let fails = inWindow ? (rl?.count || 0) : 0
    const windowStart = inWindow ? rl!.windowStart! : now
    if (fails >= RL_MAX_FAILS) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429 }
      )
    }

    // 验证管理员凭据
    const { data: admin, error } = await supabaseAdmin
      .rpc('verify_admin', {
        admin_username: username,
        admin_password: password
      })

    if (error || !admin) {
      // record the failed attempt
      fails += 1
      await supabaseAdmin.from('system_cache').upsert({
        key: rlKey,
        data: { count: fails, windowStart },
        updated_at: new Date().toISOString(),
      })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // success → clear the throttle for this IP
    await supabaseAdmin.from('system_cache').delete().eq('key', rlKey)

    // 生成 HMAC-SHA256 签名 token
    const token = generateAdminToken()
    
    // 设置 cookie
    const cookieStore = await cookies()
    cookieStore.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
