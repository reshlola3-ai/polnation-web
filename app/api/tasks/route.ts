import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Quest chapter definitions (order matters for unlock logic)
const QUEST_CHAPTERS = ['ch1', 'ch2', 'ch3']

// GET: fetch tasks grouped by quest chapters with unlock state
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // Parallel fetch: task types, user tasks, progress, today's checkin, referral count
    const today = new Date().toISOString().split('T')[0]

    const [
      { data: taskTypes },
      { data: userTasks },
      { data: taskProgress },
      { data: todayCheckin },
      { data: referralBonuses },
      { data: profile },
    ] = await Promise.all([
      supabaseAdmin.from('task_types').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('user_tasks').select('*').eq('user_id', user.id),
      supabaseAdmin.from('user_task_progress').select('*').eq('user_id', user.id).single(),
      supabaseAdmin.from('user_checkins').select('*').eq('user_id', user.id).eq('checkin_date', today).single(),
      supabaseAdmin.from('referral_task_bonus').select('*').eq('user_id', user.id),
      supabaseAdmin.from('profiles').select('wallet_address, referral_code').eq('id', user.id).single(),
    ])

    // Count confirmed referrals (pending or claimed both count as invited)
    const referralCount = (referralBonuses || []).length

    // Build task completion map: task_type_id -> records
    const taskMap: Record<string, typeof userTasks> = {}
    for (const ut of userTasks || []) {
      if (!taskMap[ut.task_type_id]) taskMap[ut.task_type_id] = []
      taskMap[ut.task_type_id]!.push(ut)
    }

    // Helper: is a specific task completed?
    const isTaskCompleted = (taskTypeId: string) => {
      const records = taskMap[taskTypeId] || []
      return records.some(r => r.status === 'completed' || r.status === 'approved')
    }

    // Build quest chapter completion map first (needed for chapter unlock logic)
    const chapterTaskMap: Record<string, typeof taskTypes> = {}
    for (const tt of taskTypes || []) {
      if (!tt.quest_group) continue
      if (!chapterTaskMap[tt.quest_group]) chapterTaskMap[tt.quest_group] = []
      chapterTaskMap[tt.quest_group]!.push(tt)
    }

    const isChapterComplete = (group: string) => {
      const chTasks = chapterTaskMap[group] || []
      return chTasks.length > 0 && chTasks.every(t => isTaskCompleted(t.id))
    }

    // Compute per-task state
    const tasks = (taskTypes || []).map(task => {
      const allRecords = taskMap[task.id] || []
      const completedRecords = allRecords.filter(r => r.status === 'completed' || r.status === 'approved')
      const pendingRecords = allRecords.filter(r => r.status === 'pending')

      // Determine if task is completed
      const isCompleted = completedRecords.length > 0
      const isPending = pendingRecords.length > 0

      // Determine unlock state for quest tasks
      // Within a chapter: ALL tasks are parallel (no step ordering required)
      // Cross-chapter: ch2 requires ch1 complete; ch3 requires ch2 complete
      let isUnlocked = true
      if (task.quest_group === 'ch2') {
        isUnlocked = isChapterComplete('ch1')
      } else if (task.quest_group === 'ch3') {
        isUnlocked = isChapterComplete('ch2')
      }

      // Can complete logic
      let canComplete = isUnlocked && !isCompleted

      if (!task.is_repeatable && isCompleted) {
        canComplete = false
      } else if (task.is_repeatable && task.repeat_interval_hours && completedRecords.length > 0) {
        const lastTime = new Date(completedRecords[completedRecords.length - 1].completed_at).getTime()
        canComplete = (Date.now() - lastTime) / 3600000 >= task.repeat_interval_hours
      }

      // admin_review: block if pending submission exists
      if (task.verification_type === 'admin_review' && isPending) {
        canComplete = false
      }

      // checkin special
      if (task.task_key === 'daily_checkin') {
        canComplete = !todayCheckin
        isUnlocked = true
      }

      // referral_check: check actual referral count
      let referralProgress = 0
      let referralTarget = 0
      if (task.verification_type === 'referral_check') {
        referralTarget = task.requires_referral_count || 0
        referralProgress = Math.min(referralCount, referralTarget)
        if (!isCompleted) {
          canComplete = isUnlocked && referralCount >= referralTarget
        }
      }

      // wallet_check: check wallet_address
      if (task.verification_type === 'wallet_check') {
        const hasWallet = !!profile?.wallet_address
        if (!isCompleted) {
          canComplete = isUnlocked && hasWallet
        }
      }

      return {
        ...task,
        completed_count: completedRecords.length,
        pending_count: pendingRecords.length,
        pending_submissions: pendingRecords.map(pt => ({
          id: pt.id,
          submitted_url: pt.submitted_url,
          submitted_content: pt.submitted_content,
          created_at: pt.created_at,
          status: pt.status,
        })),
        last_completed: completedRecords.length > 0 ? completedRecords[completedRecords.length - 1].completed_at : null,
        can_complete: canComplete,
        is_unlocked: isUnlocked,
        is_completed: isCompleted,
        is_pending: isPending,
        referral_progress: referralProgress,
        referral_target: referralTarget,
      }
    })

    // Build chapter summaries
    const chapters = QUEST_CHAPTERS.map((group, idx) => {
      const groupTasks = tasks.filter(t => t.quest_group === group).sort((a, b) => a.quest_step - b.quest_step)
      const completedCount = groupTasks.filter(t => t.is_completed).length
      const isComplete = groupTasks.length > 0 && completedCount === groupTasks.length

      // Chapter is accessible if previous chapter complete (or ch1 always accessible)
      let isAccessible = true
      if (idx > 0) {
        const prevGroup = QUEST_CHAPTERS[idx - 1]
        isAccessible = isChapterComplete(prevGroup!)
      }

      return {
        group,
        index: idx + 1,
        tasks: groupTasks,
        total: groupTasks.length,
        completed: completedCount,
        is_complete: isComplete,
        is_accessible: isAccessible,
      }
    })

    // Separate non-quest tasks (checkin, social without quest_group)
    const standaloneTask = tasks.find(t => t.task_key === 'daily_checkin')

    // Referral bonus
    const pendingReferralBonus = (referralBonuses || [])
      .filter(rb => rb.status === 'pending')
      .reduce((sum, rb) => sum + Number(rb.bonus_amount), 0)
    const claimedReferralBonus = (referralBonuses || [])
      .filter(rb => rb.status === 'claimed')
      .reduce((sum, rb) => sum + Number(rb.bonus_amount), 0)

    // Bonus breakdown
    const completedUserTasks = (userTasks || []).filter(ut => ut.status === 'completed' || ut.status === 'approved')
    const bonusBreakdown: Record<string, number> = {}
    for (const ut of completedUserTasks) {
      const taskType = (taskTypes || []).find(tt => tt.id === ut.task_type_id)
      if (taskType) {
        const category = taskType.task_category
        const reward = ut.reward_usd || taskType.reward_usd || 0
        bonusBreakdown[category] = (bonusBreakdown[category] || 0) + reward
      }
    }
    bonusBreakdown['referral'] = claimedReferralBonus

    return NextResponse.json({
      tasks,
      chapters,
      checkin_task: standaloneTask || null,
      progress: taskProgress || { total_task_bonus: 0, current_streak: 0, total_checkins: 0 },
      today_checkin: !!todayCheckin,
      referral_count: referralCount,
      referral_bonus: {
        pending: pendingReferralBonus,
        claimed: claimedReferralBonus,
        count: (referralBonuses || []).filter(rb => rb.status === 'pending').length,
      },
      bonus_breakdown: bonusBreakdown,
      profile: {
        referral_code: profile?.referral_code || null,
        has_wallet: !!profile?.wallet_address,
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST: complete a task
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isWalletEmail(user.email)) {
    return NextResponse.json({
      error: 'Email verification required to complete tasks',
      code: 'EMAIL_REQUIRED'
    }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { task_key, submitted_url, submitted_content } = await request.json()

    if (!task_key) {
      return NextResponse.json({ error: 'task_key required' }, { status: 400 })
    }

    const { data: taskType } = await supabaseAdmin
      .from('task_types')
      .select('*')
      .eq('task_key', task_key)
      .eq('is_active', true)
      .single()

    if (!taskType) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    // Check not already completed (non-repeatable)
    if (!taskType.is_repeatable) {
      const { data: existing } = await supabaseAdmin
        .from('user_tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_type_id', taskType.id)
        .in('status', ['completed', 'approved'])
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Task already completed' }, { status: 400 })
      }
    }

    // ── Special handlers ──────────────────────────────────────────────

    // Daily check-in
    if (taskType.task_key === 'daily_checkin') {
      return await handleCheckin(supabaseAdmin, user.id, taskType)
    }

    // Wallet check: auto-complete if wallet is connected
    if (taskType.verification_type === 'wallet_check') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('wallet_address')
        .eq('id', user.id)
        .single()

      if (!profile?.wallet_address) {
        return NextResponse.json({
          error: 'Please connect your wallet first',
          code: 'WALLET_REQUIRED',
        }, { status: 400 })
      }

      await supabaseAdmin.from('user_tasks').insert({
        user_id: user.id,
        task_type_id: taskType.id,
        status: 'completed',
        completed_at: now,
        verification_passed: true,
        verified_at: now,
        reward_usd: taskType.reward_usd,
        reward_credited: true,
        reward_credited_at: now,
      })
      await updateTaskProgress(supabaseAdmin, user.id, taskType.reward_usd)
      return NextResponse.json({
        success: true,
        reward: taskType.reward_usd,
        message: `Wallet verified! +$${taskType.reward_usd}`,
      })
    }

    // Auto-complete (copy_referral_link)
    if (taskType.verification_type === 'auto') {
      await supabaseAdmin.from('user_tasks').insert({
        user_id: user.id,
        task_type_id: taskType.id,
        status: 'completed',
        completed_at: now,
        verification_passed: true,
        verified_at: now,
        reward_usd: taskType.reward_usd,
        reward_credited: true,
        reward_credited_at: now,
      })
      await updateTaskProgress(supabaseAdmin, user.id, taskType.reward_usd)
      return NextResponse.json({
        success: true,
        reward: taskType.reward_usd,
        message: `+$${taskType.reward_usd} reward credited!`,
      })
    }

    // Referral count check: auto-complete if threshold met
    if (taskType.verification_type === 'referral_check') {
      const requiredCount = taskType.requires_referral_count || 0
      const { data: referralBonuses } = await supabaseAdmin
        .from('referral_task_bonus')
        .select('id')
        .eq('user_id', user.id)

      const actualCount = (referralBonuses || []).length
      if (actualCount < requiredCount) {
        return NextResponse.json({
          error: `You need ${requiredCount} referrals. Current: ${actualCount}`,
          code: 'INSUFFICIENT_REFERRALS',
          required: requiredCount,
          current: actualCount,
        }, { status: 400 })
      }

      await supabaseAdmin.from('user_tasks').insert({
        user_id: user.id,
        task_type_id: taskType.id,
        status: 'completed',
        completed_at: now,
        verification_passed: true,
        verified_at: now,
        reward_usd: taskType.reward_usd,
        reward_credited: true,
        reward_credited_at: now,
      })
      await updateTaskProgress(supabaseAdmin, user.id, taskType.reward_usd)
      return NextResponse.json({
        success: true,
        reward: taskType.reward_usd,
        message: `Referral milestone reached! +$${taskType.reward_usd}`,
      })
    }

    // Profile check
    if (taskType.verification_type === 'profile_check') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('username, country_code, profile_completed')
        .eq('id', user.id)
        .single()

      if (!profile?.username || !profile?.country_code) {
        return NextResponse.json({
          error: 'Please complete your profile first (set username and country)',
          redirect: '/profile',
          verification_failed: true
        }, { status: 400 })
      }
    }

    // Link check (promotion)
    if (taskType.verification_type === 'link_check') {
      if (!submitted_url) {
        return NextResponse.json({ error: 'URL required for promotion task' }, { status: 400 })
      }
      const hasKeyword = await checkUrlForKeyword(submitted_url, taskType.required_keyword)
      if (!hasKeyword) {
        return NextResponse.json({
          error: `Link must contain "${taskType.required_keyword}"`,
          verification_failed: true
        }, { status: 400 })
      }
    }

    // Admin review tasks (community_group, video)
    const needsReview = taskType.verification_type === 'admin_review' || taskType.verification_type === 'manual'

    if (needsReview) {
      const { data: pendingSubmission } = await supabaseAdmin
        .from('user_tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_type_id', taskType.id)
        .eq('status', 'pending')
        .single()

      if (pendingSubmission) {
        return NextResponse.json({ error: 'You already have a pending submission for this task' }, { status: 400 })
      }

      // For group tasks, submitted_content is used (not URL)
      if (task_key.startsWith('community_group_') && !submitted_content && !submitted_url) {
        return NextResponse.json({ error: 'Contact info required' }, { status: 400 })
      }

      // For video tasks, URL is required
      if (task_key === 'video_review' && !submitted_url) {
        return NextResponse.json({ error: 'URL required for this task' }, { status: 400 })
      }
    }

    // Create task record
    const { data: newTask, error: insertError } = await supabaseAdmin
      .from('user_tasks')
      .insert({
        user_id: user.id,
        task_type_id: taskType.id,
        status: needsReview ? 'pending' : 'completed',
        completed_at: needsReview ? null : now,
        submitted_url,
        submitted_content,
        verification_passed: !needsReview,
        verified_at: !needsReview ? now : null,
        reward_usd: taskType.reward_usd,
        reward_credited: !needsReview,
        reward_credited_at: !needsReview ? now : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
    }

    if (!needsReview) {
      await updateTaskProgress(supabaseAdmin, user.id, taskType.reward_usd)
    }

    return NextResponse.json({
      success: true,
      task: newTask,
      reward: taskType.reward_usd,
      message: needsReview
        ? 'Submitted for admin review. Please contact admin on Telegram to verify.'
        : `Task completed! +$${taskType.reward_usd}`,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
  }
}

// ── Checkin handler ──────────────────────────────────────────────────
const CHECKIN_REWARDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1.0]

async function handleCheckin(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  taskType: { id: string; reward_usd: number }
) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]

  const { data: todayCheckin } = await supabaseAdmin
    .from('user_checkins').select('id').eq('user_id', userId).eq('checkin_date', today).single()

  if (todayCheckin) {
    return NextResponse.json({ error: 'Already checked in today' }, { status: 400 })
  }

  const { data: existingProgress } = await supabaseAdmin
    .from('user_task_progress').select('*').eq('user_id', userId).single()

  let newStreak = 1
  if (existingProgress?.last_checkin_date) {
    if (String(existingProgress.last_checkin_date) === yesterday) {
      newStreak = (existingProgress.current_streak || 0) + 1
    }
  }

  const streakDay = Math.min(newStreak, 7)
  const dailyReward = CHECKIN_REWARDS[streakDay - 1] || 0.1
  const isStreakComplete = newStreak >= 7
  const finalStreak = isStreakComplete ? 0 : newStreak

  const { error: checkinError } = await supabaseAdmin.from('user_checkins').insert({
    user_id: userId,
    checkin_date: today,
    streak_count: newStreak,
    bonus_earned: isStreakComplete,
    bonus_amount: dailyReward,
  })

  if (checkinError) {
    return NextResponse.json({ error: 'Failed to create checkin record' }, { status: 500 })
  }

  await supabaseAdmin.from('user_tasks').insert({
    user_id: userId,
    task_type_id: taskType.id,
    status: 'completed',
    completed_at: now.toISOString(),
    verification_passed: true,
    verified_at: now.toISOString(),
    reward_usd: dailyReward,
    reward_credited: true,
    reward_credited_at: now.toISOString(),
  })

  if (existingProgress?.id) {
    await supabaseAdmin.from('user_task_progress').update({
      current_streak: finalStreak,
      last_checkin_date: today,
      total_checkins: (Number(existingProgress.total_checkins) || 0) + 1,
      total_task_bonus: (Number(existingProgress.total_task_bonus) || 0) + dailyReward,
      updated_at: now.toISOString(),
    }).eq('user_id', userId)
  } else {
    await supabaseAdmin.from('user_task_progress').insert({
      user_id: userId,
      current_streak: finalStreak,
      last_checkin_date: today,
      total_checkins: 1,
      total_task_bonus: dailyReward,
    })
  }

  return NextResponse.json({
    success: true,
    streak: finalStreak,
    reward: dailyReward,
    total_reward: dailyReward,
    message: isStreakComplete
      ? `🎉 7-day streak complete! +$${dailyReward}. Streak reset!`
      : `Check-in Day ${newStreak}/7. +$${dailyReward}`,
  })
}

// ── Update progress ─────────────────────────────────────────────────
async function updateTaskProgress(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  rewardAmount: number
) {
  if (!supabaseAdmin) return
  const { data: progress } = await supabaseAdmin
    .from('user_task_progress').select('*').eq('user_id', userId).single()

  if (progress) {
    await supabaseAdmin.from('user_task_progress').update({
      total_task_bonus: (progress.total_task_bonus || 0) + rewardAmount,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  } else {
    await supabaseAdmin.from('user_task_progress').insert({
      user_id: userId,
      total_task_bonus: rewardAmount,
    })
  }
}

// ── URL keyword check ───────────────────────────────────────────────
async function checkUrlForKeyword(url: string, keyword: string | null): Promise<boolean> {
  if (!keyword) return true
  if (url.toLowerCase().includes(keyword.toLowerCase())) return true
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolnationBot/1.0)' },
    })
    clearTimeout(timeout)
    if (response.ok) {
      const text = await response.text()
      return text.toLowerCase().includes(keyword.toLowerCase())
    }
  } catch { /* ignore */ }
  return false
}
