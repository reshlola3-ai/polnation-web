'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { RefreshCw, ArrowLeft, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Mover {
  user_id: string
  username: string | null
  totalPrev: number
  totalNow: number
  deltaTotal: number
  naturalGrowth: number
  netExternal: number
  kind: 'deposit' | 'withdraw' | 'natural'
}
interface Growth {
  hasData: boolean
  from: string | null
  to: string | null
  analyzed: number
  newDeposits: number
  withdrawals: number
  naturalGrowth: number
  netExternal: number
  movers: Mover[]
}
interface HistoryRow {
  taken_at: string
  chain: number
  available: number
  total: number
  totalEarned: number
  deltaTotal: number
  naturalGrowth: number
  netExternal: number
  kind: 'deposit' | 'withdraw' | 'natural' | 'first'
}
interface History {
  username: string | null
  rows: HistoryRow[]
  notFound?: boolean
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dt = (s: string) => new Date(s).toLocaleString()

function KindBadge({ kind }: { kind: string }) {
  if (kind === 'deposit') return <span className="inline-flex items-center gap-1 text-emerald-300 text-xs font-semibold"><TrendingUp className="w-3 h-3" />入金</span>
  if (kind === 'withdraw') return <span className="inline-flex items-center gap-1 text-red-300 text-xs font-semibold"><TrendingDown className="w-3 h-3" />撤资</span>
  if (kind === 'natural') return <span className="inline-flex items-center gap-1 text-sky-300 text-xs"><Minus className="w-3 h-3" />吃息</span>
  return <span className="text-zinc-500 text-xs">起点</span>
}

export default function BalanceHistoryPage() {
  const router = useRouter()
  const [growth, setGrowth] = useState<Growth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<History | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)

  const loadGrowth = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/balance-history')
      if (res.status === 401) { router.push('/admin/login'); return }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setGrowth(json.growth)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadGrowth() }, [loadGrowth])

  const loadUser = useCallback(async (opts: { userId?: string; q?: string }) => {
    setLoadingUser(true); setError('')
    try {
      const qs = opts.userId ? `user=${opts.userId}` : `search=${encodeURIComponent(opts.q || '')}`
      const res = await fetch(`/api/admin/balance-history?${qs}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setHistory(json.history)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user')
    } finally { setLoadingUser(false) }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin/community"><Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300"><ArrowLeft className="w-4 h-4" /></Button></Link>
            <div>
              <h1 className="text-lg font-bold">资金变动记录 · Balance History</h1>
              <p className="text-xs text-zinc-400">每次「刷新全部等级 / 发放」记一张全员快照，对比增减</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadGrowth} className="border-zinc-700 text-zinc-300">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />刷新
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        {/* 全局：最近两次快照的资金变动 */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5">
          <h2 className="text-white font-semibold mb-1">本次变动（最近两次快照对比）</h2>
          {growth?.hasData ? (
            <>
              <p className="text-xs text-zinc-500 mb-3">
                {dt(growth.from!)} → {dt(growth.to!)} · 有变动 {growth.analyzed} 人 ·
                <span className="text-emerald-300"> 入金 {usd(growth.newDeposits)}</span> ·
                <span className="text-red-300"> 撤资 {usd(growth.withdrawals)}</span> ·
                <span className="text-sky-300"> 吃息 {usd(growth.naturalGrowth)}</span>
              </p>
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-900">
                    <tr>
                      <th className="text-left py-2 pr-4">用户</th>
                      <th className="text-right py-2 pr-4">上次总资产</th>
                      <th className="text-right py-2 pr-4">现总资产</th>
                      <th className="text-right py-2 pr-4">Δ总</th>
                      <th className="text-right py-2 pr-4">吃息</th>
                      <th className="text-right py-2 pr-4">入金/撤资</th>
                      <th className="text-left py-2">类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {growth.movers.map((m) => (
                      <tr key={m.user_id} className="border-b border-zinc-800/60 hover:bg-zinc-800/40">
                        <td className="py-2 pr-4">
                          <button onClick={() => { setSearch(m.username || ''); loadUser({ userId: m.user_id }) }} className="text-white hover:text-purple-300 underline decoration-dotted">
                            {m.username || m.user_id.slice(0, 8)}
                          </button>
                        </td>
                        <td className="py-2 pr-4 text-right text-zinc-400 tabular-nums">{usd(m.totalPrev)}</td>
                        <td className="py-2 pr-4 text-right text-white tabular-nums">{usd(m.totalNow)}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums font-medium ${m.deltaTotal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{signed(m.deltaTotal)}</td>
                        <td className="py-2 pr-4 text-right text-sky-300/80 tabular-nums">{signed(m.naturalGrowth)}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums font-semibold ${m.netExternal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{signed(m.netExternal)}</td>
                        <td className="py-2"><KindBadge kind={m.kind} /></td>
                      </tr>
                    ))}
                    {growth.movers.length === 0 && <tr><td colSpan={7} className="py-4 text-zinc-500">本次无明显资金变动。</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-zinc-500 text-sm">{loading ? '加载中…' : '暂无数据（至少需要两次快照——点「刷新全部等级」或发放一次即可累积）。'}</p>
          )}
        </section>

        {/* 单用户时间线 */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5">
          <h2 className="text-white font-semibold mb-3">单用户资金时间线</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); if (search.trim()) loadUser({ q: search.trim() }) }}
            className="flex gap-2 mb-4 max-w-md"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索用户名 / 邮箱…"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-sm text-white"
              />
            </div>
            <Button type="submit" disabled={loadingUser}>{loadingUser ? '…' : '查'}</Button>
          </form>

          {history && (
            history.notFound ? (
              <p className="text-amber-300 text-sm">没找到匹配的用户。</p>
            ) : history.rows.length === 0 ? (
              <p className="text-zinc-500 text-sm">该用户暂无快照记录。</p>
            ) : (
              <>
                <p className="text-sm text-zinc-300 mb-2">{history.username} · 共 {history.rows.length} 条快照</p>
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-sm">
                    <thead className="text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-900">
                      <tr>
                        <th className="text-left py-2 pr-4">时间</th>
                        <th className="text-right py-2 pr-4">链上</th>
                        <th className="text-right py-2 pr-4">可提现</th>
                        <th className="text-right py-2 pr-4">总资产</th>
                        <th className="text-right py-2 pr-4">Δ总</th>
                        <th className="text-right py-2 pr-4">吃息</th>
                        <th className="text-right py-2 pr-4">入金/撤资</th>
                        <th className="text-left py-2">类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map((r) => (
                        <tr key={r.taken_at} className="border-b border-zinc-800/60">
                          <td className="py-2 pr-4 text-zinc-400 whitespace-nowrap">{dt(r.taken_at)}</td>
                          <td className="py-2 pr-4 text-right text-zinc-300 tabular-nums">{usd(r.chain)}</td>
                          <td className="py-2 pr-4 text-right text-zinc-300 tabular-nums">{usd(r.available)}</td>
                          <td className="py-2 pr-4 text-right text-white tabular-nums">{usd(r.total)}</td>
                          <td className={`py-2 pr-4 text-right tabular-nums ${r.kind === 'first' ? 'text-zinc-600' : r.deltaTotal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{r.kind === 'first' ? '—' : signed(r.deltaTotal)}</td>
                          <td className="py-2 pr-4 text-right text-sky-300/80 tabular-nums">{r.kind === 'first' ? '—' : signed(r.naturalGrowth)}</td>
                          <td className={`py-2 pr-4 text-right tabular-nums font-semibold ${r.kind === 'first' ? 'text-zinc-600' : r.netExternal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{r.kind === 'first' ? '—' : signed(r.netExternal)}</td>
                          <td className="py-2"><KindBadge kind={r.kind} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </section>
      </main>
    </div>
  )
}
