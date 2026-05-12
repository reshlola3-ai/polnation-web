import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_BRIDGE_USD = 1_000_000
const BUY_WINDOW_MS  = 30 * 60 * 1000   // 30 minutes
const MIN_BUY_USD    = 100_000

const BRIDGE_KEYWORDS = ['bridge', 'hop', 'stargate', 'across', 'celer', 'multichain', 'layerzero', 'wormhole', 'polygon bridge']

function isBridge(tx: ArkhamTransfer): boolean {
  const label = (tx.fromAddress.arkhamLabel?.name ?? tx.fromAddress.arkhamEntity?.name ?? '').toLowerCase()
  return BRIDGE_KEYWORDS.some(k => label.includes(k))
}

/**
 * Bridge-then-Buy: entity bridges > $1M onto a chain, then buys a specific
 * token within 30 minutes. The bridge + intent pattern is high-conviction.
 */
export function detectBridgeBuy(
  walletAddress: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const addr = walletAddress.toLowerCase()

  const bridges = transfers.filter(
    t => t.toAddress.address.toLowerCase() === addr
      && isBridge(t)
      && (t.historicalUSD ?? 0) >= MIN_BRIDGE_USD
  )
  if (!bridges.length) return null

  for (const bridge of bridges) {
    const bridgeTime = new Date(bridge.timestamp).getTime()

    // Look for a token buy after the bridge within the time window
    const buy = transfers.find(
      t => t.toAddress.address.toLowerCase() === addr
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
