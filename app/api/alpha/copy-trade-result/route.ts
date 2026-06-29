import { NextRequest, NextResponse } from 'next/server'
import { resolveCopyTradeForSignal } from '@/lib/alpha-copy-trade'
import type { PatternId } from '@/lib/alpha-tracker/types'

// Real-time: HL order flow changes every second; never cache this route.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PATTERN_IDS = new Set<PatternId>([
  'pre_cex',
  'bridge_buy',
  'lp_position',
  'stable_rotation',
  'convergence',
  'dca_dump',
  'pre_gov',
  'net_accumulation',
])

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  const entityName = searchParams.get('entity_name')
  const tokenSymbol = searchParams.get('token_symbol')
  const patternId = searchParams.get('pattern_id') as PatternId | null
  const observedAt = searchParams.get('observed_at')
  const amountUsdRaw = searchParams.get('amount_usd')

  if (!id || !entityName || !patternId || !observedAt || !PATTERN_IDS.has(patternId)) {
    return NextResponse.json({ error: 'Invalid signal parameters' }, { status: 400 })
  }

  const amount_usd = amountUsdRaw ? Number(amountUsdRaw) : null

  try {
    const result = await resolveCopyTradeForSignal({
      id,
      entity_name: entityName,
      token_symbol: tokenSymbol,
      amount_usd: Number.isFinite(amount_usd) ? amount_usd : null,
      pattern_id: patternId,
      observed_at: observedAt,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[copy-trade-result]', err)
    return NextResponse.json({ error: 'Failed to build copy trade result' }, { status: 500 })
  }
}
