'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Zap, ExternalLink, Loader2 } from 'lucide-react'
import type { AlphaSignal } from '@/lib/alpha-tracker/types'
import type { CopyTradeResult } from '@/lib/alpha-copy-trade'
import { hyperliquidTxUrl } from '@/lib/alpha-copy-trade'

function fmtUsd(n: number, signed = false): string {
  const abs = Math.abs(n)
  const str = abs >= 1000
    ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (!signed) return `$${str}`
  const prefix = n >= 0 ? '+$' : '-$'
  return `${prefix}${str}`
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

interface Props {
  signal: AlphaSignal
  accentColor: string
  open: boolean
  onClose: () => void
}

export function CopyTradeResultModal({ signal, accentColor, open, onClose }: Props) {
  const t = useTranslations('alpha.copyTrade')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CopyTradeResult | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setError('')
    setResult(null)

    const params = new URLSearchParams({
      id: signal.id,
      entity_name: signal.entity_name,
      pattern_id: signal.pattern_id,
      observed_at: signal.observed_at,
    })
    if (signal.token_symbol) params.set('token_symbol', signal.token_symbol)
    if (signal.amount_usd != null) params.set('amount_usd', String(signal.amount_usd))

    fetch(`/api/alpha/copy-trade-result?${params}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        if (!cancelled) setResult(data as CopyTradeResult)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [open, signal, t])

  if (!open) return null

  const profitPositive = (result?.profitUsd ?? 0) >= 0

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-trade-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(165deg, #12101a 0%, #0a090f 100%)',
          border: `1px solid ${accentColor}44`,
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-white/45"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            {t('modalLabel')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/50">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
              <p className="text-sm">{t('loading')}</p>
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-red-400 text-center py-8">{error}</p>
          )}

          {result && !loading && (
            <>
              <div
                className="rounded-xl p-4 mb-4"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}18 0%, rgba(0,226,138,0.08) 100%)`,
                  border: `1px solid ${accentColor}35`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                  <h2 id="copy-trade-title" className="text-base font-bold text-white tracking-tight">
                    {t('title')}
                  </h2>
                </div>
                <p className="text-[13px] text-white/60 leading-relaxed">
                  {t('subtitle', { entity: result.entityName })}
                </p>
                <p className="text-[11px] text-white/35 mt-2" style={{ fontFamily: 'var(--poly-font-mono)' }}>
                  {result.tokenSymbol} · {result.direction === 'long' ? t('long') : t('short')} · {t('viaHl')}
                </p>
              </div>

              <div
                className="grid grid-cols-3 gap-3 rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-center min-w-0">
                  <p
                    className="text-[9px] uppercase tracking-[0.12em] text-white/40 mb-1.5"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {t('capital')}
                  </p>
                  <p
                    className="text-lg font-bold text-white tabular-nums"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {fmtUsd(result.capitalUsd)}
                  </p>
                </div>
                <div className="text-center min-w-0">
                  <p
                    className="text-[9px] uppercase tracking-[0.12em] text-white/40 mb-1.5"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {t('leverage')}
                  </p>
                  <p
                    className="text-lg font-bold text-white tabular-nums"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {result.leverage.toFixed(1)}×
                  </p>
                </div>
                <div className="text-center min-w-0">
                  <p
                    className="text-[9px] uppercase tracking-[0.12em] text-white/40 mb-1.5"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {t('profit')}
                  </p>
                  <p
                    className="text-lg font-bold tabular-nums"
                    style={{
                      fontFamily: 'var(--poly-font-mono)',
                      color: profitPositive ? '#00e28a' : '#f87171',
                    }}
                  >
                    {fmtUsd(result.profitUsd, true)}
                  </p>
                  <p
                    className="text-[11px] mt-0.5 tabular-nums"
                    style={{
                      fontFamily: 'var(--poly-font-mono)',
                      color: profitPositive ? 'rgba(0,226,138,0.75)' : 'rgba(248,113,113,0.75)',
                    }}
                  >
                    ({fmtPct(result.priceMovePct)})
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-white/35 block mb-0.5">{t('entry')}</span>
                  <span className="text-white/70 tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>
                    ${result.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-white/35 block mb-0.5">{t('notional')}</span>
                  <span className="text-white/70 tabular-nums" style={{ fontFamily: 'var(--poly-font-mono)' }}>
                    {fmtUsd(result.notionalUsd)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                <span
                  className="text-[11px] text-white/40"
                  style={{ fontFamily: 'var(--poly-font-mono)' }}
                >
                  {t('liveAnchor', {
                    coin: result.coin,
                    price: `$${result.livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
                  })}
                </span>
                {result.hlTxHash && (
                  <a
                    href={hyperliquidTxUrl(result.hlTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {t('viewOnHl')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
