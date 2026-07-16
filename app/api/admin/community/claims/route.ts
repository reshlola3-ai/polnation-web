import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import { computeTeamStakingRatio, releaseMaintenanceClaim, DEFAULT_MAINTENANCE_DAYS } from '@/lib/community-maintenance'
import { DEFAULT_INSTALLMENT_DAYS } from '@/lib/community-installment'

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

interface UnlockRow {
  id: string
  user_id: string
  requested_amount: number
  credited_amount: number | null
  status: string
  rejected_reason: string | null
  created_at: string
  reviewed_at: string | null
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
      .select('user_id, real_name, photo_path, phone')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const identityByUser = new Map<string, { real_name: string; photo_path: string | null; phone: string | null }>()
    for (const i of identities || []) identityByUser.set(i.user_id, { real_name: i.real_name, photo_path: i.photo_path, phone: i.phone })

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
          phone: ident?.phone || null,
          photo_url: photoUrl,
          same_name_count: nameKey ? (nameCount.get(nameKey) || 1) : 1,
          claims_frozen: frozenByUser.get(r.user_id) || false,
        }
      }))
    }

    // ===== Influencer-lock: unlock requests =====
    const unlockSelect = 'id, user_id, requested_amount, credited_amount, status, rejected_reason, created_at, reviewed_at, profile:user_id(username, email, wallet_address)'

    const { data: unlockPendingRaw } = await supabase
      .from('community_unlock_requests')
      .select(unlockSelect)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    const { data: unlockRecentRaw } = await supabase
      .from('community_unlock_requests')
      .select(unlockSelect)
      .in('status', ['approved', 'rejected'])
      .order('reviewed_at', { ascending: false })
      .limit(30)

    const unlockPendingRows = (unlockPendingRaw || []) as unknown as UnlockRow[]
    const unlockRecentRows = (unlockRecentRaw || []) as unknown as UnlockRow[]

    // live locked balance for pending rows (authoritative amount admin will release)
    const unlockUserIds = unlockPendingRows.map(r => r.user_id)
    const { data: lockedProfits } = await supabase
      .from('user_profits')
      .select('user_id, community_locked_usdc')
      .in('user_id', unlockUserIds.length ? unlockUserIds : ['00000000-0000-0000-0000-000000000000'])
    const lockedByUser = new Map((lockedProfits || []).map(p => [p.user_id, Number(p.community_locked_usdc || 0)]))

    const mapUnlock = (rows: UnlockRow[]) => rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      username: r.profile?.username || null,
      email: r.profile?.email || null,
      wallet_address: r.profile?.wallet_address || null,
      requested_amount: Number(r.requested_amount),
      credited_amount: r.credited_amount != null ? Number(r.credited_amount) : null,
      current_locked: lockedByUser.has(r.user_id) ? lockedByUser.get(r.user_id)! : null,
      status: r.status,
      rejected_reason: r.rejected_reason,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    }))

    // 待审 claim 附带团队 staking 比例（合约本金 vs 钱包 USDC），给管理员做参考。
    const pendingDecorated = await decorate(pendingRows)
    const pendingRatios = await Promise.all(
      pendingDecorated.map((p) => computeTeamStakingRatio(supabase!, p.user_id).catch(() => null)),
    )
    const pendingWithRatio = pendingDecorated.map((p, i) => ({
      ...p,
      staking_ratio: pendingRatios[i]?.ratio ?? null,
      staked_volume: pendingRatios[i]?.stakedVolume ?? null,
      team_volume_live: pendingRatios[i]?.totalVolume ?? null,
    }))

    // 维持中的 claim（含管理员手动暂停 maintenance_paused）
    const { data: maintRaw } = await supabase
      .from('community_pool_claims')
      .select('id, user_id, level, amount, status, maintenance_required_days, maintenance_days_done, maintenance_threshold, maintenance_started_at, staking_ratio_at_approval, profile:user_id(username, email, wallet_address)')
      .in('status', ['maintenance', 'maintenance_paused'])
      .order('maintenance_started_at', { ascending: true })
    const maintRows = (maintRaw || []) as unknown as Array<{
      id: string; user_id: string; level: number; amount: number; status: string
      maintenance_required_days: number | null; maintenance_days_done: number | null
      maintenance_threshold: number | null; maintenance_started_at: string | null
      staking_ratio_at_approval: number | null
      profile: { username: string | null; email: string | null } | null
    }>
    const maintRatios = await Promise.all(
      maintRows.map((m) => computeTeamStakingRatio(supabase!, m.user_id).catch(() => null)),
    )
    const maintenance = maintRows.map((m, i) => ({
      id: m.id,
      user_id: m.user_id,
      username: m.profile?.username || null,
      email: m.profile?.email || null,
      level: m.level,
      level_name: levelName.get(m.level) || `L${m.level}`,
      amount: Number(m.amount),
      required_days: Number(m.maintenance_required_days || 0),
      days_done: Number(m.maintenance_days_done || 0),
      threshold: Number(m.maintenance_threshold || 0),
      started_at: m.maintenance_started_at,
      staking_ratio: maintRatios[i]?.ratio ?? null,
      admin_paused: m.status === 'maintenance_paused',
    }))

    // 分期发放中的 claim（已批准、按天匀速兑付）
    const { data: instRaw } = await supabase
      .from('community_pool_claims')
      .select('id, user_id, level, amount, installment_total_days, installment_days_done, installment_released, installment_started_at, profile:user_id(username, email)')
      .eq('status', 'installment')
      .order('installment_started_at', { ascending: true })
    const instRows = (instRaw || []) as unknown as Array<{
      id: string; user_id: string; level: number; amount: number
      installment_total_days: number | null; installment_days_done: number | null
      installment_released: number | null; installment_started_at: string | null
      profile: { username: string | null; email: string | null } | null
    }>
    const installment = instRows.map((m) => {
      const total = Number(m.amount)
      const totalDays = Number(m.installment_total_days || 0)
      return {
        id: m.id,
        user_id: m.user_id,
        username: m.profile?.username || null,
        email: m.profile?.email || null,
        level: m.level,
        level_name: levelName.get(m.level) || `L${m.level}`,
        amount: total,
        total_days: totalDays,
        days_done: Number(m.installment_days_done || 0),
        released: Number(m.installment_released || 0),
        daily_amount: totalDays > 0 ? Math.round((total / totalDays) * 1e6) / 1e6 : 0,
        started_at: m.installment_started_at,
      }
    })

    // 锁定日薪汇总：所有 community_locked_usdc > 0 的用户（不限 leader）
    const lockedRows: Array<{ user_id: string; community_locked_usdc: number }> = []
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from('user_profits')
        .select('user_id, community_locked_usdc')
        .gt('community_locked_usdc', 0)
        .range(from, from + 999)
      if (!data || data.length === 0) break
      lockedRows.push(...(data as Array<{ user_id: string; community_locked_usdc: number }>))
      if (data.length < 1000) break
    }
    const lockedUserIds = lockedRows.map(r => r.user_id)
    const lockedProfileMap = new Map<string, { username: string | null; email: string | null }>()
    const lockedStatusMap = new Map<string, { current_level: number | null; is_admin_set: boolean | null; is_influencer: boolean | null }>()
    for (let i = 0; i < lockedUserIds.length; i += 300) {
      const chunk = lockedUserIds.slice(i, i + 300)
      const { data: profs } = await supabase.from('profiles').select('id, username, email').in('id', chunk)
      for (const p of profs || []) lockedProfileMap.set(p.id as string, { username: p.username as string | null, email: p.email as string | null })
      const { data: sts } = await supabase.from('user_community_status').select('user_id, current_level, is_admin_set, is_influencer').in('user_id', chunk)
      for (const st of sts || []) lockedStatusMap.set(st.user_id as string, { current_level: st.current_level as number | null, is_admin_set: st.is_admin_set as boolean | null, is_influencer: st.is_influencer as boolean | null })
    }
    const locked = lockedRows.map(r => {
      const p = lockedProfileMap.get(r.user_id)
      const st = lockedStatusMap.get(r.user_id)
      return {
        user_id: r.user_id,
        username: p?.username || null,
        email: p?.email || null,
        level: Number(st?.current_level ?? 0),
        is_admin_set: !!st?.is_admin_set,
        is_influencer: !!st?.is_influencer,
        locked: Number(r.community_locked_usdc || 0),
      }
    }).sort((a, b) => b.locked - a.locked)

    return NextResponse.json({
      pending: pendingWithRatio,
      recent: await decorate(recentRows),
      maintenance,
      installment,
      locked,
      unlockPending: mapUnlock(unlockPendingRows),
      unlockRecent: mapUnlock(unlockRecentRows),
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
    const { action, claim_id, user_id, reason, request_id, days, amount: releaseAmount } = await request.json()
    const now = new Date().toISOString()

    if (action === 'unfreeze') {
      if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
      await supabase
        .from('user_community_status')
        .update({ claims_frozen: false, frozen_reason: null, frozen_at: null, updated_at: now })
        .eq('user_id', user_id)
      return NextResponse.json({ success: true, message: '已解冻该账号' })
    }

    // ===== 锁定日薪：管理员直接放行部分到可提现（不经解锁申请）=====
    if (action === 'release_locked') {
      if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
      const requested = Number(releaseAmount)
      if (!Number.isFinite(requested) || requested <= 0) {
        return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
      }
      const { data: prof } = await supabase
        .from('user_profits')
        .select('available_usdc, community_locked_usdc')
        .eq('user_id', user_id)
        .single()
      if (!prof) return NextResponse.json({ error: 'User profits not found' }, { status: 404 })
      const lockedBal = Number(prof.community_locked_usdc || 0)
      if (lockedBal <= 0) return NextResponse.json({ error: 'No locked balance' }, { status: 400 })
      const release = Math.min(requested, lockedBal)
      const remaining = Math.max(0, parseFloat((lockedBal - release).toFixed(6)))
      // 锁定 → 可提现：total_earned 不动（发放时已计入）
      await supabase
        .from('user_profits')
        .update({
          available_usdc: Number(prof.available_usdc || 0) + release,
          community_locked_usdc: remaining,
          updated_at: now,
        })
        .eq('user_id', user_id)
      // 记一条放行流水（复用 unlock_requests；approved 不占 pending 唯一索引，
      // 自动出现在"工资解锁申请"历史里）。记账失败不影响已完成的放行。
      const { error: logErr } = await supabase
        .from('community_unlock_requests')
        .insert({
          user_id,
          requested_amount: release,
          credited_amount: release,
          status: 'approved',
          reviewed_by: 'admin',
          reviewed_at: now,
        })
      if (logErr) console.error('release_locked audit insert failed:', logErr.message)
      return NextResponse.json({ success: true, message: `已放行 $${release.toFixed(2)} 到可提现，剩余锁定 $${remaining.toFixed(2)}` })
    }

    // ===== 锁定日薪：作废清零（不给用户，从累计收益一并减掉，当没发生过）=====
    if (action === 'void_locked') {
      if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
      const { data: prof } = await supabase
        .from('user_profits')
        .select('total_earned_usdc, community_locked_usdc')
        .eq('user_id', user_id)
        .single()
      if (!prof) return NextResponse.json({ error: 'User profits not found' }, { status: 404 })
      const lockedBal = Number(prof.community_locked_usdc || 0)
      if (lockedBal <= 0) return NextResponse.json({ error: 'No locked balance' }, { status: 400 })
      const newTotalEarned = Math.max(0, parseFloat((Number(prof.total_earned_usdc || 0) - lockedBal).toFixed(6)))
      // 作废：锁定归 0，且从 total_earned 减掉（当没发生过）；available 不变
      await supabase
        .from('user_profits')
        .update({
          community_locked_usdc: 0,
          total_earned_usdc: newTotalEarned,
          updated_at: now,
        })
        .eq('user_id', user_id)
      return NextResponse.json({ success: true, message: `已作废 $${lockedBal.toFixed(2)} 锁定额度（不计入收益）` })
    }

    // ===== Influencer-lock: unlock-request approval =====
    if (action === 'unlock_approve' || action === 'unlock_reject') {
      if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

      const { data: req } = await supabase
        .from('community_unlock_requests')
        .select('*')
        .eq('id', request_id)
        .single()

      if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      if (req.status !== 'pending') {
        return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 })
      }

      if (action === 'unlock_reject') {
        await supabase
          .from('community_unlock_requests')
          .update({ status: 'rejected', rejected_reason: reason || null, reviewed_by: 'admin', reviewed_at: now })
          .eq('id', request_id)
        return NextResponse.json({ success: true, message: '已驳回解锁申请' })
      }

      // approve: release an admin-chosen amount into available_usdc; the rest
      // stays locked. Amount is clamped to the *current* locked balance
      // (server-authoritative); missing/oversized amount → release full.
      const { data: profits } = await supabase
        .from('user_profits')
        .select('available_usdc, community_locked_usdc')
        .eq('user_id', req.user_id)
        .single()

      const locked = Number(profits?.community_locked_usdc || 0)
      if (locked <= 0) {
        // nothing left to release — close the request out cleanly
        await supabase
          .from('community_unlock_requests')
          .update({ status: 'approved', credited_amount: 0, reviewed_by: 'admin', reviewed_at: now })
          .eq('id', request_id)
        return NextResponse.json({ success: true, message: '该用户已无锁定余额，申请已结清' })
      }

      // 管理员可指定放行金额（部分解锁）；不传或超出锁定额则全额放行。
      const requested = Number(releaseAmount)
      const release = Number.isFinite(requested) && requested > 0
        ? Math.min(requested, locked)
        : locked
      const remaining = Math.max(0, parseFloat((locked - release).toFixed(6)))

      await supabase
        .from('user_profits')
        .update({
          available_usdc: Number(profits?.available_usdc || 0) + release,
          community_locked_usdc: remaining,
          updated_at: now,
        })
        .eq('user_id', req.user_id)

      await supabase
        .from('community_unlock_requests')
        .update({ status: 'approved', credited_amount: release, reviewed_by: 'admin', reviewed_at: now })
        .eq('id', request_id)

      return NextResponse.json({
        success: true,
        message: remaining > 0
          ? `已放行 $${release.toFixed(2)} 到可提现，剩余 $${remaining.toFixed(2)} 继续锁定`
          : `已批准：$${release.toFixed(2)} 已全部转入可提现`,
      })
    }

    // ===== 批准但进入维持期：等级立即升、每日收益照常，奖金冻结待达标 =====
    if (action === 'approve_maintenance') {
      if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 400 })
      const reqDays = Math.max(1, Math.min(365, Math.round(Number(days) || DEFAULT_MAINTENANCE_DAYS)))

      const { data: claim } = await supabase
        .from('community_pool_claims')
        .select('*')
        .eq('id', claim_id)
        .single()
      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      if (claim.status !== 'pending') {
        return NextResponse.json({ error: 'Claim already reviewed' }, { status: 400 })
      }

      const { data: status } = await supabase
        .from('user_community_status')
        .select('*')
        .eq('user_id', claim.user_id)
        .single()

      // 定格标尺：领取时等级的解锁门槛（influencer 用折扣门槛）
      const { data: levelCfg } = await supabase
        .from('community_levels')
        .select('unlock_volume_normal, unlock_volume_influencer')
        .eq('level', claim.level)
        .single()
      const threshold = status?.is_influencer
        ? Number(levelCfg?.unlock_volume_influencer || 0)
        : Number(levelCfg?.unlock_volume_normal || 0)

      let stakingRatio = 0
      try {
        stakingRatio = (await computeTeamStakingRatio(supabase, claim.user_id)).ratio
      } catch { /* 存档失败不阻断 */ }

      // 立即升级（自然用户），每日收益随新等级；admin-set 用户等级不动
      const nextLevel = claim.level + 1
      const statusUpdate: Record<string, unknown> = { updated_at: now }
      if (!status?.is_admin_set) {
        statusUpdate.current_level = nextLevel
        statusUpdate.real_level = nextLevel
      }
      await supabase.from('user_community_status').update(statusUpdate).eq('user_id', claim.user_id)

      // claim 转 maintenance，钱不动
      await supabase
        .from('community_pool_claims')
        .update({
          status: 'maintenance',
          maintenance_required_days: reqDays,
          maintenance_days_done: 0,
          maintenance_threshold: threshold,
          maintenance_started_at: now,
          maintenance_last_counted_date: null,
          staking_ratio_at_approval: stakingRatio,
          reviewed_by: 'admin',
          reviewed_at: now,
        })
        .eq('id', claim_id)

      return NextResponse.json({
        success: true,
        message: `已进入维持期：需累计维持 ${reqDays} 天（或 staking≥50% 提前放行），$${Number(claim.amount)} 达标后自动发放`,
      })
    }

    // ===== 批准 + 分期发放：立即升级，奖金按天匀速解锁（无条件时间 vesting）=====
    if (action === 'approve_installment') {
      if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 400 })
      const totalDays = Math.max(1, Math.min(365, Math.round(Number(days) || DEFAULT_INSTALLMENT_DAYS)))

      const { data: claim } = await supabase
        .from('community_pool_claims')
        .select('*')
        .eq('id', claim_id)
        .single()
      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      if (claim.status !== 'pending') {
        return NextResponse.json({ error: 'Claim already reviewed' }, { status: 400 })
      }

      const { data: status } = await supabase
        .from('user_community_status')
        .select('is_admin_set')
        .eq('user_id', claim.user_id)
        .single()

      // 立即升级（自然用户），admin-set 用户等级不动 —— 与 approve_maintenance 一致
      const nextLevel = claim.level + 1
      const statusUpdate: Record<string, unknown> = { updated_at: now }
      if (!status?.is_admin_set) {
        statusUpdate.current_level = nextLevel
        statusUpdate.real_level = nextLevel
      }
      await supabase.from('user_community_status').update(statusUpdate).eq('user_id', claim.user_id)

      // claim 转 installment，钱不动，由每日任务按天放行
      await supabase
        .from('community_pool_claims')
        .update({
          status: 'installment',
          installment_total_days: totalDays,
          installment_days_done: 0,
          installment_released: 0,
          installment_last_date: null,
          installment_started_at: now,
          reviewed_by: 'admin',
          reviewed_at: now,
        })
        .eq('id', claim_id)

      const perDay = Math.round((Number(claim.amount) / totalDays) * 1e6) / 1e6
      return NextResponse.json({
        success: true,
        message: `已进入分期发放：$${Number(claim.amount)} 分 ${totalDays} 天，每天约 $${perDay} 到账`,
      })
    }

    // ===== 维持中的 claim：管理员手动立即放行（含已暂停的）=====
    if (action === 'release_maintenance') {
      if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 400 })
      const { data: claim } = await supabase
        .from('community_pool_claims')
        .select('*')
        .eq('id', claim_id)
        .single()
      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      if (claim.status !== 'maintenance' && claim.status !== 'maintenance_paused') {
        return NextResponse.json({ error: 'Claim not in maintenance' }, { status: 400 })
      }
      await releaseMaintenanceClaim(supabase, claim)
      return NextResponse.json({ success: true, message: `已立即放行：$${Number(claim.amount)} 已入账` })
    }

    // ===== 维持期倒计时：管理员手动暂停 / 恢复（冻结天数，不清零）=====
    if (action === 'pause_maintenance' || action === 'resume_maintenance') {
      if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 400 })
      const targetFrom = action === 'pause_maintenance' ? 'maintenance' : 'maintenance_paused'
      const targetTo = action === 'pause_maintenance' ? 'maintenance_paused' : 'maintenance'
      const { data: updated, error: upErr } = await supabase
        .from('community_pool_claims')
        .update({ status: targetTo })
        .eq('id', claim_id)
        .eq('status', targetFrom) // 乐观：状态被别处改过则不匹配
        .select('id')
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
      if (!updated || updated.length === 0) {
        return NextResponse.json({ error: action === 'pause_maintenance' ? '该 claim 不在维持中' : '该 claim 未处于暂停' }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: action === 'pause_maintenance' ? '已暂停维持倒计时（天数冻结）' : '已恢复维持倒计时' })
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
