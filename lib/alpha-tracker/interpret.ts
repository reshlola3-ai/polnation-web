import type { PatternMatch } from './types'

function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function buildWhatText(match: PatternMatch): string {
  const { entityName, tokenSymbol, amountUsd, txHashes, chain } = match
  const txCount = txHashes.length
  const txWord = txCount === 1 ? 'transaction' : 'transactions'

  switch (match.patternId) {
    case 'pre_cex':
      return `${entityName} accumulated ${usd(amountUsd)} of ${tokenSymbol} across ${txCount} ${txWord} on ${chain}`

    case 'bridge_buy': {
      const bridgeAmt = match.context.bridgeAmountUsd as number | undefined
      return `${entityName} bridged ${bridgeAmt ? usd(bridgeAmt) : 'funds'} to ${chain}, then bought ${usd(amountUsd)} of ${tokenSymbol} within 30 minutes`
    }

    case 'lp_position':
      return `${entityName} added ${usd(amountUsd)} of liquidity to a ${tokenSymbol} pool on ${chain}`

    case 'stable_rotation': {
      const stable = match.context.stableSymbol as string | undefined
      return `${entityName} rotated ${usd(amountUsd)} from ${stable ?? 'stablecoins'} into ${tokenSymbol} on ${chain}`
    }

    case 'convergence': {
      const entities = match.context.entities as string[]
      return `${entities.length} entities (${entities.join(', ')}) all bought ${tokenSymbol} within a 4-hour window — combined ${usd(amountUsd)}`
    }

    case 'dca_dump': {
      const change = match.context.priceChange24h as number
      return `${entityName} bought ${usd(amountUsd)} of ${tokenSymbol} while it is down ${Math.abs(change).toFixed(1)}% in the last 24h`
    }

    case 'pre_gov':
      return `${entityName} accumulated ${usd(amountUsd)} of ${tokenSymbol} governance tokens over the last 48 hours`

    case 'net_accumulation': {
      const txCount = match.context.txCount as number | undefined
      return `${entityName} netted ${usd(amountUsd)} of ${tokenSymbol} on ${chain} (inflows minus outflows across ${txCount ?? txHashes.length} transfers)`
    }

    default:
      return `${entityName} made a notable ${usd(amountUsd)} move on ${tokenSymbol}`
  }
}

export function buildMeaningText(match: PatternMatch): string {
  const { tokenSymbol } = match

  switch (match.patternId) {
    case 'pre_cex':
      return `Market makers accumulate tokens with low trading volume before liquidity events — exchange listings, OTC deals, or partnership announcements. ${tokenSymbol}'s current volume is below this entity's typical baseline, suggesting they may have advance knowledge of an upcoming catalyst.`

    case 'bridge_buy':
      return `Bridging capital to a new chain and immediately buying a specific token is one of the clearest directional signals available on-chain. This sequence reveals deliberate intent — the entity didn't stumble into this position.`

    case 'lp_position':
      return `Smart money adding liquidity signals confidence in a token's near-term price stability and trading volume. Providing LP requires holding the underlying token; large LP entries from known entities often precede volume spikes that generate fee revenue.`

    case 'stable_rotation':
      return `Moving from stablecoins (risk-off) directly into a specific token (risk-on) is a high-conviction signal. This entity chose to deploy idle capital into ${tokenSymbol} — a deliberate bet on price appreciation rather than passive yield.`

    case 'convergence':
      return `Multiple independent smart-money entities arriving at the same token simultaneously is the strongest on-chain signal type. Independent conviction across multiple actors dramatically reduces the chance this is noise or a single actor's idiosyncratic trade.`

    case 'dca_dump':
      return `Buying into weakness when retail is panic selling is a classic smart-money strategy. Entities with strong track records who step in during drawdowns often do so because they have higher conviction in the underlying thesis than the market currently reflects.`

    case 'pre_gov':
      return `Accumulating governance tokens grants voting power. Large acquisitions of ${tokenSymbol} ahead of protocol votes can signal that this entity intends to influence an upcoming decision — or that they expect a governance outcome that will drive token value.`

    case 'net_accumulation':
      return `Net inventory build of ${tokenSymbol} — this entity is consistently buying more than selling. Market makers do this ahead of expected OTC demand, exchange listings, or other liquidity events; the signal is invisible at the per-transaction level but the trend is unambiguous over 24h.`

    default:
      return `This move by a labeled smart-money entity exceeded typical thresholds and triggered a signal.`
  }
}
