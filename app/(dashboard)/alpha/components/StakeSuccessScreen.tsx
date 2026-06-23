'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowUpRight, ExternalLink } from 'lucide-react'

type Props = {
  amount: number
  tierDays: number
  dailyRate: number
  startTime: number   // unix seconds
  unlockTime: number  // unix seconds
  positionId: number
  txHash?: string
  walletAddress?: string | null
  referralCode?: string | null
  onDone: () => void
  onViewPositions: () => void
  /** Render absolutely inside a parent frame (for admin preview) instead of fixed full-screen. */
  embedded?: boolean
}

const FX = `
@keyframes ssCheckDraw {
  from { stroke-dashoffset: 48; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ssRingDraw {
  from { stroke-dashoffset: 220; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ssRise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ssPop {
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
.ss-rise { animation: ssRise .5s ease-out both; }
`

// Local date (YYYY-MM-DD) and timestamp (YYYY-MM-DD HH:mm)
function fmtDate(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function fmtDateTime(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function StakeSuccessScreen({
  amount,
  tierDays,
  dailyRate,
  startTime,
  unlockTime,
  positionId,
  txHash,
  walletAddress,
  referralCode,
  onDone,
  onViewPositions,
  embedded = false,
}: Props) {
  const t = useTranslations('alpha')

  const totalEarnings = amount * (dailyRate / 100) * tierDays
  const dailyEarn = amount * (dailyRate / 100)
  const apy = dailyRate * 365

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.polnation.com'
  const qrValue = referralCode ? `${origin}/register?ref=${referralCode}` : origin
  const maskedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 z-[60] overflow-y-auto bg-white text-zinc-900`}>
      <style dangerouslySetInnerHTML={{ __html: FX }} />

      {/* Soft gradient glow — top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, rgba(168,85,247,0.14) 0%, rgba(34,211,238,0.10) 38%, rgba(255,255,255,0) 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-sm flex-col items-center px-6 py-10">

        {/* Brand */}
        <div className="ss-rise flex items-center gap-2" style={{ animationDelay: '0ms' }}>
          <Image src="/logo.svg" alt="PolNation" width={22} height={22} priority />
          <span className="text-sm font-bold tracking-tight text-zinc-900">PolNation</span>
        </div>

        {/* Animated success check */}
        <div className="mt-8" style={{ animation: 'ssPop .6s cubic-bezier(.34,1.56,.64,1) both' }}>
          <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
            <circle
              cx="42" cy="42" r="35"
              stroke="rgba(168,85,247,0.18)" strokeWidth="6"
            />
            <circle
              cx="42" cy="42" r="35"
              stroke="url(#ssGrad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray="220" transform="rotate(-90 42 42)"
              style={{ animation: 'ssRingDraw .9s ease-out .15s both' }}
            />
            <path
              d="M28 43 L38 53 L57 32"
              stroke="url(#ssGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="48"
              style={{ animation: 'ssCheckDraw .4s ease-out .7s both' }}
            />
            <defs>
              <linearGradient id="ssGrad" x1="14" y1="14" x2="70" y2="70" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a855f7" />
                <stop offset="1" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title */}
        <h1 className="ss-rise mt-5 text-2xl font-black tracking-tight text-zinc-900" style={{ animationDelay: '.9s' }}>
          {t('success.title')}
        </h1>
        <p className="ss-rise mt-1.5 text-sm text-zinc-500" style={{ animationDelay: '1s' }}>
          {t('success.subtitle')}
        </p>

        {/* Big amount */}
        <div className="ss-rise mt-7 text-center" style={{ animationDelay: '1.05s' }}>
          <p
            className="text-5xl font-black leading-none tracking-tight text-zinc-900"
            style={{ fontFamily: 'var(--poly-font-mono)' }}
          >
            ${amount.toLocaleString('en', { minimumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            USDC · {t('success.lockPeriod', { days: tierDays })}
          </p>
        </div>

        {/* Data card */}
        <div
          className="ss-rise mt-7 w-full rounded-2xl border border-zinc-100 bg-white"
          style={{ animationDelay: '1.15s', boxShadow: '0 12px 40px -12px rgba(99,102,241,0.18), 0 4px 12px -6px rgba(0,0,0,0.06)' }}
        >
          <div className="divide-y divide-zinc-100">
            <Row label={t('success.unlockDate')} value={fmtDate(unlockTime)} />
            <Row
              label={t('success.totalEarnings')}
              value={`+$${totalEarnings.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              accent
            />
            <Row
              label={t('success.dailyEarnings')}
              value={`+$${dailyEarn.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Row label={t('success.apy')} value={`${apy.toFixed(0)}%`} />
          </div>

          {/* Position + tx */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[11px] text-zinc-400" style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {t('success.position')} #{positionId}
            </span>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-600"
              >
                {t('success.viewTx')} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* QR + credential strip */}
        <div className="ss-rise mt-5 flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3" style={{ animationDelay: '1.25s' }}>
          <div className="rounded-lg bg-white p-1.5 shadow-sm">
            <QRCodeSVG value={qrValue} size={56} level="M" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-700">{t('success.scanToJoin')}</p>
            {maskedWallet && (
              <p className="mt-0.5 truncate text-[11px] text-zinc-400" style={{ fontFamily: 'var(--poly-font-mono)' }}>
                {maskedWallet}
              </p>
            )}
            <p className="text-[11px] text-zinc-400" style={{ fontFamily: 'var(--poly-font-mono)' }}>
              {t('success.stakedAt')} {fmtDateTime(startTime)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="ss-rise mt-auto w-full pt-8" style={{ animationDelay: '1.35s' }}>
          <button
            onClick={onDone}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              boxShadow: '0 10px 30px -8px rgba(124,58,237,0.5)',
            }}
          >
            {t('success.done')}
          </button>
          <button
            onClick={onViewPositions}
            className="mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {t('success.viewPositions')} <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px] text-zinc-500">{label}</span>
      <span
        className={`text-[15px] font-bold ${accent ? 'text-purple-600' : 'text-zinc-900'}`}
        style={{ fontFamily: 'var(--poly-font-mono)' }}
      >
        {value}
      </span>
    </div>
  )
}
