import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// 每日分享返奖联系管理员的 Telegram handle
const SUPPORT_HANDLE = 'polnationsupport'

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

// POST: 晒中奖分享返奖 —— 已改为人工审核。
// 不再自动发放抽奖次数(此前无任何分享校验,可被白嫖)。用户需联系管理员
// @polnationsupport 申请,由管理员核实后在后台手动发放。
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    granted: false,
    requires_review: true,
    contact_handle: SUPPORT_HANDLE,
  })
}
