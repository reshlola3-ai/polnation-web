import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_USD = 200_000
const WINDOW_HOURS = 48

// Well-known governance tokens worth tracking
const GOV_TOKENS = new Set([
  'UNI', 'COMP', 'AAVE', 'CRV', 'MKR', 'SNX', 'YFI',
  'BAL', 'CVX', 'FXS', 'LDO', 'ARB', 'OP', 'POL', 'MATIC',
  'ENS', 'GTC', 'DYDX', 'GMX', 'GNS',
])

/**
 * Pre-Governance Accumulation: entity accumulates a known governance token
 * with > $200K over the last 48 hours. Large accumulation of voting power
 * often precedes significant protocol governance actions.
 */
export function detectPreGovernance(
  walletAddress: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const addr = walletAddress.toLowerCase()
  const cutoff = Date.now() - WINDOW_HOURS * 60 * 60 * 1000

  const govBuys = transfers.filter(
    t => t.toAddress.address.toLowerCase() === addr
      && t.tokenSymbol && GOV_TOKENS.has(t.tokenSymbol)
      && (t.historicalUSD ?? 0) >= MIN_USD * 0.1   // individual tx can be smaller
      && new Date(t.timestamp).getTime() >= cutoff
  )
  if (!govBuys.length) return null

  // Aggregate by token
  const byToken = new Map<string, { usd: number; txHashes: string[]; chain: string; tokenAddress?: string }>()
  for (const tx of govBuys) {
    const sym = tx.tokenSymbol!
    const cur = byToken.get(sym) ?? { usd: 0, txHashes: [], chain: tx.chain, tokenAddress: tx.tokenAddress }
    cur.usd += tx.historicalUSD ?? 0
    cur.txHashes.push(tx.txId)
    byToken.set(sym, cur)
  }

  // Find token with highest total accumulation above threshold
  let best: { sym: string; usd: number; txHashes: string[]; chain: string; tokenAddress?: string } | null = null
  for (const [sym, agg] of byToken.entries()) {
    if (agg.usd >= MIN_USD && (!best || agg.usd > best.usd)) {
      best = { sym, ...agg }
    }
  }
  if (!best) return null

  return {
    patternId: 'pre_gov',
    txHashes: best.txHashes,
    chain: best.chain,
    tokenSymbol: best.sym,
    tokenAddress: best.tokenAddress,
    amountUsd: best.usd,
    entityName,
    entityType,
    pnl30d,
    context: { windowHours: WINDOW_HOURS },
  }
}
