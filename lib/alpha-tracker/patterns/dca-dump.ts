import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_USD            = 300_000
const DUMP_THRESHOLD_PCT = -10

const isInbound = (t: ArkhamTransfer, entityId: string) =>
  t.toAddress?.arkhamEntity?.id === entityId

/**
 * Smart DCA on Dump: entity buys > $300K of a token while it is down >= 10%
 * in the last 24 hours. Contrarian smart-money entries against retail panic.
 */
export function detectDcaDump(
  entityId: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[],
  tokenPriceChanges: Record<string, number>
): PatternMatch | null {
  const buys = transfers.filter(
    t => isInbound(t, entityId)
      && t.tokenSymbol
      && (t.historicalUSD ?? 0) >= MIN_USD
      && t.tokenSymbol in tokenPriceChanges
      && tokenPriceChanges[t.tokenSymbol] <= DUMP_THRESHOLD_PCT
  )
  if (!buys.length) return null

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
