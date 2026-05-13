import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_ALT_USD       = 500_000     // alt-coins
const MIN_MAJOR_USD     = 2_000_000   // ETH/SOL/BTC/etc — higher bar to filter routine MM flow

// Excluded entirely — stablecoins are inventory, not directional bets
const STABLES = new Set([
  'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'PYUSD', 'USDS', 'CRVUSD',
  'USDC.E', 'USDT.E', 'USDP', 'GUSD',
])

// "Major" coins — included but with higher threshold
const MAJORS = new Set([
  'ETH', 'WETH', 'BTC', 'WBTC', 'CBBTC', 'SOL', 'WSOL', 'BNB', 'WBNB',
])

const isInbound = (t: ArkhamTransfer, entityId: string) =>
  t.toAddress?.arkhamEntity?.id === entityId
const isOutbound = (t: ArkhamTransfer, entityId: string) =>
  t.fromAddress?.arkhamEntity?.id === entityId

/**
 * Net Accumulation: entity has net inbound flow above the per-token-class
 * threshold for a single token over the 24h window — inflows minus outflows.
 * Captures inventory build-up that is invisible to per-transaction patterns
 * (no single tx is large, but the net is).
 *
 * Stablecoins are excluded entirely (inventory, not directional).
 * Major coins (ETH/SOL/BTC/BNB) require $2M+; alt-coins require $500K+.
 */
export function detectNetAccumulation(
  entityId: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const byToken = new Map<string, {
    netUsd: number
    txHashes: string[]
    chain: string
    tokenAddress?: string
    threshold: number
  }>()

  for (const t of transfers) {
    const sym = t.tokenSymbol?.toUpperCase()
    if (!sym || STABLES.has(sym)) continue
    const usd = t.historicalUSD ?? 0
    if (usd <= 0) continue

    const threshold = MAJORS.has(sym) ? MIN_MAJOR_USD : MIN_ALT_USD
    const cur = byToken.get(sym) ?? {
      netUsd: 0, txHashes: [], chain: t.chain, tokenAddress: t.tokenAddress, threshold,
    }
    if (isInbound(t, entityId))       cur.netUsd += usd
    else if (isOutbound(t, entityId)) cur.netUsd -= usd
    else continue
    cur.txHashes.push(t.txId)
    byToken.set(sym, cur)
  }

  let best: { sym: string; netUsd: number; txHashes: string[]; chain: string; tokenAddress?: string } | null = null
  for (const [sym, agg] of byToken.entries()) {
    if (agg.netUsd >= agg.threshold && (!best || agg.netUsd > best.netUsd)) {
      best = { sym, netUsd: agg.netUsd, txHashes: agg.txHashes, chain: agg.chain, tokenAddress: agg.tokenAddress }
    }
  }
  if (!best) return null

  return {
    patternId: 'net_accumulation',
    txHashes: best.txHashes,
    chain: best.chain,
    tokenSymbol: best.sym,
    tokenAddress: best.tokenAddress,
    amountUsd: best.netUsd,
    entityName,
    entityType,
    pnl30d,
    context: { netInbound: best.netUsd, txCount: best.txHashes.length },
  }
}
