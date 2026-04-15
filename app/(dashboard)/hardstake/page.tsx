'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, ArrowUpRight, Info, Loader2, Minus, Plus } from 'lucide-react'

const DAILY_RATE = 1.3
const APY = ((1 + DAILY_RATE / 100) ** 365 - 1) * 100

// ─── Mock position data ───────────────────────────────────────────────────────
const MOCK = {
  staked: 500,
  pending: 32.5,
  totalEarned: 87.3,
  nextRewardIn: 14400,
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { display: `${pad(h)}:${pad(m)}:${pad(s)}`, progress: 1 - secs / 86400 }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HardStakePage() {
  const [amount, setAmount] = useState('')
  const [tab, setTab] = useState<'stake' | 'unstake'>('stake')
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const hasPosition = true
  const { display: countdown, progress } = useCountdown(MOCK.nextRewardIn)

  const num = parseFloat(amount) || 0
  const daily = num * DAILY_RATE / 100
  const monthly = daily * 30
  const yearly = daily * 365

  const handleAction = useCallback(async () => {
    if (!amount || num <= 0) return
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 1800))
    setIsLoading(false)
    setAmount('')
  }, [amount, num])

  const handleClaim = useCallback(async () => {
    setIsClaiming(true)
    await new Promise(r => setTimeout(r, 1200))
    setIsClaiming(false)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* ── Page title ──────────────────────────────────────────────────── */}
        <div className="mb-10 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Polygon · USDC</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Hard Stake</h1>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900">{DAILY_RATE}%</span>
            <span className="text-sm text-gray-400">daily · {APY.toFixed(0)}% APY</span>
          </div>
        </div>

        {/* ── Position summary (if staked) ────────────────────────────────── */}
        {hasPosition && (
          <div className="mb-8 grid grid-cols-3 divide-x divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50">
            {[
              { label: 'Staked', value: `$${MOCK.staked.toLocaleString()}`, sub: 'USDC locked' },
              { label: 'Pending Rewards', value: `$${MOCK.pending.toFixed(2)}`, sub: 'Claimable now' },
              { label: 'Total Earned', value: `$${MOCK.totalEarned.toFixed(2)}`, sub: 'All time' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="px-6 py-5">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Main 2-col layout ───────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-5">

          {/* LEFT: Input card */}
          <div className="lg:col-span-3 rounded-2xl border border-gray-100 bg-white p-6">

            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
              {(['stake', 'unstake'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-all ${
                    tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Amount (USDC)</span>
                <div className="flex items-center gap-1">
                  {['100', '500', '1000'].map(v => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 focus-within:border-gray-400 transition-colors">
                <span className="text-gray-300">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="flex-1 text-2xl font-bold text-gray-900 placeholder:text-gray-200 focus:outline-none bg-transparent"
                />
                <div className="flex items-center gap-2">
                  <button onClick={() => setAmount(String(Math.max(0, num - 100)))} className="rounded-lg border border-gray-200 p-1 hover:bg-gray-50 transition-colors">
                    <Minus className="h-3 w-3 text-gray-400" />
                  </button>
                  <button onClick={() => setAmount(String(num + 100))} className="rounded-lg border border-gray-200 p-1 hover:bg-gray-50 transition-colors">
                    <Plus className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Reward preview */}
            {num > 0 && (
              <div className="mb-4 space-y-2 rounded-xl bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Daily return</span>
                  <span className="font-semibold text-gray-900">+${daily.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">After 30 days</span>
                  <span className="font-semibold text-gray-900">+${monthly.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-400">After 1 year</span>
                  <span className="font-bold text-gray-900">+${yearly.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleAction}
              disabled={isLoading || num <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing…</>
              ) : tab === 'stake' ? (
                <>{num > 0 ? `Stake $${num.toLocaleString()} USDC` : 'Enter an amount'} <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Unstake USDC <ArrowRight className="h-4 w-4" /></>
              )}
            </button>

            {/* Countdown */}
            {hasPosition && (
              <div className="mt-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Next reward</span>
                  <span className="font-mono text-gray-600">{countdown}</span>
                </div>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-all duration-1000"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Claim + steps */}
          <div className="lg:col-span-2 space-y-4">

            {/* Claim */}
            {hasPosition ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <p className="text-xs text-gray-400 mb-1">Claimable now</p>
                <p className="text-3xl font-black text-gray-900 mb-4">
                  ${MOCK.pending.toFixed(2)}
                  <span className="text-sm font-normal text-gray-400 ml-1">USDC</span>
                </p>
                <button
                  onClick={handleClaim}
                  disabled={isClaiming}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 disabled:opacity-30"
                >
                  {isClaiming ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</>
                  ) : (
                    <>Claim to wallet <ArrowUpRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">No active position</p>
                <p className="text-xs text-gray-300 mt-1">Stake USDC to start earning</p>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                How it works
              </p>
              <ol className="space-y-4">
                {[
                  ['Stake USDC', 'Sign a gasless permit. Your USDC is locked on-chain.'],
                  ['Earn daily', '1.3% is credited to your account every 24 hours.'],
                  ['Claim anytime', 'Withdraw rewards or principal whenever you want.'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Disclaimer */}
            <div className="flex gap-2 rounded-xl bg-gray-50 p-4">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-300" />
              <p className="text-[11px] leading-relaxed text-gray-400">
                Staking uses EIP-2612 permit signatures on Polygon. No gas needed from your wallet.
              </p>
            </div>
          </div>
        </div>

        {/* ── Rate table ──────────────────────────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            {[
              { label: 'Daily', value: '1.3%' },
              { label: 'Weekly', value: `${(((1.013 ** 7) - 1) * 100).toFixed(2)}%` },
              { label: 'Monthly', value: `${(((1.013 ** 30) - 1) * 100).toFixed(2)}%` },
              { label: 'Annual', value: `${APY.toFixed(0)}%` },
            ].map(({ label, value }, i) => (
              <div key={label} className={`px-4 py-5 text-center ${i === 3 ? 'bg-gray-900' : 'bg-white'}`}>
                <p className={`text-xs ${i === 3 ? 'text-gray-400' : 'text-gray-400'}`}>{label}</p>
                <p className={`mt-1 text-xl font-black ${i === 3 ? 'text-white' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Transaction history ─────────────────────────────────────────── */}
        {hasPosition && (
          <div className="mt-6 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Recent activity</p>
            </div>
            {[
              { type: 'Reward', amount: '+$6.50', time: '12h ago' },
              { type: 'Reward', amount: '+$6.50', time: '1d ago' },
              { type: 'Deposit', amount: '+$500.00', time: '13d ago' },
            ].map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${tx.type === 'Deposit' ? 'bg-gray-900' : 'bg-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{tx.type}</p>
                    <p className="text-xs text-gray-400">{tx.time}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{tx.amount}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
