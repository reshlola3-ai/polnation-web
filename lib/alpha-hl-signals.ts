// 真实 HL 跟单信号构建器。
// 信号 = 我们追踪的盈利交易员在 Hyperliquid 上的真实成交/持仓。
// ⚠️ 隐私：leader 地址仅存在于服务端此文件，绝不下发前端。对外暴露的 HlSignal
// 不含任何交易员身份（无名字、无地址）——只有交易本身 + 可验证的真实成交 hash。

const HL_INFO = 'https://api.hyperliquid.xyz/info'

// 每个 leader 最多带几个真实浮亏仓；混合目标 ~20% 浮亏。
const MAX_LOSS_PER_LEADER = 2
const LOSS_RATIO = 0.2
const FEED_SIZE = 24
const MIN_WIN_PNL = 50 // 过滤掉过小的赢单，卡片更有说服力

// 服务端私有：追踪的 leader 地址（经 find-hl-leaders-enriched 验证）。切勿导出到客户端。
const LEADER_ADDRESSES: readonly string[] = [
  '0xf517639a8872e756ac98d3c65507d2ebc25cc032',
  '0x2025137a136bea7446deba681cbfc7cf1970840e',
  '0x2d99fe0f36c1aebd28a1a2c0e82e8ca13c2ea351',
  '0x15b325660a1c4a9582a7d834c31119c0cb9e3a42',
  '0xd487e26c62ed8c28ce3cc70b5791e501c2934982',
  '0xe02e420ec55b4e03924d77c7b342c012541ba2d3',
]

// 对外信号（无交易员身份）。
export interface HlSignal {
  id: string
  type: 'closed_win' | 'open_loss'
  coin: string
  direction: 'long' | 'short'
  leverage: number | null
  entryPrice: number | null
  exitPrice: number | null
  currentPrice: number | null
  sizeUsd: number
  pnlUsd: number
  time: number // ms epoch
  txHash: string // 真实成交 hash（一定有值）
  verifyUrl: string // HL 官方浏览器
}

interface HlFill {
  coin: string
  px: string
  sz: string
  time: number
  hash: string
  dir?: string
  closedPnl?: string
  fee?: string
}
interface HlPosition {
  coin: string
  szi: string
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  leverage?: { value?: number }
}

const isStd = (c: string): boolean => !!c && !c.includes(':')
const verifyUrl = (hash: string) => `https://app.hyperliquid.xyz/explorer/tx/${hash}`

async function hlPost<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// 把连续的平仓 fill 聚合成一笔逻辑交易（同币同方向、间隔 <30min 归一单）。
function aggregateWins(fills: HlFill[]): HlSignal[] {
  const closes = fills
    .filter((f) => f.dir?.startsWith('Close') && isStd(f.coin))
    .sort((a, b) => a.time - b.time)

  type Group = {
    coin: string; dir: string; sz: number; pxSz: number; pnl: number
    time: number; maxSz: number; hash: string
  }
  const groups: Group[] = []
  for (const f of closes) {
    const dir = f.dir as string
    const sz = Number(f.sz)
    const last = groups[groups.length - 1]
    if (last && last.coin === f.coin && last.dir === dir && f.time - last.time < 30 * 60_000) {
      last.sz += sz
      last.pxSz += Number(f.px) * sz
      last.pnl += Number(f.closedPnl) || 0
      last.time = f.time
      if (sz > last.maxSz) { last.maxSz = sz; last.hash = f.hash }
    } else {
      groups.push({
        coin: f.coin, dir, sz, pxSz: Number(f.px) * sz,
        pnl: Number(f.closedPnl) || 0, time: f.time, maxSz: sz, hash: f.hash,
      })
    }
  }

  return groups
    .filter((g) => g.pnl >= MIN_WIN_PNL && g.hash)
    .map((g) => {
      const exit = g.pxSz / g.sz
      return {
        id: `w_${g.hash.slice(2, 14)}`,
        type: 'closed_win' as const,
        coin: g.coin,
        direction: g.dir.includes('Long') ? ('long' as const) : ('short' as const),
        leverage: null,
        entryPrice: null,
        exitPrice: exit,
        currentPrice: null,
        sizeUsd: exit * g.sz,
        pnlUsd: g.pnl,
        time: g.time,
        txHash: g.hash,
        verifyUrl: verifyUrl(g.hash),
      }
    })
}

// 当前真实浮亏持仓 → 信号。必须能找到该币的真实成交 hash，否则跳过（不退回地址）。
function buildLosses(positions: HlPosition[], fills: HlFill[]): HlSignal[] {
  const out: HlSignal[] = []
  for (const p of positions) {
    if (!isStd(p.coin) || Number(p.unrealizedPnl) >= 0) continue
    const szi = Number(p.szi)
    if (szi === 0) continue
    // 优先该币最近的开仓 fill，退而求其次该币任意最近 fill——都是真实 hash。
    const onCoin = fills.filter((f) => f.coin === p.coin && f.hash)
    const opener = onCoin.find((f) => f.dir?.startsWith('Open')) ?? onCoin.sort((a, b) => b.time - a.time)[0]
    if (!opener) continue // 无真实 hash 可验证 → 跳过
    const notional = Number(p.positionValue)
    out.push({
      id: `l_${opener.hash.slice(2, 14)}`,
      type: 'open_loss',
      coin: p.coin,
      direction: szi >= 0 ? 'long' : 'short',
      leverage: p.leverage?.value ?? null,
      entryPrice: Number(p.entryPx),
      exitPrice: null,
      currentPrice: notional / Math.abs(szi),
      sizeUsd: notional,
      pnlUsd: Number(p.unrealizedPnl),
      time: opener.time,
      txHash: opener.hash,
      verifyUrl: verifyUrl(opener.hash),
    })
  }
  return out
}

interface ClearinghouseState {
  assetPositions?: Array<{ position: HlPosition }>
}

/** 拉全部 leader 的真实交易，产出对外信号 feed（无身份、仅 hash 可验证）。 */
export async function getHlSignals(): Promise<HlSignal[]> {
  const wins: HlSignal[] = []
  const losses: HlSignal[] = []

  for (const addr of LEADER_ADDRESSES) {
    const [state, fills] = await Promise.all([
      hlPost<ClearinghouseState>({ type: 'clearinghouseState', user: addr }),
      hlPost<HlFill[]>({ type: 'userFills', user: addr }),
    ])
    const fillList = Array.isArray(fills) ? fills : []
    wins.push(...aggregateWins(fillList))
    const positions = (state?.assetPositions ?? []).map((a) => a.position)
    losses.push(...buildLosses(positions, fillList).slice(0, MAX_LOSS_PER_LEADER))
  }

  wins.sort((a, b) => b.time - a.time)
  losses.sort((a, b) => b.time - a.time)

  const nLoss = Math.min(losses.length, Math.round(FEED_SIZE * LOSS_RATIO))
  const feed = [...wins.slice(0, FEED_SIZE - nLoss), ...losses.slice(0, nLoss)]
  feed.sort((a, b) => b.time - a.time)
  return feed
}

/** 顶部信任条汇总（不泄露身份）。 */
export function summarize(signals: HlSignal[]) {
  const realized = signals
    .filter((s) => s.type === 'closed_win')
    .reduce((sum, s) => sum + s.pnlUsd, 0)
  return {
    traderCount: LEADER_ADDRESSES.length,
    realizedUsd: Math.round(realized),
    verifiablePct: 100,
  }
}
