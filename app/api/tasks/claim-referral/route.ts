import { NextResponse } from 'next/server'

// 推荐奖励活动已下线（2026-07-24）：停止领取。
// 原"领取 pending 推荐奖励 → 计入 total_task_bonus"的逻辑见本次改动前的 git 版本；
// 如需恢复，回滚本次提交并重建 profiles 上的 trigger_create_referral_task_bonus 触发器。
export async function POST() {
  return NextResponse.json(
    { error: 'This activity has ended', ended: true },
    { status: 410 },
  )
}
