import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Save (or replace) the user's withdrawal wallet address.
// Does NOT authenticate via wallet — the user is already authenticated (TG or web session).
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { address, source } = await request.json().catch(() => ({}))
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 })
  }

  const normalized = address.toLowerCase()
  const src = typeof source === 'string' ? source.slice(0, 40) : 'bind_wallet_api'

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 钱包绑定一次后永久不可变（DB 触发器也会强制拦截，这里提前给出友好错误 + 留痕）
  const { data: existing } = await admin
    .from('profiles')
    .select('wallet_address')
    .eq('id', user.id)
    .single()

  if (existing?.wallet_address) {
    // 已绑同一地址 → 幂等成功；绑别的地址 → 拒绝并记审计
    if (existing.wallet_address === normalized) {
      return NextResponse.json({ success: true, address: normalized })
    }
    await admin.from('wallet_binding_audit').insert({
      user_id: user.id,
      event: 'change_blocked',
      old_address: existing.wallet_address,
      new_address: normalized,
      source: src,
    })
    return NextResponse.json({ error: 'wallet_already_bound' }, { status: 409 })
  }

  const { error } = await admin
    .from('profiles')
    .update({ wallet_address: normalized, wallet_bound_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('bind-wallet error:', error)
    if (error.code === '23505') {
      // 该地址已被别的账号占用
      await admin.from('wallet_binding_audit').insert({
        user_id: user.id,
        event: 'change_blocked',
        old_address: null,
        new_address: normalized,
        source: `${src}:wallet_taken`,
      })
      return NextResponse.json({ error: 'wallet_taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // 成功绑定的 'bound' 记录由 DB 触发器自动写入
  return NextResponse.json({ success: true, address: normalized })
}
