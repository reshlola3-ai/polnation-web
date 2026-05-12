import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_USD     = 500_000
const WINDOW_MS   = 2 * 60 * 60 * 1000   // 2 hours

const STABLES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'PYUSD', 'USDS', 'crvUSD'])

/**
 * Stable → Token Rotation: entity moves > $500K out of stablecoins and into a
 * specific non-stable token within a 2-hour window. This is a high-conviction
 * signal — moving from risk-off to risk-on with size.
 */
export function detectStableRotation(
  walletAddress: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const addr = walletAddress.toLowerCase()

  const stableOuts = transfers.filter(
    t => t.fromAddress.address.toLowerCase() === addr
      && t.tokenSymbol && STABLES.has(t.tokenSymbol)
      && (t.historicalUSD ?? 0) >= MIN_USD
  )
  if (!stableOuts.length) return null

  for (const stableOut of stableOuts) {
    const stableTime = new Date(stableOut.timestamp).getTime()

    // Find a non-stable inbound close in time on the same chain
    const tokenIn = transfers.find(
      t => t.toAddress.address.toLowerCase() === addr
        && t.tokenSymbol && !STABLES.has(t.tokenSymbol)
        && t.chain === stableOut.chain
        && (t.historicalUSD ?? 0) >= MIN_USD * 0.7  // allow 30% slippage
        && Math.abs(new Date(t.timestamp).getTime() - stableTime) <= WINDOW_MS
    )
    if (!tokenIn) continue

    return {
      patternId: 'stable_rotation',
      txHashes: [stableOut.txId, tokenIn.txId],
      chain: stableOut.chain,
      tokenSymbol: tokenIn.tokenSymbol!,
      tokenAddress: tokenIn.tokenAddress,
      amountUsd: tokenIn.historicalUSD ?? stableOut.historicalUSD ?? 0,
      entityName,
      entityType,
      pnl30d,
      context: { stableSymbol: stableOut.tokenSymbol, stableAmountUsd: stableOut.historicalUSD },
    }
  }
  return null
}
