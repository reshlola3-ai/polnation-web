'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// 对外信号形状（与 lib/alpha-hl-signals.ts 的 HlSignal 一致，此处本地声明避免把
// 含 leader 地址的服务端模块打进客户端 bundle）。无任何交易员身份字段。
interface HlSignal {
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
  time: number
  txHash: string
  verifyUrl: string
}
interface Summary { traderCount: number; realizedUsd: number; verifiablePct: number }

const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h)

function fmtPrice(n: number): string {
  const abs = Math.abs(n)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 4 : 6
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}
function fmtMoney(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}
function fmtWhen(ms: number): string {
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function AlphaHlFeed() {
  const t = useTranslations('alpha.hlFeed')
  const [signals, setSignals] = useState<HlSignal[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/alpha/hl-signals')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) { setSignals(d.signals ?? []); setSummary(d.summary ?? null) } })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  return (
    <div className="mx-auto w-full max-w-md px-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-white">{t('title')}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          {t('verifiedBadge')}
        </span>
      </div>

      {/* Trust strip */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800">
        <TrustCell k={t('trustTraders')} v={summary ? String(summary.traderCount) : '—'} />
        <TrustCell k={t('trustRealized')} v={summary ? fmtMoney(summary.realizedUsd) : '—'} good />
        <TrustCell k={t('trustVerifiable')} v={summary ? `${summary.verifiablePct}%` : '—'} />
      </div>

      {/* Feed head */}
      <div className="flex items-center justify-between px-1 pb-2 pt-5">
        <span className="text-[13px] font-semibold text-zinc-400">{t('latestSignals')}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{t('liveSync')}
        </span>
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        {error && <p className="py-8 text-center text-sm text-zinc-500">—</p>}
        {!error && signals === null &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
          ))}
        {signals?.map((s) => <SignalCard key={s.id} s={s} t={t} />)}
      </div>
    </div>
  )
}

function TrustCell({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 bg-zinc-900 px-3 py-2.5">
      <span className="text-[11px] text-zinc-500">{k}</span>
      <span className={`text-[15px] font-bold tabular-nums ${good ? 'text-emerald-400' : 'text-white'}`}>{v}</span>
    </div>
  )
}

function SignalCard({ s, t }: { s: HlSignal; t: ReturnType<typeof useTranslations> }) {
  const win = s.type === 'closed_win'
  const isLong = s.direction === 'long'
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-900/60 p-3.5">
      {/* status */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold tracking-wide ${isLong ? 'border-emerald-500/25 text-emerald-400' : 'border-red-500/25 text-red-400'}`}>
          <span>{isLong ? '▲' : '▼'}</span>{isLong ? t('long') : t('short')}
          {s.leverage ? <span className="text-zinc-500">· {s.leverage}x</span> : null}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${win ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          {win ? t('statusClosed') : t('statusOpen')}
        </span>
      </div>

      {/* body */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[20px] font-bold leading-none tracking-tight text-white">{s.coin}</span>
          <span className="text-[11.5px] tabular-nums text-zinc-400">
            {win
              ? `${t('exit')} @${fmtPrice(s.exitPrice ?? 0)} · ${t('notional')} $${Math.round(s.sizeUsd).toLocaleString('en-US')}`
              : `${t('entry')} @${fmtPrice(s.entryPrice ?? 0)} · ${t('mark')} @${fmtPrice(s.currentPrice ?? 0)}`}
          </span>
        </div>
        <div className="text-right leading-none">
          <div className={`text-[23px] font-bold tabular-nums tracking-tight ${win ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(s.pnlUsd)}</div>
          <div className="mt-1.5 text-[10.5px] text-zinc-500">{win ? t('realizedPnl') : t('unrealizedPnl')}</div>
        </div>
      </div>

      {/* foot */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-2.5">
        <span className="text-[11px] text-zinc-500">{win ? fmtWhen(s.time) : t('positionOngoing')}</span>
        <a href={s.verifyUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-300 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
          <span className="font-mono text-zinc-500">{shortHash(s.txHash)}</span>{t('verify')}<span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  )
}
