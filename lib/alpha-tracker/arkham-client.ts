import type {
  ArkhamAddressIntel,
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

  // Arkham's response uses `transactionHash` on EVM and `txid` on UTXO chains —
  // neither matches our ArkhamTransfer.txId field. Normalise here so patterns
  // and DB inserts get a real hash instead of undefined → null.
  const transfers = (res.transfers ?? [])
    .filter(t => t && t.fromAddress && t.toAddress &&
                 typeof t.fromAddress === 'object' && typeof t.toAddress === 'object')
    .map(t => ({
      ...t,
      txId: t.txId
        ?? (t as unknown as { transactionHash?: string }).transactionHash
        ?? (t as unknown as { txid?: string }).txid
        ?? '',
    }))
    .filter(t => t.txId !== '')

  return { transfers }
}

/**
 * Entity + label intelligence for a wallet address.
 */
export async function getAddressIntel(address: string): Promise<ArkhamAddressIntel> {
  return get<ArkhamAddressIntel>(`/intelligence/address/${address}`)
}

/**
 * Total net worth (USD) of an entity at a point in time.
 *
 * The snapshot endpoint requires a `time` (unix ms) and returns holdings shaped
 * as { chain: { tokenId: { usd } } } across every chain/token — we sum every
 * token's USD value. Returns null on failure so callers can tell "no data"
 * apart from a genuine $0.
 */
export async function getEntityNetWorthUsd(entity: string, atMs: number): Promise<number | null> {
  try {
    const data = await get<Record<string, Record<string, { usd?: number }>>>(
      `/portfolio/entity/${encodeURIComponent(entity)}`,
      { time: String(atMs) },
    )
    let total = 0
    for (const chain of Object.values(data ?? {})) {
      for (const tok of Object.values(chain ?? {})) {
        if (tok && typeof tok.usd === 'number') total += tok.usd
      }
    }
    return total
  } catch {
    return null
  }
}

/**
 * Current market data for a token by CoinGecko-style pricing ID.
 */
export async function getTokenMarket(tokenId: string): Promise<ArkhamTokenMarket> {
  return get<ArkhamTokenMarket>(`/token/market/${encodeURIComponent(tokenId)}`)
}

/**
 * 30-day change in net worth (USD) — our "track record" proxy. Entities growing
 * their book score higher; bleeders score lower. Not pure realized PnL (token
 * price moves count too), but a real, differentiating signal vs the old all-zero
 * behaviour. Returns 0 on error (non-fatal for signal scoring).
 */
export async function getEntity30dPnl(entity: string): Promise<number> {
  const now = Date.now()
  const ago = now - 30 * 24 * 60 * 60 * 1000
  const [latest, oldest] = await Promise.all([
    getEntityNetWorthUsd(entity, now),
    getEntityNetWorthUsd(entity, ago),
  ])
  if (latest === null || oldest === null) return 0
  return latest - oldest
}
