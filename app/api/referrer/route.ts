import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/referrer?ref=ABC123  or  ?ref=<uuid>
// Returns { name: string } — uses service role to bypass RLS
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref')
  if (!ref) return NextResponse.json({ error: 'ref required' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const admin = createClient(url, key)

  const isShortCode = ref.length <= 6 && !ref.includes('-')
  const { data } = await admin
    .from('profiles')
    .select('id, username')
    .eq(isShortCode ? 'referral_code' : 'id', isShortCode ? ref.toUpperCase() : ref)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ id: data.id, name: data.username })
}
