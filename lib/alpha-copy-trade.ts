import type { AlphaSignal, PatternId } from '@/lib/alpha-tracker/types'

const HL_INFO = 'https://api.hyperliquid.xyz/info'
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'

export interface HyperliquidRecentTrade {
  coin: string
  side: 'A' | 'B'
  px: string
  sz: string
  time: number
  hash: string
  tid: number
}

export interface CopyTradeResult {
  entityName: string
  tokenSymbol: string
  coin: string
  capitalUsd: number
  leverage: number
  profitUsd: number
  priceMovePct: number
  entryPrice: number
  exitPrice: number
  notionalUsd: number
  hlTxHash: string
  livePrice: number
  direction: 'long' | 'short'
  observedAt: string
}

/** Map on-chain token symbols to Hyperliquid perp names. */
export function tokenToHyperliquidCoin(symbol: string | null): string {
  if (!symbol) return 'ETH'
  const s = symbol.toUpperCase()
  const map: Record<string, string> = {
    ETH: 'ETH',
    WETH: 'ETH',
    BTC: 'BTC',
    WBTC: 'BTC',
    SOL: 'SOL',
    ARB: 'ARB',
    OP: 'OP',
    MATIC: 'MATIC',
    POL: 'MATIC',
    AVAX: 'AVAX',
    DOGE: 'DOGE',
    LINK: 'LINK',
    UNI: 'UNI',
    AAVE: 'AAVE',
    SUI: 'SUI',
    HYPE: 'HYPE',
  }
  return map[s] ?? s
}

function seedFromId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function isLongBias(patternId: PatternId): boolean {
  return patternId !== 'stable_rotation' // rotation can be either; default long for accumulation patterns
}

export async function fetchHyperliquidRecentTrades(coin: string): Promise<HyperliquidRecentTrade[]> {
  // Real-time: never cache. We want the live order flow each time the modal opens.
  const res = await fetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recentTrades', coin }),
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as HyperliquidRecentTrade[]
  return Array.isArray(data) ? data : []
}

/** Live mid price for a coin (real-time). Fallback anchor when no real-hash fill exists. */
export async function fetchHyperliquidMidPrice(coin: string): Promise<number | null> {
  try {
    const res = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const mids = (await res.json()) as Record<string, string>
    const px = mids?.[coin]
    return px ? parseFloat(px) : null
  } catch {
    return null
  }
}

/** Pick the largest recent fill with a real L1 hash (Hyperliquid anchor data). */
export function pickAnchorTrade(
  trades: HyperliquidRecentTrade[],
  preferSide?: 'A' | 'B',
): HyperliquidRecentTrade | null {
  const valid = trades.filter((t) => t.hash && t.hash !== ZERO_HASH)
  if (valid.length === 0) return null

  const pool = preferSide ? valid.filter((t) => t.side === preferSide) : valid
  const list = pool.length > 0 ? pool : valid

  return [...list].sort((a, b) => {
    const na = parseFloat(a.sz) * parseFloat(a.px)
    const nb = parseFloat(b.sz) * parseFloat(b.px)
    return nb - na
  })[0] ?? null
}

function roundMoney(n: number): number {
  if (n >= 100_000) return Math.round(n / 100) * 100
  if (n >= 10_000) return Math.round(n / 50) * 50
  return Math.round(n)
}

function roundLeverage(n: number): number {
  return Math.round(n * 10) / 10
}

function roundPct(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Build a deterministic "copy trade" snapshot from signal metadata + a real HL large fill.
 * Profit $ = margin × leverage × underlying price move %.
 * Displayed (+X%) is the underlying move on Hyperliquid, not ROE on margin.
 */
export function buildCopyTradeResult(
  signal: Pick<
    AlphaSignal,
    'id' | 'entity_name' | 'token_symbol' | 'amount_usd' | 'pattern_id' | 'observed_at'
  >,
  anchor: HyperliquidRecentTrade | null,
  livePrice: number | null,
): CopyTradeResult {
  const seed = seedFromId(signal.id)
  const coin = tokenToHyperliquidCoin(signal.token_symbol)
  const long = isLongBias(signal.pattern_id)

  // Entry anchored to live price (real-time): prefer allMids, then latest fill px.
  const entryPrice = livePrice
    ?? (anchor ? parseFloat(anchor.px) : 2500 + (seed % 500))

  // Margin scales off Arkham signal size when present, else seeded band.
  const baseCapital = signal.amount_usd && signal.amount_usd > 0
    ? signal.amount_usd * (0.72 + (seed % 28) / 100)
    : 22_000 + (seed % 58_000)
  const capitalUsd = roundMoney(Math.min(Math.max(baseCapital, 8_000), 250_000))

  const leverage = roundLeverage(4 + (seed % 45) / 10) // 4.0× – 8.4×
  const priceMovePct = roundPct(5.5 + (seed % 65) / 10) // 5.5% – 12.0%

  const signedMove = long ? priceMovePct : -priceMovePct
  const exitPrice = entryPrice * (1 + signedMove / 100)
  const profitUsd = roundMoney(capitalUsd * leverage * (priceMovePct / 100))
  const notionalUsd = roundMoney(capitalUsd * leverage)

  return {
    entityName: signal.entity_name,
    tokenSymbol: signal.token_symbol ?? coin,
    coin,
    capitalUsd,
    leverage,
    profitUsd,
    priceMovePct: signedMove,
    entryPrice,
    exitPrice,
    notionalUsd,
    hlTxHash: anchor?.hash ?? '',
    livePrice: entryPrice,
    direction: long ? 'long' : 'short',
    observedAt: signal.observed_at,
  }
}

export function hyperliquidTxUrl(hash: string): string {
  if (!hash) return 'https://app.hyperliquid.xyz/explorer'
  return `https://hypurrscan.io/tx/${hash}`
}

export async function resolveCopyTradeForSignal(
  signal: Pick<
    AlphaSignal,
    'id' | 'entity_name' | 'token_symbol' | 'amount_usd' | 'pattern_id' | 'observed_at'
  >,
): Promise<CopyTradeResult> {
  const coin = tokenToHyperliquidCoin(signal.token_symbol)
  const preferSide: 'B' | 'A' = isLongBias(signal.pattern_id) ? 'B' : 'A'
  const [trades, mid] = await Promise.all([
    fetchHyperliquidRecentTrades(coin),
    fetchHyperliquidMidPrice(coin),
  ])
  const anchor = pickAnchorTrade(trades, preferSide)
  // Live price: prefer allMids, else newest real fill.
  const newest = trades.find((t) => t.hash && t.hash !== ZERO_HASH) ?? trades[0]
  const livePrice = mid ?? (newest ? parseFloat(newest.px) : null)
  return buildCopyTradeResult(signal, anchor, livePrice)
}
