import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_LP_USD = 200_000

const LP_KEYWORDS = [
  'uniswap', 'quickswap', 'sushiswap', 'curve', 'balancer',
  'camelot', 'pancakeswap', 'velodrome', 'aerodrome', 'algebra',
  'liquidity', 'lp', 'pool',
]

const isLpContract = (tx: ArkhamTransfer): boolean => {
  const label = (tx.toAddress.arkhamLabel?.name ?? tx.toAddress.arkhamEntity?.name ?? '').toLowerCase()
  return LP_KEYWORDS.some(k => label.includes(k))
}

const isOutbound = (t: ArkhamTransfer, entityId: string) =>
  t.fromAddress?.arkhamEntity?.id === entityId

/**
 * LP Positioning: entity adds > $200K of liquidity to a known DEX pool.
 */
export function detectLpPosition(
  entityId: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const lpTxs = transfers.filter(
    t => isOutbound(t, entityId) && isLpContract(t) && (t.historicalUSD ?? 0) >= MIN_LP_USD
  )
  if (!lpTxs.length) return null

  const byPool = new Map<string, { usd: number; txHashes: string[]; sym: string; chain: string; tokenAddress?: string }>()
  for (const tx of lpTxs) {
    const key = `${tx.toAddress.address}_${tx.chain}`
    const cur = byPool.get(key) ?? { usd: 0, txHashes: [], sym: tx.tokenSymbol ?? 'LP', chain: tx.chain, tokenAddress: tx.tokenAddress }
    cur.usd += tx.historicalUSD ?? 0
    cur.txHashes.push(tx.txId)
    byPool.set(key, cur)
  }

  let best: { usd: number; txHashes: string[]; sym: string; chain: string; tokenAddress?: string } | null = null
  for (const v of byPool.values()) {
    if (v.usd >= MIN_LP_USD && (!best || v.usd > best.usd)) best = v
  }
  if (!best) return null

  return {
    patternId: 'lp_position',
    txHashes: best.txHashes,
    chain: best.chain,
    tokenSymbol: best.sym,
    tokenAddress: best.tokenAddress,
    amountUsd: best.usd,
    entityName,
    entityType,
    pnl30d,
    context: {},
  }
}
