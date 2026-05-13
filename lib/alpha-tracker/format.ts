// Display helpers for signal cards — turn machine codes into readable labels.

const CHAIN_LABELS: Record<string, string> = {
  ethereum:     'Ethereum',
  bsc:          'BNB Chain',
  polygon:      'Polygon',
  arbitrum:     'Arbitrum',
  arbitrum_one: 'Arbitrum',
  optimism:     'Optimism',
  base:         'Base',
  avalanche:    'Avalanche',
  solana:       'Solana',
  bitcoin:      'Bitcoin',
  hyperevm:     'HyperEVM',
  tron:         'Tron',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  market_maker: 'Market Maker',
  trading_firm: 'Trading Firm',
  fund:         'Fund',
  individual:   'Individual Whale',
  cex:          'Centralized Exchange',
  dex:          'Decentralized Exchange',
  defi:         'DeFi Protocol',
  stablecoin:   'Stablecoin Issuer',
  bridge:       'Bridge',
  whale:        'Whale',
  unknown:      'Entity',
}

export function chainLabel(chain: string | null | undefined): string {
  if (!chain) return 'Unknown'
  return CHAIN_LABELS[chain.toLowerCase()] ?? chain.toUpperCase()
}

export function entityTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Entity'
  return ENTITY_TYPE_LABELS[type.toLowerCase()] ?? type
}

export function usdCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

export function arkhamTxUrl(hash: string, chain: string | null): string {
  if (!hash) return 'https://intel.arkm.com/'
  // Arkham supports chain hint via query param on EVM/SOL; otherwise just the hash
  const c = (chain ?? '').toLowerCase()
  if (c === 'bitcoin' || c === 'btc') return `https://intel.arkm.com/explorer/tx/${hash}`
  return `https://intel.arkm.com/explorer/tx/${hash}`
}

export function arkhamEntityUrl(entityId: string): string {
  return `https://intel.arkm.com/explorer/entity/${entityId}`
}
