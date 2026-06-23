'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { NextIntlClientProvider } from 'next-intl'
import { StakeSuccessScreen } from '../../../(dashboard)/alpha/components/StakeSuccessScreen'
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config'

import en from '@/messages/en.json'
import zh from '@/messages/zh.json'
import fr from '@/messages/fr.json'
import id from '@/messages/id.json'
import vi from '@/messages/vi.json'
import hi from '@/messages/hi.json'
import ar from '@/messages/ar.json'
import ur from '@/messages/ur.json'

const MESSAGES: Record<Locale, Record<string, unknown>> = { en, zh, fr, id, vi, hi, ar, ur }

// Mirrors the on-chain tier table used in AlphaClient
const TIERS = [
  { days: 15,  dailyRate: 1.0 },
  { days: 30,  dailyRate: 1.1 },
  { days: 60,  dailyRate: 1.2 },
  { days: 150, dailyRate: 1.3 },
  { days: 300, dailyRate: 1.5 },
] as const

const RTL: Locale[] = ['ar', 'ur']

export default function StakeSuccessPreviewPage() {
  const [locale, setLocale] = useState<Locale>('zh')
  const [amount, setAmount] = useState('1000')
  const [tierIndex, setTierIndex] = useState(1) // 30-day
  const [positionId, setPositionId] = useState('42')
  const [txHash, setTxHash] = useState('0x3a9f8c2b7e1d4a6f9c0b2e5d8a1f4c7b0e3d6a9c2f5b8e1d4a7c0f3b6e9d2a5c')
  const [walletAddress, setWalletAddress] = useState('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
  const [referralCode, setReferralCode] = useState('POLN8X')

  // Capture "now" once per render-of-preview; re-captured when replaying.
  const [startSec, setStartSec] = useState(() => Math.floor(Date.now() / 1000))
  const [replayKey, setReplayKey] = useState(0)

  const tier = TIERS[tierIndex]
  const unlockSec = startSec + tier.days * 86_400

  const replay = () => {
    setStartSec(Math.floor(Date.now() / 1000))
    setReplayKey(k => k + 1)
  }

  const dir = RTL.includes(locale) ? 'rtl' : 'ltr'

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <h1 className="text-lg font-bold">AlphaStake 质押成功页 · 预览</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* ── Controls ── */}
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <Field label="Language 语言">
              <select
                value={locale}
                onChange={e => setLocale(e.target.value as Locale)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              >
                {locales.map(l => (
                  <option key={l} value={l}>{localeFlags[l]} {localeNames[l]} ({l})</option>
                ))}
              </select>
            </Field>

            <Field label="质押金额 (USDC)">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="锁仓周期">
              <select
                value={tierIndex}
                onChange={e => setTierIndex(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              >
                {TIERS.map((tr, i) => (
                  <option key={tr.days} value={i}>{tr.days} 天 · {tr.dailyRate}%/天 · {(tr.dailyRate * 365).toFixed(0)}% APY</option>
                ))}
              </select>
            </Field>

            <Field label="持仓编号 (Position ID)">
              <input
                type="number"
                value={positionId}
                onChange={e => setPositionId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="交易哈希 (txHash)">
              <input
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono"
              />
            </Field>

            <Field label="钱包地址">
              <input
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono"
              />
            </Field>

            <Field label="推广码 (referralCode)">
              <input
                value={referralCode}
                onChange={e => setReferralCode(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </Field>

            <button
              onClick={replay}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-semibold hover:bg-purple-500"
            >
              <RotateCcw className="h-4 w-4" /> 重播动画 (用当下时间)
            </button>

            <p className="text-xs text-zinc-500">
              质押时间用页面加载/重播时的当下时间;解押日期 = 当下 + {tier.days} 天。
            </p>
          </div>

          {/* ── Phone frame preview ── */}
          <div className="flex justify-center">
            <div
              dir={dir}
              className="relative h-[820px] w-[390px] overflow-hidden rounded-[40px] border-[10px] border-zinc-800 bg-white shadow-2xl"
            >
              <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Shanghai">
                <StakeSuccessScreen
                  key={`${replayKey}-${locale}`}
                  embedded
                  amount={parseFloat(amount) || 0}
                  tierDays={tier.days}
                  dailyRate={tier.dailyRate}
                  startTime={startSec}
                  unlockTime={unlockSec}
                  positionId={parseInt(positionId, 10) || 0}
                  txHash={txHash as `0x${string}`}
                  walletAddress={walletAddress}
                  referralCode={referralCode}
                  onDone={replay}
                  onViewPositions={replay}
                />
              </NextIntlClientProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  )
}
