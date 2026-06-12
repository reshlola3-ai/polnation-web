import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const IDENTITY_BUCKET = 'claim-identity'

interface ClaimRow {
  id: string
  user_id: string
  level: number
  amount: number
  status: string
  claimed_at: string
  reviewed_at: string | null
  rejected_reason: string | null
  profile: { username: string | null; email: string | null; wallet_address: string | null } | null
}

// 列出待审 + 最近已审的 claim（带身份照片签名URL + 同名提示）
export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { data: pending } = await supabase
      .from('community_pool_claims')
      .select('id, user_id, level, amount, status, claimed_at, reviewed_at, rejected_reason, profile:user_id(username, email, wallet_address)')
      .eq('status', 'pending')
      .order('claimed_at', { ascending: true })

    const { data: recent } = await supabase
      .from('community_pool_claims')
      .select('id, user_id, level, amount, status, claimed_at, reviewed_at, rejected_reason, profile:user_id(username, email, wallet_address)')
      .in('status', ['completed', 'rejected'])
      .not('reviewed_at', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(30)

    const pendingRows = (pending || []) as unknown as ClaimRow[]
    const recentRows = (recent || []) as unknown as ClaimRow[]

    const userIds = Array.from(new Set([...pendingRows, ...recentRows].map(r => r.user_id)))

    // 身份资料
    const { data: identities } = await supabase
      .from('user_identity')
      .select('user_id, real_name, photo_path')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const identityByUser = new Map<string, { real_name: string; photo_path: string }>()
    for (const i of identities || []) identityByUser.set(i.user_id, { real_name: i.real_name, photo_path: i.photo_path })

    // 同名计数（跨账号疑似重复）
    const nameCount = new Map<string, number>()
    for (const i of identities || []) {
      const key = (i.real_name || '').trim().toLowerCase()
      nameCount.set(key, (nameCount.get(key) || 0) + 1)
    }

    // 等级名
    const { data: levels } = await supabase.from('community_levels').select('level, name')
    const levelName = new Map((levels || []).map(l => [l.level, l.name]))

    // 冻结状态
    const { data: statuses } = await supabase
      .from('user_community_status')
      .select('user_id, claims_frozen')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
    const frozenByUser = new Map((statuses || []).map(s => [s.user_id, !!s.claims_frozen]))

    async function decorate(rows: ClaimRow[]) {
      return Promise.all(rows.map(async (r) => {
        const ident = identityByUser.get(r.user_id) || null
        let photoUrl: string | null = null
        if (ident?.photo_path) {
          const { data: signed } = await supabase!
            .storage.from(IDENTITY_BUCKET)
            .createSignedUrl(ident.photo_path, 3600)
          photoUrl = signed?.signedUrl || null
        }
        const nameKey = (ident?.real_name || '').trim().toLowerCase()
        return {
          id: r.id,
          user_id: r.user_id,
          username: r.profile?.username || null,
          email: r.profile?.email || null,
          wallet_address: r.profile?.wallet_address || null,
          level: r.level,
          level_name: levelName.get(r.level) || `L${r.level}`,
          amount: Number(r.amount),
          status: r.status,
          claimed_at: r.claimed_at,
          reviewed_at: r.reviewed_at,
          rejected_reason: r.rejected_reason,
          real_name: ident?.real_name || null,
          photo_url: photoUrl,
          same_name_count: nameKey ? (nameCount.get(nameKey) || 1) : 1,
          claims_frozen: frozenByUser.get(r.user_id) || false,
        }
      }))
    }

    return NextResponse.json({
      pending: await decorate(pendingRows),
      recent: await decorate(recentRows),
    })
  } catch (error) {
    console.error('Admin claims GET error:', error)
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 })
  }
}

// 审批操作：approve / reject / unfreeze
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { action, claim_id, user_id, reason } = await request.json()
    const now = new Date().toISOString()

    if (action === 'unfreeze') {
      if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
      await supabase
        .from('user_community_status')
        .update({ claims_frozen: false, frozen_reason: null, frozen_at: null, updated_at: now })
        .eq('user_id', user_id)
      return NextResponse.json({ success: true, message: '已解冻该账号' })
    }

    if (!claim_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // 取出待审 claim
    const { data: claim } = await supabase
      .from('community_pool_claims')
      .select('*')
      .eq('id', claim_id)
      .single()

    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Claim already reviewed' }, { status: 400 })
    }

    if (action === 'reject') {
      await supabase
        .from('community_pool_claims')
        .update({ status: 'rejected', rejected_reason: reason || null, reviewed_by: 'admin', reviewed_at: now })
        .eq('id', claim_id)

      // 冻结该账号所有后续 claim
      await supabase
        .from('user_community_status')
        .update({ claims_frozen: true, frozen_reason: reason || 'Claim rejected', frozen_at: now, updated_at: now })
        .eq('user_id', claim.user_id)

      return NextResponse.json({ success: true, message: '已驳回并冻结该账号' })
    }

    // ===== approve：发钱 + 升级（复刻原自动领取逻辑，搬到审批时执行） =====
    const amount = Number(claim.amount)

    const { data: status } = await supabase
      .from('user_community_status')
      .select('*')
      .eq('user_id', claim.user_id)
      .single()

    // 1) 利润账户入账
    const { data: profits } = await supabase
      .from('user_profits')
      .select('*')
      .eq('user_id', claim.user_id)
      .single()

    if (profits) {
      await supabase
        .from('user_profits')
        .update({
          available_usdc: profits.available_usdc + amount,
          total_earned_usdc: profits.total_earned_usdc + amount,
          updated_at: now,
        })
        .eq('user_id', claim.user_id)
    } else {
      await supabase
        .from('user_profits')
        .insert({
          user_id: claim.user_id,
          available_usdc: amount,
          total_earned_usdc: amount,
          available_matic: 0,
          withdrawn_usdc: 0,
          withdrawn_matic: 0,
        })
    }

    // 2) 社群状态：累计收益；自然用户升级到 level+1
    const nextLevel = claim.level + 1
    const statusUpdate: Record<string, unknown> = {
      total_community_earned: (status?.total_community_earned || 0) + amount,
      updated_at: now,
    }
    if (!status?.is_admin_set) {
      statusUpdate.current_level = nextLevel
      statusUpdate.real_level = nextLevel
    }
    await supabase
      .from('user_community_status')
      .update(statusUpdate)
      .eq('user_id', claim.user_id)

    // 3) claim 转 completed
    await supabase
      .from('community_pool_claims')
      .update({ status: 'completed', credited_at: now, reviewed_by: 'admin', reviewed_at: now })
      .eq('id', claim_id)

    return NextResponse.json({
      success: true,
      message: `已批准：$${amount} 已入账` + (status?.is_admin_set ? '' : `，升级到 L${nextLevel}`),
    })
  } catch (error) {
    console.error('Admin claims POST error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
