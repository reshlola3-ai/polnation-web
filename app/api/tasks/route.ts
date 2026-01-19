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

// Check if email is a wallet-generated placeholder
function isWalletEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return email.endsWith('@wallet.polnation.com')
}

// GET: 获取任务列表和用户完成状态
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has verified email (not wallet placeholder)
  if (isWalletEmail(user.email)) {
    return NextResponse.json({ 
      error: 'Email verification required to access tasks',
      code: 'EMAIL_REQUIRED'
    }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取所有活跃任务
    const { data: taskTypes } = await supabaseAdmin
      .from('task_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    // 获取用户完成的任务
    const { data: userTasks } = await supabaseAdmin
      .from('user_tasks')
      .select('*')
      .eq('user_id', user.id)

    // 获取用户签到信息
    const { data: taskProgress } = await supabaseAdmin
      .from('user_task_progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 获取今天的签到记录
    const today = new Date().toISOString().split('T')[0]
    const { data: todayCheckin } = await supabaseAdmin
      .from('user_checkins')
      .select('*')
      .eq('user_id', user.id)
      .eq('checkin_date', today)
      .single()

    // 构建任务状态
    const tasks = (taskTypes || []).map(task => {
      const completedTasks = (userTasks || []).filter(
        ut => ut.task_type_id === task.id && ut.status === 'completed'
      )
      
      let canComplete = true
      let lastCompleted = null

      if (completedTasks.length > 0) {
        lastCompleted = completedTasks[completedTasks.length - 1].completed_at

        if (!task.is_repeatable) {
          canComplete = false
        } else if (task.repeat_interval_hours) {
          const lastTime = new Date(lastCompleted).getTime()
          const now = Date.now()
          const hoursPassed = (now - lastTime) / (1000 * 60 * 60)
          canComplete = hoursPassed >= task.repeat_interval_hours
        }
      }

      // 签到任务特殊处理
      if (task.task_key === 'daily_checkin') {
        canComplete = !todayCheckin
      }

      return {
        ...task,
        completed_count: completedTasks.length,
        last_completed: lastCompleted,
        can_complete: canComplete,
      }
    })

    return NextResponse.json({
      tasks,
      progress: taskProgress || { total_task_bonus: 0, current_streak: 0, total_checkins: 0 },
      today_checkin: !!todayCheckin,
      current_streak: taskProgress?.current_streak || 0,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST: 完成任务
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has verified email (not wallet placeholder)
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
    const { task_key, submitted_url } = await request.json()

    if (!task_key) {
      return NextResponse.json({ error: 'task_key required' }, { status: 400 })
    }

    // 获取任务类型
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

    // 检查是否可以完成
    if (!taskType.is_repeatable) {
      const { data: existing } = await supabaseAdmin
        .from('user_tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_type_id', taskType.id)
        .eq('status', 'completed')
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Task already completed' }, { status: 400 })
      }
    }

    // 签到任务特殊处理
    if (taskType.task_key === 'daily_checkin') {
      return await handleCheckin(supabaseAdmin, user.id, taskType)
    }

    // Promotion任务：验证链接
    if (taskType.verification_type === 'link_check') {
      if (!submitted_url) {
        return NextResponse.json({ error: 'URL required for promotion task' }, { status: 400 })
      }

      // 检查链接是否包含关键词
      const hasKeyword = await checkUrlForKeyword(submitted_url, taskType.required_keyword)
      
      if (!hasKeyword) {
        return NextResponse.json({ 
          error: `Link must contain "${taskType.required_keyword}"`,
          verification_failed: true 
        }, { status: 400 })
      }
    }

    // 创建任务记录
    const { data: newTask, error: insertError } = await supabaseAdmin
      .from('user_tasks')
      .insert({
        user_id: user.id,
        task_type_id: taskType.id,
        status: taskType.verification_type === 'manual' ? 'pending' : 'completed',
        completed_at: taskType.verification_type === 'manual' ? null : now,
        submitted_url,
        verification_passed: taskType.verification_type !== 'manual',
        verified_at: taskType.verification_type !== 'manual' ? now : null,
        reward_usd: taskType.reward_usd,
        reward_credited: taskType.verification_type !== 'manual',
        reward_credited_at: taskType.verification_type !== 'manual' ? now : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
    }

    // 如果任务立即完成，更新任务进度
    if (taskType.verification_type !== 'manual') {
      await updateTaskProgress(supabaseAdmin, user.id, taskType.reward_usd)
    }

    return NextResponse.json({
      success: true,
      task: newTask,
      reward: taskType.reward_usd,
      message: taskType.verification_type === 'manual' 
        ? 'Task submitted for review' 
        : `Task completed! +$${taskType.reward_usd} unlock progress`,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
  }
}

// 签到处理
async function handleCheckin(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, userId: string, taskType: { id: string; reward_usd: number }) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  console.log('=== CHECKIN START ===')
  console.log('User ID:', userId)
  console.log('Task Type:', taskType)

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  console.log('Today:', today)
  console.log('Yesterday:', yesterday)

  // 检查今天是否已签到
  const { data: todayCheckin, error: checkinCheckError } = await supabaseAdmin
    .from('user_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('checkin_date', today)
    .single()

  console.log('Today checkin check:', { todayCheckin, error: checkinCheckError })

  if (todayCheckin) {
    return NextResponse.json({ error: 'Already checked in today' }, { status: 400 })
  }

  // 获取当前进度
  const { data: existingProgress, error: progressError } = await supabaseAdmin
    .from('user_task_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  console.log('Existing progress:', { existingProgress, error: progressError })

  // 计算连续签到天数
  let newStreak = 1
  if (existingProgress?.last_checkin_date) {
    const lastDate = String(existingProgress.last_checkin_date)
    console.log('Last checkin date:', lastDate, 'Yesterday:', yesterday, 'Match:', lastDate === yesterday)
    if (lastDate === yesterday) {
      newStreak = (existingProgress.current_streak || 0) + 1
    }
  }
  console.log('New streak:', newStreak)

  // 检查是否达成7天连续签到
  let bonusAmount = 0
  let bonusEarned = false
  if (newStreak === 7) {
    bonusAmount = 1.0
    bonusEarned = true
  }

  const totalReward = taskType.reward_usd + bonusAmount
  const finalStreak = bonusEarned ? 0 : newStreak

  console.log('Total reward:', totalReward, 'Final streak:', finalStreak)

  // 创建签到记录
  const { data: checkinData, error: checkinError } = await supabaseAdmin
    .from('user_checkins')
    .insert({
      user_id: userId,
      checkin_date: today,
      streak_count: newStreak,
      bonus_earned: bonusEarned,
      bonus_amount: bonusEarned ? bonusAmount : null,
    })
    .select()
    .single()

  console.log('Checkin insert result:', { data: checkinData, error: checkinError })

  if (checkinError) {
    console.error('Checkin insert error:', checkinError)
    return NextResponse.json({ error: 'Failed to create checkin record' }, { status: 500 })
  }

  // 创建任务完成记录
  const { error: taskError } = await supabaseAdmin
    .from('user_tasks')
    .insert({
      user_id: userId,
      task_type_id: taskType.id,
      status: 'completed',
      completed_at: now.toISOString(),
      verification_passed: true,
      verified_at: now.toISOString(),
      reward_usd: totalReward,
      reward_credited: true,
      reward_credited_at: now.toISOString(),
    })

  console.log('Task insert error:', taskError)

  // 更新或创建进度记录
  if (existingProgress && existingProgress.id) {
    // 已有记录，更新
    const newTotalCheckins = (Number(existingProgress.total_checkins) || 0) + 1
    const newTotalBonus = (Number(existingProgress.total_task_bonus) || 0) + totalReward

    console.log('Updating progress:', { newTotalCheckins, newTotalBonus, finalStreak })

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('user_task_progress')
      .update({
        current_streak: finalStreak,
        last_checkin_date: today,
        total_checkins: newTotalCheckins,
        total_task_bonus: newTotalBonus,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single()

    console.log('Progress update result:', { data: updateData, error: updateError })

    if (updateError) {
      console.error('Progress update error:', updateError)
    }
  } else {
    // 新记录，插入
    console.log('Inserting new progress record')

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('user_task_progress')
      .insert({
        user_id: userId,
        current_streak: finalStreak,
        last_checkin_date: today,
        total_checkins: 1,
        total_task_bonus: totalReward,
      })
      .select()
      .single()

    console.log('Progress insert result:', { data: insertData, error: insertError })

    if (insertError) {
      console.error('Progress insert error:', insertError)
    }
  }

  console.log('=== CHECKIN END ===')

  return NextResponse.json({
    success: true,
    streak: finalStreak,
    reward: taskType.reward_usd,
    bonus: bonusEarned ? bonusAmount : 0,
    total_reward: totalReward,
    message: bonusEarned 
      ? `🎉 7-day streak! +$${totalReward} unlock progress (includes $1 bonus!)`
      : `Check-in successful! Day ${newStreak}/7. +$${taskType.reward_usd} unlock progress`,
  })
}

// 更新任务进度
async function updateTaskProgress(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, userId: string, rewardAmount: number) {
  if (!supabaseAdmin) return

  const { data: progress } = await supabaseAdmin
    .from('user_task_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (progress) {
    await supabaseAdmin
      .from('user_task_progress')
      .update({
        total_task_bonus: (progress.total_task_bonus || 0) + rewardAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  } else {
    await supabaseAdmin
      .from('user_task_progress')
      .insert({
        user_id: userId,
        total_task_bonus: rewardAmount,
      })
  }
}

// 检查URL是否包含关键词
async function checkUrlForKeyword(url: string, keyword: string | null): Promise<boolean> {
  if (!keyword) return true

  try {
    // 首先检查URL本身
    if (url.toLowerCase().includes(keyword.toLowerCase())) {
      return true
    }

    // 尝试获取页面内容检查
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PolnationBot/1.0)',
        },
      })
      clearTimeout(timeout)

      if (response.ok) {
        const text = await response.text()
        return text.toLowerCase().includes(keyword.toLowerCase())
      }
    } catch {
      // 如果无法获取内容，只检查URL
      clearTimeout(timeout)
    }

    return false
  } catch {
    return false
  }
}
