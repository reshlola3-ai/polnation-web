import { createClient } from '@supabase/supabase-js'
import {
  getTransfers,
  getAddressIntel,
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
} from './patterns/index'
import { computeConfidence } from './scoring'
import { buildWhatText, buildMeaningText } from './interpret'
import type { AlphaSignal, AlphaWallet, PatternMatch } from './types'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

const MIN_CONFIDENCE = 50   // drop signals below this

export async function runRefreshJob(): Promise<{ processed: number; inserted: number }> {
  const supabase = getSupabaseAdmin()

  // 1. Load active wallets
  const { data: wallets, error: walletsErr } = await supabase
    .from('alpha_wallets')
    .select('*')
    .eq('is_active', true)

  if (walletsErr || !wallets?.length) {
    console.error('[alpha] Failed to load wallets:', walletsErr)
    return { processed: 0, inserted: 0 }
  }

  // 2. Load recent signals for convergence detection (last 4h)
  const { data: recentSignals } = await supabase
    .from('alpha_signals')
    .select('*')
    .gt('observed_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())

  const recent: AlphaSignal[] = recentSignals ?? []

  // 3. Load known tx_hashes to deduplicate
  const { data: knownTxRows } = await supabase
    .from('alpha_signals')
    .select('tx_hashes')
    .gt('observed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const knownTxSet = new Set<string>(
    (knownTxRows ?? []).flatMap((r: { tx_hashes: string[] }) => r.tx_hashes)
  )

  let inserted = 0

  for (const wallet of wallets as AlphaWallet[]) {
    try {
      await processWallet(wallet, recent, knownTxSet, supabase)
      inserted++
    } catch (err) {
      console.error(`[alpha] Error processing ${wallet.address}:`, err)
    }
  }

  return { processed: wallets.length, inserted }
}

async function processWallet(
  wallet: AlphaWallet,
  recentSignals: AlphaSignal[],
  knownTxSet: Set<string>,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  // Fetch transfers + entity intel in parallel (intel is cached 1hr on Arkham's side)
  const [transfersRes, intel] = await Promise.all([
    getTransfers(wallet.address, { timeLast: '6h', usdGte: '50000', limit: 100 }),
    getAddressIntel(wallet.address).catch(() => null),
  ])

  const transfers = transfersRes.transfers ?? []
  if (!transfers.length) return

  const entityName = intel?.arkhamEntity?.name
    ?? wallet.arkham_entity
    ?? wallet.address.slice(0, 8) + '…'
  const entityType = intel?.arkhamEntity?.type
    ?? wallet.entity_type
    ?? 'unknown'

  // Refresh 30d PnL if we have an entity name (do occasionally, not every run)
  let pnl30d = wallet.pnl_30d
  if (intel?.arkhamEntity?.id && shouldRefreshPnl(wallet)) {
    pnl30d = await getEntity30dPnl(intel.arkhamEntity.id).catch(() => wallet.pnl_30d)
    await supabase.from('alpha_wallets').update({
      pnl_30d: pnl30d,
      arkham_entity: entityName,
      entity_type: entityType,
      last_refreshed_at: new Date().toISOString(),
    }).eq('address', wallet.address)
  }

  // Collect token symbols for market data
  const tokenSymbols = [...new Set(transfers.map(t => t.tokenSymbol).filter(Boolean))]
  const tokenVolumes: Record<string, number> = {}
  const tokenPriceChanges: Record<string, number> = {}

  // Fetch market data for relevant tokens (standard endpoint, no throttle)
  await Promise.allSettled(
    tokenSymbols.slice(0, 10).map(async sym => {
      try {
        const market = await getTokenMarket(sym!.toLowerCase())
        if (market.volume24h)    tokenVolumes[sym!]      = market.volume24h
        if (market.priceChange24h != null) tokenPriceChanges[sym!] = market.priceChange24h
      } catch { /* non-fatal */ }
    })
  )

  // Run all pattern detectors
  const matches: PatternMatch[] = [
    detectPreCex(wallet.address, entityName, entityType, pnl30d, transfers, tokenVolumes),
    detectBridgeBuy(wallet.address, entityName, entityType, pnl30d, transfers),
    detectLpPosition(wallet.address, entityName, entityType, pnl30d, transfers),
    detectStableRotation(wallet.address, entityName, entityType, pnl30d, transfers),
    detectDcaDump(wallet.address, entityName, entityType, pnl30d, transfers, tokenPriceChanges),
    detectPreGovernance(wallet.address, entityName, entityType, pnl30d, transfers),
  ].filter((m): m is PatternMatch => m !== null)

  for (const match of matches) {
    // Skip if we've already seen these tx hashes
    if (match.txHashes.some(h => knownTxSet.has(h))) continue

    const { score, breakdown } = computeConfidence(match)
    if (score < MIN_CONFIDENCE) continue

    const what    = buildWhatText(match)
    const meaning = buildMeaningText(match)

    const { data: row } = await supabase.from('alpha_signals').insert({
      wallet_address:       wallet.address,
      entity_name:          match.entityName,
      pattern_id:           match.patternId,
      confidence:           score,
      confidence_breakdown: breakdown,
      tx_hashes:            match.txHashes,
      chain:                match.chain,
      token_symbol:         match.tokenSymbol,
      token_address:        match.tokenAddress ?? null,
      amount_usd:           match.amountUsd,
      what_text:            what,
      meaning_text:         meaning,
    }).select('id, tx_hashes').single()

    if (row) {
      match.txHashes.forEach(h => knownTxSet.add(h))

      // Check for convergence on this newly inserted signal
      const convergence = detectConvergence(
        { tokenSymbol: match.tokenSymbol, entityName: match.entityName, amountUsd: match.amountUsd, chain: match.chain },
        recentSignals
      )
      if (convergence) {
        const conv = computeConfidence(convergence)
        if (conv.score >= MIN_CONFIDENCE) {
          await supabase.from('alpha_signals').insert({
            wallet_address:       wallet.address,
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
        }
      }
    }
  }
}

function shouldRefreshPnl(wallet: AlphaWallet): boolean {
  if (!wallet.last_refreshed_at) return true
  const age = Date.now() - new Date(wallet.last_refreshed_at).getTime()
  return age > 60 * 60 * 1000   // refresh entity PnL at most once per hour
}
