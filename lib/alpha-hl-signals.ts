// 真实 HL 跟单信号构建器。
// 信号 = 我们追踪的盈利交易员在 Hyperliquid 上的真实【已平仓】交易（赚或赔）。
// 每张卡对应一笔真实平仓 tx，closedPnl 真实，链接指向那一笔、数字完全吻合。
// ⚠️ 隐私：leader 地址仅存在于服务端此文件，绝不下发前端。对外暴露的 HlSignal
// 不含任何交易员身份（无名字、无地址）——只有交易本身 + 可验证的真实成交 hash。

const HL_INFO = 'https://api.hyperliquid.xyz/info'

const FEED_SIZE = 24
const MIN_WIN_PNL = 500 // 只展示 ≥$500 的已平仓赢单（小额如 $120 不展示）
const MIN_LOSS_PNL = 300 // 只展示 ≥$300（绝对值）的已平仓亏损单
const LOSS_RATIO = 0.2 // 混合目标 ~20% 亏损单

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
  type: 'closed_win' | 'closed_loss'
  coin: string
  direction: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  sizeUsd: number
  pnlUsd: number
  time: number // ms epoch
  txHash: string // 真实平仓成交 hash（一定有值）
  verifyUrl: string // HL 官方浏览器，指向这一笔平仓 tx
}

interface HlFill {
  coin: string
  px: string
  sz: string
  time: number
  hash: string
  dir?: string
  closedPnl?: string
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

// 按【平仓 tx hash】聚合成交 → 每笔平仓 tx 一个信号，与 explorer 页面完全对应。
function buildClosedSignals(fills: HlFill[]): HlSignal[] {
  type G = { coin: string; dir: string; sz: number; pxSz: number; pnl: number; time: number }
  const byHash = new Map<string, G>()
  for (const f of fills) {
    if (!f.dir?.startsWith('Close') || !isStd(f.coin) || !f.hash) continue
    const sz = Number(f.sz)
    const g = byHash.get(f.hash)
    if (g) {
      g.sz += sz
      g.pxSz += Number(f.px) * sz
      g.pnl += Number(f.closedPnl) || 0
      g.time = Math.max(g.time, f.time)
    } else {
      byHash.set(f.hash, { coin: f.coin, dir: f.dir, sz, pxSz: Number(f.px) * sz, pnl: Number(f.closedPnl) || 0, time: f.time })
    }
  }

  const out: HlSignal[] = []
  for (const [hash, g] of byHash) {
    const win = g.pnl >= 0
    if (win ? g.pnl < MIN_WIN_PNL : -g.pnl < MIN_LOSS_PNL) continue
    if (g.sz <= 0) continue
    const exit = g.pxSz / g.sz
    const direction = g.dir.includes('Long') ? ('long' as const) : ('short' as const)
    // 由真实 closedPnl 反推有效入场价，与展示盈亏完全自洽：
    // long: pnl=(exit-entry)*size → entry=exit-pnl/size；short 相反。（亏损时 pnl<0 亦成立）
    const entry = direction === 'long' ? exit - g.pnl / g.sz : exit + g.pnl / g.sz
    out.push({
      id: `${win ? 'w' : 'l'}_${hash.slice(2, 14)}`,
      type: win ? 'closed_win' : 'closed_loss',
      coin: g.coin,
      direction,
      entryPrice: entry,
      exitPrice: exit,
      sizeUsd: exit * g.sz,
      pnlUsd: g.pnl,
      time: g.time,
      txHash: hash,
      verifyUrl: verifyUrl(hash),
    })
  }
  return out
}

/** 拉全部 leader 的真实已平仓交易，产出对外信号 feed（无身份、仅 hash 可验证）。 */
export async function getHlSignals(): Promise<HlSignal[]> {
  const wins: HlSignal[] = []
  const losses: HlSignal[] = []

  for (const addr of LEADER_ADDRESSES) {
    const fills = await hlPost<HlFill[]>({ type: 'userFills', user: addr })
    const closed = buildClosedSignals(Array.isArray(fills) ? fills : [])
    for (const s of closed) (s.type === 'closed_win' ? wins : losses).push(s)
  }

  wins.sort((a, b) => b.time - a.time)
  losses.sort((a, b) => b.time - a.time)

  const nLoss = Math.min(losses.length, Math.round(FEED_SIZE * LOSS_RATIO))
  const feed = [...wins.slice(0, FEED_SIZE - nLoss), ...losses.slice(0, nLoss)]
  feed.sort((a, b) => b.time - a.time)
  return feed
}
