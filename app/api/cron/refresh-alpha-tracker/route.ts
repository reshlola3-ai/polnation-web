import { NextRequest, NextResponse } from 'next/server'
import { runRefreshJob } from '@/lib/alpha-tracker/refresh-job'

// Keep at 60s — the Hobby ceiling — so the build never fails on a capped plan.
// The job itself self-limits to a time budget (see runRefreshJob) and returns
// gracefully before this, so it never hits FUNCTION_INVOCATION_TIMEOUT.
export const maxDuration = 60

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
