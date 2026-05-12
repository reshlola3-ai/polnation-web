'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Lock, TrendingUp, Zap, ArrowUpRight,
  Loader2, Info, ChevronRight, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ─── Constants ────────────────────────────────────────────────────────────────
const DAILY_RATE = 1.3
const APY = ((1 + DAILY_RATE / 100) ** 365 - 1) * 100

const MOCK = {
  staked: 500,
  pending: 32.5,
  totalEarned: 87.3,
  daysActive: 13,
  nextRewardIn: 14400,
}

const HISTORY = [
  { type: 'Reward', amount: '+$6.50', time: '12h ago', isDeposit: false },
  { type: 'Reward', amount: '+$6.50', time: '1d ago', isDeposit: false },
  { type: 'Deposit', amount: '+$500.00', time: '13d ago', isDeposit: true },
]

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return { display: `${h}:${m}:${s}`, progress: 1 - secs / 86400 }
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="glass-card-solid p-4 flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`stat-number text-xl font-bold ${accent ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  )
}

// ─── Rate cell ────────────────────────────────────────────────────────────────
function RateCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center py-5 gap-1 ${highlight ? 'bg-cyan-500/5 border-x border-cyan-500/10' : ''}`}>
      <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`stat-number text-2xl font-black ${highlight ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Polygon · USDC · Hard Stake
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hard Stake</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Lock USDC on-chain. Earn <span className="text-white font-semibold">{DAILY_RATE}%</span> every 24 hours.
          </p>
        </div>

        {/* APY badge */}
        <div className="glass-card-solid px-6 py-4 border border-cyan-500/20 text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Est. APY</p>
          <p className="stat-number text-4xl font-black text-cyan-400">{APY.toFixed(0)}%</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">non-compounding · 1.3%/day</p>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      {hasPosition && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="You Staked" value={`$${MOCK.staked.toLocaleString()}`} sub="USDC locked" />
          <StatTile label="Pending Rewards" value={`$${MOCK.pending.toFixed(2)}`} sub="Ready to claim" accent />
          <StatTile label="Total Earned" value={`$${MOCK.totalEarned.toFixed(2)}`} sub="All time" />
          <StatTile label="Days Active" value={`${MOCK.daysActive}d`} sub={`$${(MOCK.staked * DAILY_RATE / 100).toFixed(2)}/day`} />
        </div>
      )}

      {/* ── Main 2-col ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* LEFT: Stake input */}
        <div className="lg:col-span-3 glass-card-solid overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            {(['stake', 'unstake'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative flex-1 py-4 text-sm font-semibold capitalize transition-colors ${
                  tab === t ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab === t && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-cyan-400" />
                )}
                {t}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">

            {/* Amount input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Amount</span>
                <div className="flex gap-1">
                  {['100', '500', '1000'].map(v => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-zinc-400 hover:border-purple-500/40 hover:text-purple-400 transition-all"
                    >
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 focus-within:border-purple-500/40 transition-colors">
                <span className="text-zinc-600 text-lg">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent text-3xl font-bold text-white placeholder:text-zinc-700 focus:outline-none stat-number"
                />
                <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 shrink-0">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-zinc-300">USDC</span>
                </div>
              </div>
            </div>

            {/* Reward preview */}
            {num > 0 && (
              <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.05] p-4 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-400/60">
                  Projected Returns
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Daily (1.3%)</span>
                  <span className="stat-number text-sm font-bold text-green-400">+${daily.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">30 days</span>
                  <span className="stat-number text-sm font-semibold text-zinc-300">+${monthly.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/[0.06] pt-2.5">
                  <span className="text-sm text-zinc-500">1 year</span>
                  <span className="stat-number text-base font-black text-cyan-400">+${yearly.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* CTA */}
            <Button
              onClick={handleAction}
              disabled={isLoading || num <= 0}
              className="w-full py-3.5 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing Permit…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" />
                  {num > 0 ? `${tab === 'stake' ? 'Stake' : 'Unstake'} $${num.toLocaleString()} USDC` : 'Enter an amount'}
                </span>
              )}
            </Button>

            {/* Countdown bar */}
            {hasPosition && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600">Next reward</span>
                  <span className="stat-number text-xs text-zinc-400">{countdown}</span>
                </div>
                <div className="h-px w-full overflow-hidden bg-white/[0.06]">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-1000"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Footnote */}
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-700" />
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Uses EIP-2612 permit signatures — no separate gas approval needed.
                USDC is transferred on-chain to the platform vault on Polygon.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Claim + info */}
        <div className="lg:col-span-2 space-y-4">

          {/* Claim card */}
          {hasPosition ? (
            <div className="glass-card-solid p-6 border border-cyan-500/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400">Claimable Rewards</p>
                </div>
              </div>
              <p className="stat-number text-4xl font-black text-white mb-0.5">
                ${MOCK.pending.toFixed(4)}
              </p>
              <p className="text-xs text-zinc-600 mb-5">USDC · sent directly to your wallet</p>

              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="withdraw-pulse w-full rounded-xl px-4 py-3 text-sm font-bold text-cyan-300 transition-all hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.08) 100%)',
                  border: '1px solid rgba(6,182,212,0.3)',
                }}
              >
                {isClaiming ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</>
                ) : (
                  <><ArrowUpRight className="h-4 w-4" /> Claim to Wallet</>
                )}
              </button>
            </div>
          ) : (
            <div className="glass-card-solid p-6 border border-dashed border-white/[0.06] text-center">
              <Lock className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No active position</p>
              <p className="text-xs text-zinc-700 mt-1">Stake USDC to start earning 1.3% daily</p>
            </div>
          )}

          {/* How it works */}
          <div className="glass-card-solid p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">How it works</p>
            <div className="space-y-4">
              {[
                { icon: Lock, label: 'Stake USDC', desc: 'Sign a gasless permit. Your USDC locks on-chain.' },
                { icon: Zap, label: 'Earn 1.3% daily', desc: 'Rewards credited every 24 hours automatically.' },
                { icon: ArrowUpRight, label: 'Claim anytime', desc: 'Withdraw rewards or principal whenever you want.' },
              ].map(({ icon: Icon, label, desc }, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Icon className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Shield, label: 'Non-Custodial' },
              { icon: Zap, label: 'Gasless' },
              { icon: Lock, label: 'On-chain' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="glass-card-solid flex flex-col items-center gap-1.5 py-3">
                <Icon className="h-3.5 w-3.5 text-zinc-500" />
                <p className="text-[10px] font-semibold text-zinc-500 text-center">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rate table ─────────────────────────────────────────────────────── */}
      <div className="glass-card-solid overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Rate Schedule</p>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
            Fixed · Hard Stake
          </span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-white/[0.05]">
          <RateCell label="Daily" value="1.3%" />
          <RateCell label="Weekly" value={`${(((1.013 ** 7) - 1) * 100).toFixed(2)}%`} />
          <RateCell label="Monthly" value={`${(((1.013 ** 30) - 1) * 100).toFixed(2)}%`} />
          <RateCell label="Annual" value={`${APY.toFixed(0)}%`} highlight />
        </div>
      </div>

      {/* ── History ────────────────────────────────────────────────────────── */}
      {hasPosition && (
        <div className="glass-card-solid overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white">Recent Activity</p>
            <button className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {HISTORY.map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${tx.isDeposit ? 'bg-purple-500' : 'bg-cyan-400'}`} />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{tx.type}</p>
                  <p className="text-xs text-zinc-600">{tx.time}</p>
                </div>
              </div>
              <span className={`stat-number text-sm font-bold ${tx.isDeposit ? 'text-purple-400' : 'text-cyan-400'}`}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
