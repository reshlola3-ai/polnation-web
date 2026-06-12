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

async function getSupabaseUser() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { supabase: null, user: null }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

const IDENTITY_BUCKET = 'claim-identity'
const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Claim 奖励池 —— 审批制：提交后进入 pending，管理员批准后才发钱+升级。
// 首次 claim 需上传自拍照片 + 真名（之后复用）。
export async function POST(request: NextRequest) {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const form = await request.formData()
    const level = Number(form.get('level'))
    const realNameRaw = (form.get('real_name') as string | null)?.trim() || ''
    const photo = form.get('photo') as File | null

    if (!level || level < 1) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }

    // 检查用户邮箱是否绑定
    const userEmail = user.email || ''
    if (userEmail.endsWith('@wallet.polnation.com')) {
      return NextResponse.json({
        error: 'Please bind your email first to claim rewards'
      }, { status: 400 })
    }

    // 获取用户状态
    const { data: status } = await supabaseAdmin
      .from('user_community_status')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!status) {
      return NextResponse.json({ error: 'User status not found' }, { status: 404 })
    }

    // 账号被冻结 → 一律拦截，引导联系管理员
    if (status.claims_frozen) {
      return NextResponse.json({
        error: 'Your claims are under manual review. Please contact support.',
        frozen: true,
      }, { status: 403 })
    }

    // 查询已有 claim（含 pending / completed / rejected）
    const { data: priorClaims } = await supabaseAdmin
      .from('community_pool_claims')
      .select('level, status')
      .eq('user_id', user.id)

    const allClaims = priorClaims || []

    // 同一时间只允许一个 pending claim（等级要等批准后才升，无法排队下一档）
    if (allClaims.some(c => c.status === 'pending')) {
      return NextResponse.json({
        error: 'You already have a claim under review. Please wait for approval.',
        pending: true,
      }, { status: 400 })
    }

    const claimedLevels = allClaims.map(c => c.level as number)
    const highestClaimed = claimedLevels.length > 0 ? Math.max(...claimedLevels) : 0
    const nextUnclaimed = highestClaimed + 1

    if (claimedLevels.includes(level)) {
      return NextResponse.json({
        error: 'This level reward pool has already been claimed'
      }, { status: 400 })
    }

    if (status.is_admin_set) {
      // Admin-set 用户：必须按顺序领，且 real_level 必须追上 admin-set 等级
      if (level !== nextUnclaimed) {
        return NextResponse.json({
          error: `Must claim Level ${nextUnclaimed} next`
        }, { status: 400 })
      }

      const adminLockLevel = status.current_level || 0
      const realLevel = status.real_level || 0
      if (realLevel < adminLockLevel) {
        return NextResponse.json({
          error: `Locked: real level must reach Level ${adminLockLevel} to unlock claims`
        }, { status: 400 })
      }
    } else {
      // 自然用户：每次只能领当前等级
      const currentLevel = Math.max(1, status.current_level || 1)
      if (level !== currentLevel) {
        return NextResponse.json({
          error: 'Can only claim current level reward pool'
        }, { status: 400 })
      }
    }

    // 获取等级信息
    const { data: levelInfo } = await supabaseAdmin
      .from('community_levels')
      .select('*')
      .eq('level', level)
      .single()

    if (!levelInfo) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 })
    }

    // 计算有效解锁进度
    const teamVolume = status.team_volume_l123 || 0

    const { data: taskProgress } = await supabaseAdmin
      .from('user_task_progress')
      .select('total_task_bonus')
      .eq('user_id', user.id)
      .single()

    const taskBonus = taskProgress?.total_task_bonus || 0
    const effectiveVolume = teamVolume + taskBonus

    const unlockVolume = status.is_influencer
      ? levelInfo.unlock_volume_influencer
      : levelInfo.unlock_volume_normal

    if (effectiveVolume < unlockVolume) {
      return NextResponse.json({
        error: `Need $${unlockVolume - effectiveVolume} more progress to claim this reward`
      }, { status: 400 })
    }

    // ===== 身份验证：首次 claim 需提供真名 + 自拍，之后复用 =====
    const { data: identity } = await supabaseAdmin
      .from('user_identity')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (!identity) {
      // 首次：必须带真名 + 照片
      if (!realNameRaw || realNameRaw.length < 2) {
        return NextResponse.json({ error: 'Real name is required', need_identity: true }, { status: 400 })
      }
      if (!photo || typeof photo === 'string') {
        return NextResponse.json({ error: 'A photo of yourself is required', need_identity: true }, { status: 400 })
      }
      if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
        return NextResponse.json({ error: 'Photo must be JPG, PNG or WEBP', need_identity: true }, { status: 400 })
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: 'Photo too large (max 8MB)', need_identity: true }, { status: 400 })
      }

      const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const bytes = Buffer.from(await photo.arrayBuffer())

      const { error: uploadErr } = await supabaseAdmin
        .storage
        .from(IDENTITY_BUCKET)
        .upload(path, bytes, { contentType: photo.type, upsert: false })

      if (uploadErr) {
        console.error('Identity photo upload failed:', uploadErr)
        return NextResponse.json({ error: 'Failed to upload photo, please retry' }, { status: 500 })
      }

      const { error: identErr } = await supabaseAdmin
        .from('user_identity')
        .insert({ user_id: user.id, real_name: realNameRaw, photo_path: path })

      if (identErr) {
        console.error('Identity insert failed:', identErr)
        return NextResponse.json({ error: 'Failed to save identity, please retry' }, { status: 500 })
      }
    }

    const claimAmount = levelInfo.reward_pool

    // 创建【待审批】领取记录 —— 不发钱、不升级，等管理员批准
    const { error: claimErr } = await supabaseAdmin
      .from('community_pool_claims')
      .insert({
        user_id: user.id,
        level,
        amount: claimAmount,
        claim_type: 'natural',
        status: 'pending',
        claimed_at: new Date().toISOString(),
      })

    if (claimErr) {
      console.error('Pending claim insert failed:', claimErr)
      return NextResponse.json({ error: 'Failed to submit claim, please retry' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      pending: true,
      claimed_level: level,
      claimed_amount: claimAmount,
      level_name: levelInfo.name,
      message: `🎉 Congratulations on reaching ${levelInfo.name}! Your $${claimAmount} reward is under review.`,
    })
  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
