import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function checkAdminAuth() {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get('admin_session')?.value
  return !!adminSession
}

// GET: 获取所有待审核任务和任务配置
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'pending'

  try {
    if (action === 'config') {
      // 获取任务配置
      const { data: taskTypes } = await supabaseAdmin
        .from('task_types')
        .select('*')
        .order('sort_order')

      return NextResponse.json({ taskTypes })
    }

    if (action === 'stats') {
      // 获取任务统计
      const { data: pendingCount } = await supabaseAdmin
        .from('user_tasks')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')

      const { data: completedToday } = await supabaseAdmin
        .from('user_tasks')
        .select('id', { count: 'exact' })
        .eq('status', 'completed')
        .gte('completed_at', new Date().toISOString().split('T')[0])

      const { data: totalBonus } = await supabaseAdmin
        .from('user_task_progress')
        .select('total_task_bonus')

      const totalBonusSum = (totalBonus || []).reduce((sum, p) => sum + (p.total_task_bonus || 0), 0)

      return NextResponse.json({
        pending_count: pendingCount?.length || 0,
        completed_today: completedToday?.length || 0,
        total_bonus_distributed: totalBonusSum,
      })
    }

    // 获取待审核任务 (默认)
    const { data: pendingTasks } = await supabaseAdmin
      .from('user_tasks')
      .select(`
        *,
        task_types (
          task_key,
          name,
          reward_usd,
          task_category,
          verification_type
        ),
        profiles (
          email,
          username
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // 获取最近完成的任务
    const { data: recentTasks } = await supabaseAdmin
      .from('user_tasks')
      .select(`
        *,
        task_types (
          task_key,
          name,
          reward_usd,
          task_category,
          verification_type
        ),
        profiles (
          email,
          username
        )
      `)
      .in('status', ['completed', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      pending: pendingTasks || [],
      recent: recentTasks || [],
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

// POST: 审核任务 / 更新任务配置
export async function POST(request: NextRequest) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { action, task_id, status, note, task_type_id, updates, custom_amount } = body

    if (action === 'review') {
      // 审核任务
      if (!task_id || !status) {
        return NextResponse.json({ error: 'task_id and status required' }, { status: 400 })
      }

      if (!['completed', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      // 获取任务信息
      const { data: task } = await supabaseAdmin
        .from('user_tasks')
        .select('*, task_types(reward_usd, task_key)')
        .eq('id', task_id)
        .single()

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      const now = new Date().toISOString()

      // Determine reward amount (use custom_amount for video tasks if provided)
      let finalReward = task.task_types?.reward_usd || task.reward_usd || 0
      if (custom_amount && task.task_types?.task_key === 'video_review') {
        finalReward = custom_amount
      }

      // 更新任务状态
      await supabaseAdmin
        .from('user_tasks')
        .update({
          status,
          completed_at: status === 'completed' ? now : null,
          verification_passed: status === 'completed',
          verification_note: note || null,
          verified_at: now,
          reward_usd: finalReward,
          admin_reward_amount: custom_amount || null,
          reward_credited: status === 'completed',
          reward_credited_at: status === 'completed' ? now : null,
          updated_at: now,
        })
        .eq('id', task_id)

      // 如果通过，更新用户任务进度
      if (status === 'completed') {
        const { data: progress } = await supabaseAdmin
          .from('user_task_progress')
          .select('total_task_bonus')
          .eq('user_id', task.user_id)
          .single()

        await supabaseAdmin
          .from('user_task_progress')
          .upsert({
            user_id: task.user_id,
            total_task_bonus: (progress?.total_task_bonus || 0) + finalReward,
            updated_at: now,
          })
      }

      return NextResponse.json({
        success: true,
        message: status === 'completed' ? `Task approved (+$${finalReward})` : 'Task rejected',
      })
    }

    if (action === 'update_config') {
      // 更新任务配置
      if (!task_type_id || !updates) {
        return NextResponse.json({ error: 'task_type_id and updates required' }, { status: 400 })
      }

      await supabaseAdmin
        .from('task_types')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task_type_id)

      return NextResponse.json({ success: true, message: 'Config updated' })
    }

    if (action === 'toggle_active') {
      // 切换任务启用状态
      if (!task_type_id) {
        return NextResponse.json({ error: 'task_type_id required' }, { status: 400 })
      }

      const { data: current } = await supabaseAdmin
        .from('task_types')
        .select('is_active')
        .eq('id', task_type_id)
        .single()

      await supabaseAdmin
        .from('task_types')
        .update({
          is_active: !current?.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task_type_id)

      return NextResponse.json({
        success: true,
        message: current?.is_active ? 'Task disabled' : 'Task enabled',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
