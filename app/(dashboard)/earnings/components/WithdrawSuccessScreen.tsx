'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, ExternalLink, Copy, Check, CalendarDays, Wallet, Users } from 'lucide-react'

type Props = {
  amount: number            // this withdrawal, USD
  txHash: string
  totalWithdrawn: number    // lifetime withdrawn, USD
  registeredAt?: string | null  // ISO timestamp
  teamVolume: number        // L1-3 team sales, USD
  walletAddress?: string | null
  onDone: () => void
  onViewBreakdown: () => void
  /** Render absolutely inside a parent frame (for admin preview) instead of fixed full-screen. */
  embedded?: boolean
}

const FX = `
@keyframes wsCheckDraw {
  from { stroke-dashoffset: 48; }
  to   { stroke-dashoffset: 0; }
}
@keyframes wsRingDraw {
  from { stroke-dashoffset: 220; }
  to   { stroke-dashoffset: 0; }
}
@keyframes wsRise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ws-rise { animation: wsRise .5s ease-out both; }
`

function daysSince(iso?: string | null): number {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

const usd = (n: number) =>
  n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function WithdrawSuccessScreen({
  amount,
  txHash,
  totalWithdrawn,
  registeredAt,
  teamVolume,
  walletAddress,
  onDone,
  onViewBreakdown,
  embedded = false,
}: Props) {
  const t = useTranslations('earnings.withdrawSuccess')
  const [copied, setCopied] = useState(false)

  const days = daysSince(registeredAt)
  const maskedHash = `${txHash.slice(0, 10)}…${txHash.slice(-8)}`
  const maskedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(txHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 z-[60] overflow-y-auto bg-white text-zinc-900`}>
      <style dangerouslySetInnerHTML={{ __html: FX }} />

      {/* Soft gradient glow — top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, rgba(0,226,138,0.16) 0%, rgba(168,85,247,0.10) 40%, rgba(255,255,255,0) 72%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-sm flex-col px-6 py-10">

        {/* Brand */}
        <div className="ws-rise flex items-center gap-2 self-center" style={{ animationDelay: '0ms' }}>
          <Image src="/logo.svg" alt="PolNation" width={22} height={22} priority />
          <span className="text-sm font-bold tracking-tight text-zinc-900">PolNation</span>
        </div>

        {/* Animated success check */}
        <div className="mt-9 self-center" style={{ animation: 'wsRise .5s ease-out both' }}>
          <svg width="76" height="76" viewBox="0 0 84 84" fill="none">
            <circle cx="42" cy="42" r="35" stroke="rgba(0,226,138,0.18)" strokeWidth="6" />
            <circle
              cx="42" cy="42" r="35"
              stroke="url(#wsGrad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray="220" transform="rotate(-90 42 42)"
              style={{ animation: 'wsRingDraw .9s ease-out .15s both' }}
            />
            <path
              d="M28 43 L38 53 L57 32"
              stroke="url(#wsGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="48"
              style={{ animation: 'wsCheckDraw .4s ease-out .7s both' }}
            />
            <defs>
              <linearGradient id="wsGrad" x1="14" y1="14" x2="70" y2="70" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00e28a" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title */}
        <h1 className="ws-rise mt-5 self-center text-2xl font-black tracking-tight text-zinc-900" style={{ animationDelay: '.9s' }}>
          {t('title')}
        </h1>
        <p className="ws-rise mt-1.5 self-center text-sm text-zinc-500" style={{ animationDelay: '1s' }}>
          {t('subtitle')}
        </p>

        {/* Big amount — this withdrawal */}
        <div className="ws-rise mt-7 self-center text-center" style={{ animationDelay: '1.05s' }}>
          <p
            className="text-5xl font-black leading-none tracking-tight text-zinc-900"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            ${usd(amount)}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            USDC · {t('thisWithdrawal')}
          </p>
        </div>

        {/* Tx hash card — prominent */}
        <div
          className="ws-rise mt-7 w-full rounded-2xl border border-zinc-100 bg-white p-4"
          style={{ animationDelay: '1.15s', boxShadow: '0 12px 40px -12px rgba(0,226,138,0.20), 0 4px 12px -6px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{t('txHash')}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <code className="truncate text-[13px] text-zinc-700" style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {maskedHash}
            </code>
            <button
              onClick={copyHash}
              className="shrink-0 rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
              aria-label="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-purple-600 hover:text-purple-700"
          >
            {t('viewTx')} <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Stats card */}
        <div
          className="ws-rise mt-4 w-full rounded-2xl border border-zinc-100 bg-zinc-50/60"
          style={{ animationDelay: '1.25s' }}
        >
          <div className="divide-y divide-zinc-100">
            <StatRow icon={<Wallet className="h-4 w-4" />} label={t('totalWithdrawn')} value={`$${usd(totalWithdrawn)}`} />
            <StatRow icon={<CalendarDays className="h-4 w-4" />} label={t('memberSince')} value={t('daysValue', { days })} />
            <StatRow icon={<Users className="h-4 w-4" />} label={t('teamVolume')} value={`$${usd(teamVolume)}`} />
          </div>
          {maskedWallet && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] text-zinc-400">{t('sentTo')}</span>
              <code className="text-[11px] text-zinc-500" style={{ fontFamily: 'var(--poly-font-mono)' }}>{maskedWallet}</code>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ws-rise mt-auto w-full pt-8" style={{ animationDelay: '1.35s' }}>
          <button
            onClick={onViewBreakdown}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #00b873 0%, #7c3aed 100%)',
              boxShadow: '0 10px 30px -8px rgba(124,58,237,0.45)',
            }}
          >
            {t('viewBreakdown')} <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            onClick={onDone}
            className="mt-2 w-full py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="flex items-center gap-2 text-[13px] text-zinc-500">
        <span className="text-zinc-400">{icon}</span>
        {label}
      </span>
      <span className="text-[15px] font-bold text-zinc-900" style={{ fontFamily: 'var(--poly-font-mono)' }}>
        {value}
      </span>
    </div>
  )
}
