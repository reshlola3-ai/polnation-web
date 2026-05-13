import type {
  ArkhamAddressIntel,
  ArkhamPortfolioResponse,
  ArkhamTokenMarket,
  ArkhamTransfersResponse,
} from './types'

const BASE = 'https://api.arkm.com'
const API_KEY = process.env.ARKHAM_API_KEY ?? ''

// /transfers is a heavy endpoint: 1 req/s max
// Other standard endpoints: 20 req/s
// We serialize all calls through a simple queue with per-endpoint delays.

let lastTransferCallAt = 0
const TRANSFER_INTERVAL_MS = 1100   // 1.1s gap to stay under 1 req/s

async function throttleTransfer() {
  const now = Date.now()
  const wait = lastTransferCallAt + TRANSFER_INTERVAL_MS - now
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastTransferCallAt = Date.now()
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'API-Key': API_KEY },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Arkham ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Recent transfers for an address. Heavy endpoint — auto-throttled to 1 req/s.
 *
 * Filters out malformed entries: Arkham's Bitcoin (UTXO) responses use a
 * `toAddresses[]` array shape that lacks the singular `toAddress` our patterns
 * expect, and some transfers have a missing `fromAddress`. Both are dropped
 * here so pattern detectors can assume valid in/out shape.
 */
export async function getTransfers(
  address: string,
  opts: {
    flow?: 'in' | 'out' | 'all'
    timeLast?: string
    usdGte?: string
    limit?: number
    chains?: string
  } = {}
): Promise<ArkhamTransfersResponse> {
  await throttleTransfer()
  const res = await get<ArkhamTransfersResponse>('/transfers', {
    base:     address,
    flow:     opts.flow     ?? 'all',
    timeLast: opts.timeLast ?? '6h',
    usdGte:   opts.usdGte   ?? '50000',
    limit:    String(opts.limit ?? 50),
    ...(opts.chains ? { chains: opts.chains } : {}),
  })

  const transfers = (res.transfers ?? []).filter(
    t => t && t.fromAddress && t.toAddress &&
         typeof t.fromAddress === 'object' && typeof t.toAddress === 'object'
  )
  return { transfers }
}

/**
 * Entity + label intelligence for a wallet address.
 */
export async function getAddressIntel(address: string): Promise<ArkhamAddressIntel> {
  return get<ArkhamAddressIntel>(`/intelligence/address/${address}`)
}

/**
 * Daily portfolio time series for a named entity (e.g. "wintermute").
 */
export async function getEntityPortfolio(entity: string): Promise<ArkhamPortfolioResponse> {
  return get<ArkhamPortfolioResponse>(`/portfolio/timeSeries/entity/${encodeURIComponent(entity)}`)
}

/**
 * Current market data for a token by CoinGecko-style pricing ID.
 */
export async function getTokenMarket(tokenId: string): Promise<ArkhamTokenMarket> {
  return get<ArkhamTokenMarket>(`/token/market/${encodeURIComponent(tokenId)}`)
}

/**
 * Compute 30-day PnL (USD) for an entity from their portfolio time series.
 * Returns 0 on error (non-fatal for signal scoring).
 */
export async function getEntity30dPnl(entity: string): Promise<number> {
  try {
    const { values } = await getEntityPortfolio(entity)
    if (values.length < 2) return 0
    const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date))
    const oldest = parseFloat(sorted[0].value)
    const latest = parseFloat(sorted[sorted.length - 1].value)
    return isNaN(oldest) || isNaN(latest) ? 0 : latest - oldest
  } catch {
    return 0
  }
}
