import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface WithdrawalProfile {
  username: string | null
  email: string | null
  wallet_address: string | null
}

interface WithdrawalRow {
  id: string
  user_id: string
  token_type: string
  amount: number | null
  usd_amount: number | null
  wallet_address: string | null
  status: string
  tx_hash: string | null
  error_message: string | null
  processed_at: string | null
  created_at: string
  profile: WithdrawalProfile | null
}

// 管理后台：全站利润提现历史
export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select(`
        id, user_id, token_type, amount, usd_amount, wallet_address,
        status, tx_hash, error_message, processed_at, created_at,
        profile:user_id ( username, email, wallet_address )
      `)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) throw error

    const rows = (data || []) as unknown as WithdrawalRow[]

    // 汇总：金额只统计已完成的提现
    let totalCompletedUsd = 0
    let pendingUsd = 0
    let pendingCount = 0
    let failedCount = 0
    const userIds = new Set<string>()

    for (const w of rows) {
      const usd = Number(w.usd_amount) || 0
      userIds.add(w.user_id)
      if (w.status === 'completed') {
        totalCompletedUsd += usd
      } else if (w.status === 'pending' || w.status === 'processing') {
        pendingUsd += usd
        pendingCount += 1
      } else if (w.status === 'failed') {
        failedCount += 1
      }
    }

    return NextResponse.json({
      withdrawals: rows,
      summary: {
        totalCompletedUsd,
        totalCount: rows.length,
        userCount: userIds.size,
        pendingUsd,
        pendingCount,
        failedCount,
      },
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 })
  }
}
