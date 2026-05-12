import type { ArkhamTransfer, PatternMatch } from '../types'

const MIN_USD   = 500_000
const WINDOW_MS = 2 * 60 * 60 * 1000

const STABLES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'PYUSD', 'USDS', 'crvUSD'])

const isOutbound = (t: ArkhamTransfer, entityId: string) =>
  t.fromAddress?.arkhamEntity?.id === entityId
const isInbound = (t: ArkhamTransfer, entityId: string) =>
  t.toAddress?.arkhamEntity?.id === entityId

/**
 * Stable → Token Rotation: entity moves > $500K out of stablecoins and into a
 * specific non-stable token within a 2-hour window.
 */
export function detectStableRotation(
  entityId: string,
  entityName: string,
  entityType: string,
  pnl30d: number,
  transfers: ArkhamTransfer[]
): PatternMatch | null {
  const stableOuts = transfers.filter(
    t => isOutbound(t, entityId)
      && t.tokenSymbol && STABLES.has(t.tokenSymbol)
      && (t.historicalUSD ?? 0) >= MIN_USD
  )
  if (!stableOuts.length) return null

  for (const stableOut of stableOuts) {
    const stableTime = new Date(stableOut.timestamp).getTime()

    const tokenIn = transfers.find(
      t => isInbound(t, entityId)
        && t.tokenSymbol && !STABLES.has(t.tokenSymbol)
        && t.chain === stableOut.chain
        && (t.historicalUSD ?? 0) >= MIN_USD * 0.7
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
