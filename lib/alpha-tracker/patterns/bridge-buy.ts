import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_BRIDGE_USD = 1_000_000
const BUY_WINDOW_MS  = 30 * 60 * 1000
const MIN_BUY_USD    = 100_000

const BRIDGE_KEYWORDS = ['bridge', 'hop', 'stargate', 'across', 'celer', 'multichain', 'layerzero', 'wormhole', 'polygon bridge']

const isBridge = (tx: ArkhamTransfer): boolean => {
  const label = (tx.fromAddress.arkhamLabel?.name ?? tx.fromAddress.arkhamEntity?.name ?? '').toLowerCase()
  return BRIDGE_KEYWORDS.some(k => label.includes(k))
}

const isInbound = (t: ArkhamTransfer, entityId: string) =>
  t.toAddress?.arkhamEntity?.id === entityId

/**
 * Bridge-then-Buy: entity bridges > $1M onto a chain, then buys a specific
 * token within 30 minutes. The bridge + intent pattern is high-conviction.
 */
export function detectBridgeBuy(
  entityId: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const bridges = transfers.filter(
    t => isInbound(t, entityId) && isBridge(t) && (t.historicalUSD ?? 0) >= MIN_BRIDGE_USD
  )
  if (!bridges.length) return null

  for (const bridge of bridges) {
    const bridgeTime = new Date(bridge.timestamp).getTime()

    const buy = transfers.find(
      t => isInbound(t, entityId)
        && !isBridge(t)
        && t.tokenSymbol
        && (t.historicalUSD ?? 0) >= MIN_BUY_USD
        && t.chain === bridge.chain
        && (() => {
          const buyTime = new Date(t.timestamp).getTime()
          return buyTime >= bridgeTime && buyTime <= bridgeTime + BUY_WINDOW_MS
        })()
    )
    if (!buy) continue

    return {
      patternId: 'bridge_buy',
      txHashes: [bridge.txId, buy.txId],
      chain: bridge.chain,
      tokenSymbol: buy.tokenSymbol!,
      tokenAddress: buy.tokenAddress,
      amountUsd: buy.historicalUSD ?? 0,
      entityName,
      entityType,
      pnl30d,
      context: { bridgeAmountUsd: bridge.historicalUSD, windowMinutes: 30 },
    }
  }
  return null
}
