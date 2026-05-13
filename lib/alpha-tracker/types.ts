// ─── Pattern IDs ─────────────────────────────────────────────────────────────

export type PatternId =
  | 'pre_cex'
  | 'bridge_buy'
  | 'lp_position'
  | 'stable_rotation'
  | 'convergence'
  | 'dca_dump'
  | 'pre_gov'
  | 'net_accumulation'

// ─── DB rows ─────────────────────────────────────────────────────────────────

export interface AlphaEntity {
  id: string
  entity_id: string          // Arkham slug, e.g. "wintermute"
  display_name: string
  entity_type: string        // "fund", "market_maker", "individual"
  pnl_30d: number
  portfolio_usd: number
  is_active: boolean
  last_refreshed_at: string | null
  created_at: string
}

export interface AlphaSignal {
  id: string
  entity_id: string
  entity_name: string
  pattern_id: PatternId
  confidence: number
  confidence_breakdown: ConfidenceBreakdown
  tx_hashes: string[]
  chain: string | null
  token_symbol: string | null
  token_address: string | null
  amount_usd: number | null
  what_text: string
  meaning_text: string
  observed_at: string
  expires_at: string
}

export interface ConfidenceBreakdown {
  entity_track_record: number   // 0-30
  pattern_strength: number      // 0-25
  token_liquidity_fit: number   // 0-15
  recency_context: number       // 0-15
  convergence_bonus: number     // 0-15
}

// ─── Arkham API response shapes ───────────────────────────────────────────────

export interface ArkhamEntity {
  id: string
  name: string
  type: string
  website?: string
}

export interface ArkhamLabel {
  name: string
  address: string
}

export interface ArkhamAddressIntel {
  address: string
  chain: string
  arkhamEntity?: ArkhamEntity
  arkhamLabel?: ArkhamLabel
}

export interface ArkhamTransferAddress {
  address: string
  chain?: string
  arkhamEntity?: ArkhamEntity
  arkhamLabel?: ArkhamLabel
}

export interface ArkhamTransfer {
  txId: string
  timestamp: string
  blockTimestamp?: string
  fromAddress: ArkhamTransferAddress
  toAddress: ArkhamTransferAddress
  tokenAddress?: string
  tokenName?: string
  tokenSymbol?: string
  tokenDecimals?: number
  unitValue?: string
  historicalUSD?: number
  chain: string
  type?: string
}

export interface ArkhamTransfersResponse {
  transfers: ArkhamTransfer[]
}

export interface ArkhamPortfolioEntry {
  date: string
  value: string
}

export interface ArkhamPortfolioResponse {
  values: ArkhamPortfolioEntry[]
}

export interface ArkhamTokenMarket {
  tokenId: string
  symbol: string
  price: number
  volume24h: number
  marketCap?: number
  priceChange24h?: number
}

// ─── Pattern match (returned by each detector) ───────────────────────────────

export interface PatternMatch {
  patternId: PatternId
  txHashes: string[]
  chain: string
  tokenSymbol: string
  tokenAddress?: string
  amountUsd: number
  entityName: string
  entityType: string
  pnl30d: number
  context: Record<string, unknown>
}
