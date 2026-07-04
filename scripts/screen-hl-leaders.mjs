// 全网筛选 Hyperliquid 跟单 leader,用于 lib/alpha-hl-signals.ts 的 LEADER_ADDRESSES。
// 用法: node scripts/screen-hl-leaders.mjs
// 建议每月跑一次;30 天业绩转负、或干净交易断供的 leader 及时换掉。
//
// 筛选逻辑(与 alpha feed 的收录规则一致):
// 1) leaderboard 初筛:30d 盈利 > $30k、近 7d 不亏、历史总盈利、30d ROI > 5%、
//    本金 $10 万–$5000 万、低频(月成交量 < 40x 本金)
// 2) 逐个拉 userFills,重建仓位 episode,统计【一笔 tx 开 + 一笔 tx 平、
//    (出场-入场)×数量 与 closedPnl 偏差 ≤1%】的干净交易
// 3) 按 30 天内合格干净赢单(≥$500)数量排名 —— 取前 2-3 名替换 LEADER_ADDRESSES

const HL_INFO = 'https://api.hyperliquid.xyz/info'
const LEADERBOARD = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard'
const DAY30 = 30 * 24 * 3600 * 1000
const now = Date.now()
const MIN_WIN = 500
const MIN_LOSS = 300
const EPS = 1e-9

const isStd = (c) => !!c && !c.includes(':') && !c.startsWith('@') && !c.includes('/')

function cleanTrades(fills) {
  const byCoin = new Map()
  for (const f of fills) {
    if (!isStd(f.coin) || !f.dir || !f.hash) continue
    if (!byCoin.has(f.coin)) byCoin.set(f.coin, [])
    byCoin.get(f.coin).push(f)
  }
  const out = []
  for (const [coin, arr] of byCoin) {
    arr.sort((a, b) => a.time - b.time)
    let pos = 0
    let ep = null
    for (const f of arr) {
      const sz = Number(f.sz)
      const px = Number(f.px)
      const d = f.dir
      let delta
      if (d === 'Open Long' || d === 'Close Short' || d === 'Buy') delta = sz
      else if (d === 'Open Short' || d === 'Close Long' || d === 'Sell') delta = -sz
      else {
        if (ep) ep.dirty = true
        pos += d.includes('> Short') ? -sz : sz
        continue
      }
      const wasFlat = Math.abs(pos) < EPS
      pos += delta
      const isOpen = d.startsWith('Open')
      const isClose = d.startsWith('Close')
      if (wasFlat && isOpen) {
        ep = { coin, dir: d === 'Open Long' ? 'long' : 'short', openTxs: new Set([f.hash]), closeTxs: new Set(), pnl: 0, entryPxSz: px * sz, entrySz: sz, exitPxSz: 0, exitSz: 0, closeTime: 0, dirty: false }
      } else if (ep) {
        if (isOpen) { ep.openTxs.add(f.hash); ep.entryPxSz += px * sz; ep.entrySz += sz }
        if (isClose) { ep.closeTxs.add(f.hash); ep.exitPxSz += px * sz; ep.exitSz += sz; ep.pnl += Number(f.closedPnl) || 0; ep.closeTime = f.time }
      }
      if (ep && Math.abs(pos) < EPS && ep.exitSz > 0) {
        out.push(ep)
        ep = null
      }
    }
  }
  return out.filter((e) => !e.dirty && e.openTxs.size === 1 && e.closeTxs.size === 1)
}

const recon = (e) => {
  const entry = e.entryPxSz / e.entrySz, exit = e.exitPxSz / e.exitSz
  const calc = (e.dir === 'long' ? exit - entry : entry - exit) * e.exitSz
  return e.pnl !== 0 && Math.abs(calc - e.pnl) / Math.abs(e.pnl) <= 0.01
}

async function fetchFills(addr) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userFills', user: addr }),
    })
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2500 * (i + 1))); continue }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }
  throw new Error('429 重试用尽')
}

console.log('拉取 leaderboard(约 30MB)…')
const lb = await (await fetch(LEADERBOARD)).json()
const perf = (r, k) => {
  const e = r.windowPerformances.find((x) => x[0] === k)
  return e ? { pnl: Number(e[1].pnl), roi: Number(e[1].roi), vlm: Number(e[1].vlm) } : null
}

const cands = lb.leaderboardRows
  .map((r) => {
    const m = perf(r, 'month'), w = perf(r, 'week'), a = perf(r, 'allTime')
    return { addr: r.ethAddress, av: Number(r.accountValue), m, w, a }
  })
  .filter((c) =>
    c.m && c.w && c.a &&
    c.m.pnl > 30000 &&
    c.w.pnl > 0 &&
    c.a.pnl > 0 &&
    c.m.roi > 0.05 &&
    c.av > 100000 && c.av < 50000000 &&
    c.m.vlm > 500000 &&
    c.m.vlm / c.av < 40
  )
  .sort((x, y) => y.m.roi - x.m.roi)
  .slice(0, 120)

console.log(`初筛候选:${cands.length} 个,逐个验证 fills(带 429 退避)…`)

const results = []
let done = 0
for (const c of cands) {
  try {
    const fills = await fetchFills(c.addr)
    const arr = Array.isArray(fills) ? fills : []
    const clean = cleanTrades(arr).filter((e) => e.closeTime >= now - DAY30 && recon(e))
    const qWins = clean.filter((e) => e.pnl >= MIN_WIN)
    const qLoss = clean.filter((e) => e.pnl < 0 && -e.pnl >= MIN_LOSS)
    results.push({ ...c, fills: arr.length, qWins: qWins.length, qLoss: qLoss.length })
  } catch (e) {
    results.push({ ...c, fills: -1, qWins: -1, qLoss: -1, err: e.message })
  }
  done++
  if (done % 20 === 0) console.log(`…${done}/${cands.length}`)
  await new Promise((r) => setTimeout(r, 400))
}

results.sort((x, y) => y.qWins - x.qWins)
console.log('\naddr | 本金 | 30d盈亏 | 30dROI | fills | 干净赢单(≥$500) | 干净亏单(≥$300)')
for (const r of results.slice(0, 20)) {
  console.log(`${r.addr} | $${(r.av / 1e6).toFixed(1)}M | $${(r.m.pnl / 1000).toFixed(0)}k | ${(r.m.roi * 100).toFixed(0)}% | ${r.fills} | ${r.qWins} | ${r.qLoss}${r.err ? ' | ' + r.err : ''}`)
}
