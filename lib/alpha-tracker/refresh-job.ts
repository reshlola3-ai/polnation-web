import { createClient } from '@supabase/supabase-js'
import {
  getTransfers,
  getEntity30dPnl,
  getTokenMarket,
} from './arkham-client'
import {
  detectPreCex,
  detectBridgeBuy,
  detectLpPosition,
  detectStableRotation,
  detectConvergence,
  detectDcaDump,
  detectPreGovernance,
  detectNetAccumulation,
} from './patterns/index'
import { computeConfidence } from './scoring'
import { buildWhatText, buildMeaningText } from './interpret'
import type { AlphaSignal, AlphaEntity, PatternMatch } from './types'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

const MIN_CONFIDENCE = 50
// Cap how many entities refresh their 30d track-record per run. Each refresh is
// 2 portfolio snapshot calls; refreshing all 30 in one run blows past the 60s
// function limit. Stalest entities go first, so over a few daily runs every
// entity gets refreshed on a rolling ~weekly cadence (fine for a 30d metric).
const PNL_REFRESH_PER_RUN = 5

export async function runRefreshJob(): Promise<{ processed: number; signalsInserted: number }> {
  const supabase = getSupabaseAdmin()

  const { data: entities, error: entitiesErr } = await supabase
    .from('alpha_entities')
    .select('*')
    .eq('is_active', true)
    .order('last_refreshed_at', { ascending: true, nullsFirst: true })

  if (entitiesErr || !entities?.length) {
    console.error('[alpha] Failed to load entities:', entitiesErr)
    return { processed: 0, signalsInserted: 0 }
  }

  const { data: recentSignals } = await supabase
    .from('alpha_signals')
    .select('*')
    .gt('observed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const recent: AlphaSignal[] = recentSignals ?? []

  const knownTxSet = new Set<string>(
    recent.flatMap((r) => r.tx_hashes)
  )

  let signalsInserted = 0
  const pnlBudget = { remaining: PNL_REFRESH_PER_RUN }
  const marketCache = new Map<string, { volume24h?: number; priceChange24h?: number }>()

  for (const entity of entities as AlphaEntity[]) {
    try {
      const n = await processEntity(entity, recent, knownTxSet, supabase, pnlBudget, marketCache)
      signalsInserted += n
    } catch (err) {
      console.error(`[alpha] Error processing ${entity.entity_id}:`, err)
    }
  }

  return { processed: entities.length, signalsInserted }
}

async function processEntity(
  entity: AlphaEntity,
  recentSignals: AlphaSignal[],
  knownTxSet: Set<string>,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pnlBudget: { remaining: number },
  marketCache: Map<string, { volume24h?: number; priceChange24h?: number }>
): Promise<number> {
  const transfersRes = await getTransfers(entity.entity_id, {
    timeLast: '24h',
    usdGte: '50000',
    limit: 100,
  })

  // Refresh 30d track-record (net-worth change) once per 24h — independent of
  // recent transfer activity, so quiet entities still get a real score instead
  // of being stuck at 0.
  let pnl30d = entity.pnl_30d
  if (shouldRefreshPnl(entity) && pnlBudget.remaining > 0) {
    pnlBudget.remaining--
    pnl30d = await getEntity30dPnl(entity.entity_id).catch(() => entity.pnl_30d)
    await supabase.from('alpha_entities').update({
      pnl_30d: pnl30d,
      last_refreshed_at: new Date().toISOString(),
    }).eq('entity_id', entity.entity_id)
  }

  const transfers = transfersRes.transfers ?? []
  if (!transfers.length) return 0

  // Token market data for pattern scoring (cheap endpoint). Cached per run so a
  // token touched by many entities (ETH, USDC, …) is only fetched once.
  const tokenSymbols = [...new Set(transfers.map(t => t.tokenSymbol).filter(Boolean))]
  const tokenVolumes: Record<string, number> = {}
  const tokenPriceChanges: Record<string, number> = {}

  await Promise.allSettled(
    tokenSymbols.slice(0, 10).map(async sym => {
      try {
        const key = sym!.toLowerCase()
        let market = marketCache.get(key)
        if (!market) {
          market = await getTokenMarket(key)
          marketCache.set(key, market)
        }
        if (market.volume24h)              tokenVolumes[sym!]      = market.volume24h
        if (market.priceChange24h != null) tokenPriceChanges[sym!] = market.priceChange24h
      } catch { /* non-fatal */ }
    })
  )

  const matches: PatternMatch[] = [
    detectPreCex(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers, tokenVolumes),
    detectBridgeBuy(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers),
    detectLpPosition(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers),
    detectStableRotation(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers),
    detectDcaDump(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers, tokenPriceChanges),
    detectPreGovernance(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers),
    detectNetAccumulation(entity.entity_id, entity.display_name, entity.entity_type, pnl30d, transfers, tokenVolumes, tokenPriceChanges),
  ].filter((m): m is PatternMatch => m !== null)

  let inserted = 0

  for (const match of matches) {
    if (match.txHashes.some(h => knownTxSet.has(h))) continue

    const { score, breakdown } = computeConfidence(match)
    if (score < MIN_CONFIDENCE) continue

    const { data: row } = await supabase.from('alpha_signals').insert({
      entity_id:            entity.entity_id,
      entity_name:          match.entityName,
      pattern_id:           match.patternId,
      confidence:           score,
      confidence_breakdown: breakdown,
      tx_hashes:            match.txHashes,
      chain:                match.chain,
      token_symbol:         match.tokenSymbol,
      token_address:        match.tokenAddress ?? null,
      amount_usd:           match.amountUsd,
      what_text:            buildWhatText(match),
      meaning_text:         buildMeaningText(match),
    }).select('id, tx_hashes').single()

    if (!row) continue
    inserted++
    match.txHashes.forEach(h => knownTxSet.add(h))

    const convergence = detectConvergence(
      { tokenSymbol: match.tokenSymbol, entityName: match.entityName, amountUsd: match.amountUsd, chain: match.chain },
      recentSignals
    )
    if (convergence) {
      const conv = computeConfidence(convergence)
      if (conv.score >= MIN_CONFIDENCE) {
        await supabase.from('alpha_signals').insert({
          entity_id:            entity.entity_id,
          entity_name:          convergence.entityName,
          pattern_id:           convergence.patternId,
          confidence:           conv.score,
          confidence_breakdown: conv.breakdown,
          tx_hashes:            convergence.txHashes,
          chain:                convergence.chain,
          token_symbol:         convergence.tokenSymbol,
          amount_usd:           convergence.amountUsd,
          what_text:            buildWhatText(convergence),
          meaning_text:         buildMeaningText(convergence),
        })
        inserted++
      }
    }
  }

  return inserted
}

function shouldRefreshPnl(entity: AlphaEntity): boolean {
  if (!entity.last_refreshed_at) return true
  const age = Date.now() - new Date(entity.last_refreshed_at).getTime()
  return age > 24 * 60 * 60 * 1000
}
