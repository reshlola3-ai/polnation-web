import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

// GET /api/admin/withdrawals/count?since=<iso>
// Returns how many withdrawals were created after `since` — drives the "unread"
// red badge on the admin Withdrawals nav link.
export async function GET(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ count: 0 })

  const admin = createClient(url, key)
  const since = request.nextUrl.searchParams.get('since') || new Date(0).toISOString()

  const { count, error } = await admin
    .from('withdrawals')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', since)

  if (error) {
    console.error('withdrawals count failed:', error)
    return NextResponse.json({ count: 0 })
  }
  return NextResponse.json({ count: count || 0 })
}
