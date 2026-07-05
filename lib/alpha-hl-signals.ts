// 真实 HL 跟单信号构建器。
// 信号 = 我们追踪的盈利交易员在 Hyperliquid 上的真实【已平仓】交易(赚或赔)。
// 只收录"干净"交易:一笔 tx 开仓 + 一笔 tx 平仓,且 (出场价-入场价)×数量 与
// HL 的 closedPnl 偏差 ≤1% —— 用户点开仓/平仓两个链接即可肉眼复算卡片上的盈亏。
// ⚠️ 隐私:leader 地址仅存在于服务端此文件,绝不下发前端。对外暴露的 HlSignal
// 不含任何交易员身份(无名字、无地址)——只有交易本身 + 可验证的真实成交 hash。

const HL_INFO = 'https://api.hyperliquid.xyz/info'

const FEED_SIZE = 24
const MIN_WIN_PNL = 500 // 只展示 ≥$500 的已平仓赢单(小额如 $120 不展示)
const MIN_LOSS_PNL = 300 // 只展示 ≥$300(绝对值)的已平仓亏损单
const LOSS_RATIO = 0.2 // 混合目标 ~20% 亏损单
const RECON_TOLERANCE = 0.01 // (exit-entry)*sz 与 closedPnl 允许偏差 ≤1%
const POS_EPS = 1e-9 // 仓位归零判定容差

// 服务端私有:追踪的 leader 地址。经 scripts/screen-hl-leaders.mjs 全网筛选:
// 30 天盈利、近 7 天不亏、历史总盈利、低频持仓型(干净交易多)。切勿导出到客户端。
// 建议每月重跑筛选脚本,业绩转负的 leader 及时换掉。
const LEADER_ADDRESSES: readonly string[] = [
  '0x352deb23bebae8b4c57d0ae341d9c1951fd8425a', // 30d +$55k, ROI 158%
  '0x3d643dabed5e1675ffc6a4608d095c11943ef551', // 30d +$37k, ROI 178%
  '0xf2fe51f77c1beb2e226db19eaaa2c2c2ce02ccfa', // 30d +$60k, ROI 53%
]

// 对外信号(无交易员身份)。开仓/平仓各一个真实 tx hash,数字链上可复算。
export interface HlSignal {
  id: string
  type: 'closed_win' | 'closed_loss'
  coin: string
  direction: 'long' | 'short'
  entryPrice: number // 真实开仓成交均价(来自开仓 tx)
  exitPrice: number // 真实平仓成交均价(来自平仓 tx)
  sizeUsd: number // 开仓名义价值 entryPrice × 数量
  pnlUsd: number // HL 提供的真实 closedPnl
  openTime: number // ms epoch,开仓时间
  time: number // ms epoch,平仓时间
  openTxHash: string // 真实开仓成交 hash
  openVerifyUrl: string // Hypurrscan 浏览器,指向开仓 tx
  txHash: string // 真实平仓成交 hash
  verifyUrl: string // Hypurrscan 浏览器,指向平仓 tx
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

const isStd = (c: string): boolean => !!c && !c.includes(':') && !c.startsWith('@') && !c.includes('/')
// 用 Hypurrscan(第三方 Hyperliquid 浏览器)查这笔成交，避免把用户直接带进 Hyperliquid 交易所。
const verifyUrl = (hash: string) => `https://hypurrscan.io/tx/${hash}`

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

// 按 coin 重建仓位 episode(0 → 开仓 → 0),只保留一笔 tx 开、一笔 tx 平的干净交易。
interface Episode {
  coin: string
  direction: 'long' | 'short'
  openTxs: Set<string>
  closeTxs: Set<string>
  openHash: string
  closeHash: string
  entryPxSz: number
  entrySz: number
  exitPxSz: number
  exitSz: number
  pnl: number
  openTime: number
  closeTime: number
  dirty: boolean // 出现翻转等无法干净归因的成交
}

function buildCleanSignals(fills: HlFill[]): HlSignal[] {
  const byCoin = new Map<string, HlFill[]>()
  for (const f of fills) {
    if (!isStd(f.coin) || !f.dir || !f.hash) continue
    const arr = byCoin.get(f.coin)
    if (arr) arr.push(f)
    else byCoin.set(f.coin, [f])
  }

  const episodes: Episode[] = []
  for (const [coin, arr] of byCoin) {
    arr.sort((a, b) => a.time - b.time)
    let pos = 0 // 有符号仓位(多正空负)
    let ep: Episode | null = null
    for (const f of arr) {
      const sz = Number(f.sz)
      const px = Number(f.px)
      const d = f.dir!
      let delta: number
      if (d === 'Open Long' || d === 'Close Short' || d === 'Buy') delta = sz
      else if (d === 'Open Short' || d === 'Close Long' || d === 'Sell') delta = -sz
      else {
        // 'Long > Short' 等翻转成交:无法干净归因,整个 episode 作废
        if (ep) ep.dirty = true
        pos += d.includes('> Short') ? -sz : sz
        continue
      }

      const wasFlat = Math.abs(pos) < POS_EPS
      pos += delta
      const isOpen = d.startsWith('Open')
      const isClose = d.startsWith('Close')

      if (wasFlat && isOpen) {
        ep = {
          coin,
          direction: d === 'Open Long' ? 'long' : 'short',
          openTxs: new Set([f.hash]),
          closeTxs: new Set(),
          openHash: f.hash,
          closeHash: '',
          entryPxSz: px * sz,
          entrySz: sz,
          exitPxSz: 0,
          exitSz: 0,
          pnl: 0,
          openTime: f.time,
          closeTime: 0,
          dirty: false,
        }
      } else if (ep) {
        if (isOpen) {
          ep.openTxs.add(f.hash)
          ep.entryPxSz += px * sz
          ep.entrySz += sz
        }
        if (isClose) {
          ep.closeTxs.add(f.hash)
          ep.closeHash = f.hash
          ep.exitPxSz += px * sz
          ep.exitSz += sz
          ep.pnl += Number(f.closedPnl) || 0
          ep.closeTime = f.time
        }
      }

      if (ep && Math.abs(pos) < POS_EPS && ep.exitSz > 0) {
        episodes.push(ep)
        ep = null
      }
    }
  }

  const out: HlSignal[] = []
  for (const e of episodes) {
    // 干净:单笔 tx 开仓 + 单笔 tx 平仓,无翻转
    if (e.dirty || e.openTxs.size !== 1 || e.closeTxs.size !== 1) continue
    if (e.entrySz <= 0 || e.exitSz <= 0 || e.pnl === 0) continue
    const win = e.pnl > 0
    if (win ? e.pnl < MIN_WIN_PNL : -e.pnl < MIN_LOSS_PNL) continue

    const entry = e.entryPxSz / e.entrySz
    const exit = e.exitPxSz / e.exitSz
    // 自洽校验:两个 tx 页面上的价格×数量必须能复算出展示的盈亏
    const calc = (e.direction === 'long' ? exit - entry : entry - exit) * e.exitSz
    if (Math.abs(calc - e.pnl) / Math.abs(e.pnl) > RECON_TOLERANCE) continue

    out.push({
      id: `${win ? 'w' : 'l'}_${e.closeHash.slice(2, 14)}`,
      type: win ? 'closed_win' : 'closed_loss',
      coin: e.coin,
      direction: e.direction,
      entryPrice: entry,
      exitPrice: exit,
      sizeUsd: entry * e.entrySz,
      pnlUsd: e.pnl,
      openTime: e.openTime,
      time: e.closeTime,
      openTxHash: e.openHash,
      openVerifyUrl: verifyUrl(e.openHash),
      txHash: e.closeHash,
      verifyUrl: verifyUrl(e.closeHash),
    })
  }
  return out
}

/** 拉全部 leader 的真实已平仓交易,产出对外信号 feed(无身份、开仓+平仓双 hash 可验证)。 */
export async function getHlSignals(): Promise<HlSignal[]> {
  const wins: HlSignal[] = []
  const losses: HlSignal[] = []

  for (const addr of LEADER_ADDRESSES) {
    const fills = await hlPost<HlFill[]>({ type: 'userFills', user: addr })
    const closed = buildCleanSignals(Array.isArray(fills) ? fills : [])
    for (const s of closed) (s.type === 'closed_win' ? wins : losses).push(s)
  }

  wins.sort((a, b) => b.time - a.time)
  losses.sort((a, b) => b.time - a.time)

  const nLoss = Math.min(losses.length, Math.round(FEED_SIZE * LOSS_RATIO))
  const feed = [...wins.slice(0, FEED_SIZE - nLoss), ...losses.slice(0, nLoss)]
  feed.sort((a, b) => b.time - a.time)
  return feed
}
