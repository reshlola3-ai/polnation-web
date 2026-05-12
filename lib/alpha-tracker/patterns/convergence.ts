import type { AlphaSignal, PatternMatch } from '../types'

const WINDOW_MS    = 24 * 60 * 60 * 1000   // 24 hours
const MIN_ENTITIES = 2

/**
 * Convergence: 2+ unrelated smart-money entities have bought the same token
 * within a 24-hour window. Highest-confidence pattern — multiple independent
 * actors reaching the same conclusion in the same daily window.
 *
 * Called after inserting a new signal; checks existing recent signals in DB.
 */
export function detectConvergence(
  newSignal: { tokenSymbol: string; entityName: string; amountUsd: number; chain: string },
  recentSignals: AlphaSignal[]   // last 24h from DB, excluding current entity
): PatternMatch | null {
  const { tokenSymbol, entityName, amountUsd, chain } = newSignal
  if (!tokenSymbol) return null

  const cutoff = Date.now() - WINDOW_MS
  const sameToken = recentSignals.filter(
    s => s.token_symbol === tokenSymbol
      && s.entity_name !== entityName
      && new Date(s.observed_at).getTime() >= cutoff
  )

  if (sameToken.length < MIN_ENTITIES - 1) return null

  const allEntities = [entityName, ...sameToken.map(s => s.entity_name)]
  const totalUsd = amountUsd + sameToken.reduce((acc, s) => acc + (s.amount_usd ?? 0), 0)

  return {
    patternId: 'convergence',
    txHashes: sameToken.flatMap(s => s.tx_hashes),
    chain,
    tokenSymbol,
    amountUsd: totalUsd,
    entityName: allEntities.join(' + '),
    entityType: 'multiple',
    pnl30d: 0,
    context: {
      entities: allEntities,
      entityCount: allEntities.length,
      windowHours: 24,
    },
  }
}
