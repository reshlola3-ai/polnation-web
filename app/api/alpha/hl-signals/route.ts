import { NextResponse } from 'next/server'
import { getHlSignals, summarize } from '@/lib/alpha-hl-signals'

// 每 15 分钟刷新一次（Next 路由段缓存），避免每个用户请求都打 HL API。
export const revalidate = 900

export async function GET() {
  try {
    const signals = await getHlSignals()
    return NextResponse.json(
      { signals, summary: summarize(signals) },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } },
    )
  } catch (err) {
    console.error('[alpha/hl-signals]', err)
    return NextResponse.json({ error: 'Failed to load signals' }, { status: 500 })
  }
}
