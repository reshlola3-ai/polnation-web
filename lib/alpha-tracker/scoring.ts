import type { ConfidenceBreakdown, PatternMatch } from './types'
import { PATTERN_META } from './patterns/index'

// ─── Score ranges ─────────────────────────────────────────────────────────────
// entity_track_record   0-30
// pattern_strength      0-25
// token_liquidity_fit   0-15
// recency_context       0-15
// convergence_bonus     0-15
// ─────────────────────────────
// total                 0-100

function scoreEntityTrackRecord(pnl30d: number): number {
  if (pnl30d >= 10_000_000)  return 30
  if (pnl30d >= 5_000_000)   return 26
  if (pnl30d >= 1_000_000)   return 22
  if (pnl30d >= 500_000)     return 18
  if (pnl30d >= 100_000)     return 13
  if (pnl30d >= 0)           return 8
  return 4   // negative 30d PnL — still watching, lower score
}

function scorePatternStrength(match: PatternMatch): number {
  return PATTERN_META[match.patternId].strengthScore
}

function scoreTokenLiquidityFit(match: PatternMatch): number {
  const vol = (match.context.tokenVolume24h as number | undefined) ?? null
  if (vol === null) return 10   // unknown → neutral

  // Sweet spot: token is liquid enough to move but not so big the signal is noise
  if (vol >= 1_000_000 && vol <= 50_000_000)  return 15
  if (vol >= 500_000   && vol <= 100_000_000) return 12
  if (vol >= 100_000   && vol <= 200_000_000) return 8
  return 5
}

function scoreRecencyContext(match: PatternMatch): number {
  const priceChange = (match.context.priceChange24h as number | undefined) ?? null

  if (match.patternId === 'dca_dump') {
    // For dca_dump, a bigger dump = higher surprise/conviction = better signal
    const change = priceChange ?? -10
    if (change <= -20) return 15
    if (change <= -15) return 13
    return 11
  }

  if (priceChange === null) return 12   // no price context, neutral

  // For other patterns, mild positive drift or flat is ideal
  if (priceChange >= -5 && priceChange <= 5)  return 15
  if (priceChange >= -10 && priceChange <= 10) return 12
  if (priceChange >= -20 && priceChange <= 20) return 8
  return 5
}

function scoreConvergenceBonus(match: PatternMatch): number {
  if (match.patternId === 'convergence') {
    const n = (match.context.entityCount as number | undefined) ?? 2
    if (n >= 4) return 15
    if (n === 3) return 12
    return 9
  }
  return 0
}

export function computeConfidence(match: PatternMatch): {
  score: number
  breakdown: ConfidenceBreakdown
} {
  const breakdown: ConfidenceBreakdown = {
    entity_track_record: scoreEntityTrackRecord(match.pnl30d),
    pattern_strength:    scorePatternStrength(match),
    token_liquidity_fit: scoreTokenLiquidityFit(match),
    recency_context:     scoreRecencyContext(match),
    convergence_bonus:   scoreConvergenceBonus(match),
  }
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0))
  return { score, breakdown }
}
