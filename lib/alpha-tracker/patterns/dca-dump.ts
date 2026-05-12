import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_USD            = 300_000
const DUMP_THRESHOLD_PCT = -10   // token must be down >= 10% in 24h

/**
 * Smart DCA on Dump: a labeled entity buys > $300K of a token while it is down
 * >= 10% in the last 24 hours. Contrarian smart-money entries against retail
 * panic historically precede reversals.
 */
export function detectDcaDump(
  walletAddress: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[],
  tokenPriceChanges: Record<string, number>   // tokenSymbol → 24h % change
): PatternMatch | null {
  const addr = walletAddress.toLowerCase()

  const buys = transfers.filter(
    t => t.toAddress.address.toLowerCase() === addr
      && t.tokenSymbol
      && (t.historicalUSD ?? 0) >= MIN_USD
      && t.tokenSymbol in tokenPriceChanges
      && tokenPriceChanges[t.tokenSymbol] <= DUMP_THRESHOLD_PCT
  )
  if (!buys.length) return null

  // Pick the largest buy
  const best = buys.reduce((a, b) => (a.historicalUSD ?? 0) > (b.historicalUSD ?? 0) ? a : b)
  const priceChange = tokenPriceChanges[best.tokenSymbol!]

  return {
    patternId: 'dca_dump',
    txHashes: buys.map(t => t.txId),
    chain: best.chain,
    tokenSymbol: best.tokenSymbol!,
    tokenAddress: best.tokenAddress,
    amountUsd: buys.reduce((acc, t) => acc + (t.historicalUSD ?? 0), 0),
    entityName,
    entityType,
    pnl30d,
    context: { priceChange24h: priceChange },
  }
}
