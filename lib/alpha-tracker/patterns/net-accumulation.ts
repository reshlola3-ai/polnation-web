import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_NET_USD = 1_000_000

// Tokens we ignore — these are routine market-maker liquidity, not directional bets
const BLUE_CHIPS = new Set([
  'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'PYUSD', 'USDS', 'crvUSD',
  'ETH', 'WETH', 'BTC', 'WBTC', 'BNB', 'SOL', 'WSOL',
])

const isInbound = (t: ArkhamTransfer, entityId: string) =>
  t.toAddress?.arkhamEntity?.id === entityId
const isOutbound = (t: ArkhamTransfer, entityId: string) =>
  t.fromAddress?.arkhamEntity?.id === entityId

/**
 * Net Accumulation: entity has net inbound flow ≥ $1M for a single non-blue-chip
 * token over the 24h window — inflows minus outflows. This captures inventory
 * build-up by market makers ahead of OTC deals or listings, which is invisible
 * to per-transaction patterns (no single tx is large, but the net is).
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
  }>()

  for (const t of transfers) {
    const sym = t.tokenSymbol
    if (!sym || BLUE_CHIPS.has(sym.toUpperCase())) continue
    const usd = t.historicalUSD ?? 0
    if (usd <= 0) continue

    const cur = byToken.get(sym) ?? { netUsd: 0, txHashes: [], chain: t.chain, tokenAddress: t.tokenAddress }
    if (isInbound(t, entityId))       cur.netUsd += usd
    else if (isOutbound(t, entityId)) cur.netUsd -= usd
    else continue
    cur.txHashes.push(t.txId)
    byToken.set(sym, cur)
  }

  let best: { sym: string; netUsd: number; txHashes: string[]; chain: string; tokenAddress?: string } | null = null
  for (const [sym, agg] of byToken.entries()) {
    if (agg.netUsd >= MIN_NET_USD && (!best || agg.netUsd > best.netUsd)) {
      best = { sym, ...agg }
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
