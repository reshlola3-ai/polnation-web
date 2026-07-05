'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// 对外信号形状（与 lib/alpha-hl-signals.ts 的 HlSignal 一致，此处本地声明避免把
// 含 leader 地址的服务端模块打进客户端 bundle）。无任何交易员身份字段。
interface HlSignal {
  id: string
  type: 'closed_win' | 'closed_loss'
  coin: string
  direction: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  sizeUsd: number
  pnlUsd: number
  openTime: number
  time: number
  openTxHash: string
  openVerifyUrl: string
  txHash: string
  verifyUrl: string
}

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

export function AlphaHlFeed() {
  const t = useTranslations('alpha.hlFeed')
  const tc = useTranslations('common')
  const [signals, setSignals] = useState<HlSignal[] | null>(null)
  const [error, setError] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/alpha/hl-signals')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setSignals(d.signals ?? []) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  const shown = signals ? (showAll ? signals : signals.slice(0, 5)) : null
  const remaining = signals ? signals.length - (shown?.length ?? 0) : 0

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-white">{t('title')}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          {t('verifiedBadge')}
        </span>
      </div>

      {/* Feed head */}
      <div className="flex items-center justify-between px-1 pb-2">
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
            <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
          ))}
        {shown?.map((s) => <SignalCard key={s.id} s={s} t={t} />)}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 py-3 text-[12.5px] font-semibold text-emerald-300 transition-colors hover:bg-zinc-900/70 hover:text-emerald-200"
        >
          {tc('viewAll')} ({remaining})
        </button>
      )}
    </div>
  )
}

function SignalCard({ s, t }: { s: HlSignal; t: ReturnType<typeof useTranslations> }) {
  const [open, setOpen] = useState(false)
  const win = s.type === 'closed_win'
  const isLong = s.direction === 'long'
  // 折叠时遮住盈亏金额（保留红绿与正负号，和 Closed/loss 徽章一致），展开才揭晓。
  const pnlText = open ? fmtMoney(s.pnlUsd) : `${win ? '+' : '−'}$****`

  return (
    <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-900/60">
      {/* Collapsed header — profit always visible; click to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col gap-3 p-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/60"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold tracking-wide ${isLong ? 'border-emerald-500/25 text-emerald-400' : 'border-red-500/25 text-red-400'}`}>
            <span>{isLong ? '▲' : '▼'}</span>{isLong ? t('long') : t('short')}
          </span>
          <span className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${win ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {win ? t('statusClosed') : t('statusLoss')}
            </span>
            <span className={`text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>›</span>
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <span className="text-[20px] font-bold leading-none tracking-tight text-white">{s.coin}</span>
          <div className="text-right leading-none">
            <div className={`text-[24px] font-bold tabular-nums tracking-tight ${win ? 'text-emerald-400' : 'text-red-400'}`}>{pnlText}</div>
            <div className="mt-1.5 text-[10.5px] text-zinc-500">{t('realizedPnl')}</div>
          </div>
        </div>
      </button>

      {/* Expanded — real trade breakdown; open/close tx sit inside entry/exit cells */}
      {open && (
        <div className="border-t border-zinc-800 px-3.5 py-3">
          <div className="grid grid-cols-3 gap-2">
            <Cell k={t('entry')} v={`@${fmtPrice(s.entryPrice)}`} txUrl={s.openVerifyUrl} txHash={s.openTxHash} />
            <Cell k={t('exit')} v={`@${fmtPrice(s.exitPrice)}`} txUrl={s.verifyUrl} txHash={s.txHash} />
            <Cell k={t('notional')} v={`$${Math.round(s.sizeUsd).toLocaleString('en-US')}`} />
          </div>
        </div>
      )}
    </div>
  )
}

function Cell({ k, v, txUrl, txHash }: { k: string; v: string; txUrl?: string; txHash?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
      <span className="text-[9px] uppercase tracking-wider text-zinc-500">{k}</span>
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[12.5px] font-semibold tabular-nums text-white/90">{v}</span>
        {txUrl && txHash && (
          <a href={txUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap font-mono text-[10px] text-emerald-300 hover:text-emerald-200">
            {shortHash(txHash)}<span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </div>
  )
}
