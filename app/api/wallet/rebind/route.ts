import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST: 将某钱包地址从旧账号解绑，绑定到当前账号
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { wallet_address } = await request.json()
  if (!wallet_address) return NextResponse.json({ error: 'wallet_address required' }, { status: 400 })

  const normalized = wallet_address.toLowerCase()

  // 确认该钱包确实绑在别的账号上
  const { data: oldProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('wallet_address', normalized)
    .neq('id', user.id)
    .single()

  if (!oldProfile) {
    // 没有冲突，直接绑到当前账号
  } else {
    // 从旧账号清除钱包
    await admin
      .from('profiles')
      .update({ wallet_address: null, wallet_bound_at: null })
      .eq('id', oldProfile.id)
  }

  // 绑定到当前账号
  const { error } = await admin
    .from('profiles')
    .update({ wallet_address: normalized, wallet_bound_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
