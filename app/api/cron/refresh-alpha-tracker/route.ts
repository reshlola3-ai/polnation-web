import { NextRequest, NextResponse } from 'next/server'
import { runRefreshJob } from '@/lib/alpha-tracker/refresh-job'

// The job serializes ~30 entities through Arkham's 1 req/s /transfers throttle
// (~33s floor) plus token-market lookups, so 60s is too tight. 300s is the Pro
// ceiling and leaves comfortable headroom.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runRefreshJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[alpha cron]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
