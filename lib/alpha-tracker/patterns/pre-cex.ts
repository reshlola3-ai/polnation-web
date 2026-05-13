import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_USD = 200_000
const MAX_TOKEN_VOLUME_24H = 50_000_000
const MARKET_MAKER_TYPES = ['market_maker', 'trading_firm', 'fund', 'institution']

const isInbound = (t: ArkhamTransfer, entityId: string) =>
  t.toAddress?.arkhamEntity?.id === entityId

/**
 * Pre-CEX Accumulation: a market-maker entity accumulates a token whose 24h
 * trading volume is below $10M — often precedes exchange listings or OTC deals.
 */
export function detectPreCex(
  entityId: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[],
  tokenVolumes: Record<string, number>
): PatternMatch | null {
  if (!MARKET_MAKER_TYPES.some(t => entityType.toLowerCase().includes(t))) return null

  const inbound = transfers.filter(
    t => isInbound(t, entityId)
      && t.historicalUSD != null
      && (t.historicalUSD ?? 0) >= MIN_USD
  )
  if (!inbound.length) return null

  const byToken = new Map<string, { usd: number; txHashes: string[]; chain: string; tokenAddress?: string }>()
  for (const tx of inbound) {
    const sym = tx.tokenSymbol ?? 'UNKNOWN'
    const existing = byToken.get(sym) ?? { usd: 0, txHashes: [], chain: tx.chain, tokenAddress: tx.tokenAddress }
    existing.usd += tx.historicalUSD ?? 0
    existing.txHashes.push(tx.txId)
    byToken.set(sym, existing)
  }

  for (const [sym, agg] of byToken.entries()) {
    if (agg.usd < MIN_USD) continue
    const vol24h = tokenVolumes[sym] ?? Infinity
    if (vol24h > MAX_TOKEN_VOLUME_24H) continue

    return {
      patternId: 'pre_cex',
      txHashes: agg.txHashes,
      chain: agg.chain,
      tokenSymbol: sym,
      tokenAddress: agg.tokenAddress,
      amountUsd: agg.usd,
      entityName,
      entityType,
      pnl30d,
      context: { tokenVolume24h: vol24h },
    }
  }
  return null
}
