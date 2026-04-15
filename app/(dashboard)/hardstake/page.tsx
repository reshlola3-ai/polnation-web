'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Lock,
  TrendingUp,
  Zap,
  Shield,
  ChevronRight,
  ArrowUpRight,
  Clock,
  Wallet,
  CheckCircle2,
  Loader2,
  Info,
  Coins,
} from 'lucide-react'

// ─── Mock data (replace with real API calls) ─────────────────────────────────
const MOCK_POSITION = {
  staked: 500,
  pendingRewards: 32.5,
  totalEarned: 87.3,
  daysActive: 13,
  nextRewardIn: 14400, // seconds
}
const DAILY_RATE = 1.3
const APY = ((1 + DAILY_RATE / 100) ** 365 - 1) * 100

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent = 'blue',
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'blue' | 'emerald' | 'amber' | 'violet'
  icon: React.ElementType
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10 ring-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
    violet: 'text-violet-400 bg-violet-500/10 ring-violet-500/20',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const progress = 1 - seconds / 86400
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Next reward distribution</span>
        <span className="font-mono text-white">{pad(h)}:{pad(m)}:{pad(s)}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── How it works step ────────────────────────────────────────────────────────
function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-400">
        {num}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HardStakePage() {
  const [amount, setAmount] = useState('')
  const [tab, setTab] = useState<'stake' | 'unstake'>('stake')
  const [isStaking, setIsStaking] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [hasPosition] = useState(true) // toggle to false to see empty state
  const [position] = useState(MOCK_POSITION)
  const [countdown, setCountdown] = useState(MOCK_POSITION.nextRewardIn)

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const estimatedDaily = amount ? (parseFloat(amount) * DAILY_RATE) / 100 : 0
  const estimated30d = estimatedDaily * 30
  const estimated365d = estimatedDaily * 365

  const handleStake = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setIsStaking(true)
    await new Promise(r => setTimeout(r, 2000)) // replace with real call
    setIsStaking(false)
    setAmount('')
  }, [amount])

  const handleClaim = useCallback(async () => {
    setIsClaiming(true)
    await new Promise(r => setTimeout(r, 1500))
    setIsClaiming(false)
  }, [])

  return (
    <div className="min-h-screen bg-[#060914] text-white">
      {/* ── Ambient glows ──────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              Live · Polygon Mainnet
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Hard Stake
            </h1>
            <p className="mt-2 text-zinc-400">
              Lock USDC. Earn <span className="font-semibold text-white">1.3%</span> every 24 hours.
            </p>
          </div>

          {/* APY badge */}
          <div className="flex items-end gap-1">
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 px-6 py-4 text-right">
              <p className="text-xs font-medium uppercase tracking-widest text-amber-500/70">Est. APY</p>
              <p className="text-4xl font-black text-amber-400">{APY.toFixed(0)}%</p>
              <p className="text-xs text-amber-500/60">1.3% daily · compounding</p>
            </div>
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        {hasPosition && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="You Staked"
              value={`$${position.staked.toLocaleString()}`}
              sub="USDC locked"
              accent="blue"
              icon={Lock}
            />
            <StatCard
              label="Pending Rewards"
              value={`$${position.pendingRewards.toFixed(2)}`}
              sub="Claimable now"
              accent="emerald"
              icon={Coins}
            />
            <StatCard
              label="Total Earned"
              value={`$${position.totalEarned.toFixed(2)}`}
              sub="All time"
              accent="violet"
              icon={TrendingUp}
            />
            <StatCard
              label="Days Active"
              value={`${position.daysActive}d`}
              sub={`$${(position.staked * DAILY_RATE / 100).toFixed(2)}/day`}
              accent="amber"
              icon={Clock}
            />
          </div>
        )}

        {/* ── Main content: 2-col layout ───────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-5">

          {/* LEFT: Stake card */}
          <div className="lg:col-span-3">
            <div className="overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm">

              {/* Tabs */}
              <div className="flex border-b border-white/[0.06]">
                {(['stake', 'unstake'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-4 text-sm font-semibold capitalize transition-colors ${
                      tab === t
                        ? 'border-b-2 border-blue-500 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-5">
                {/* Amount input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                      Amount
                    </label>
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => setAmount(tab === 'stake' ? '500' : String(position.staked))}
                    >
                      Max
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 pr-20 text-2xl font-bold text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1">
                      <div className="h-4 w-4 rounded-full bg-blue-500" />
                      <span className="text-sm font-semibold text-zinc-300">USDC</span>
                    </div>
                  </div>
                </div>

                {/* Live reward preview */}
                {amount && parseFloat(amount) > 0 && (
                  <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-blue-400/70 mb-3">
                      Projected Returns
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Daily (1.3%)</span>
                      <span className="font-semibold text-emerald-400">+${estimatedDaily.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">30 days</span>
                      <span className="font-semibold text-white">+${estimated30d.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">1 year</span>
                      <span className="font-bold text-amber-400">+${estimated365d.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-white/[0.06]">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Total after 1yr</span>
                        <span className="font-bold text-white">
                          ${(parseFloat(amount) + estimated365d).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={handleStake}
                  disabled={isStaking || !amount || parseFloat(amount) <= 0}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {isStaking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing Permit…
                      </>
                    ) : tab === 'stake' ? (
                      <>
                        <Zap className="h-4 w-4" />
                        {amount && parseFloat(amount) > 0
                          ? `Stake $${parseFloat(amount).toLocaleString()} USDC`
                          : 'Enter Amount to Stake'}
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-4 w-4" />
                        Unstake USDC
                      </>
                    )}
                  </span>
                </button>

                {/* Countdown */}
                {hasPosition && <Countdown seconds={countdown} />}

                {/* Security note */}
                <div className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <p className="text-[11px] leading-relaxed text-zinc-600">
                    Staking uses EIP-2612 permit signatures — no separate approval transaction needed.
                    Your USDC is transferred on-chain to the platform vault on Polygon.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Claim + Info */}
          <div className="lg:col-span-2 space-y-4">

            {/* Claim card */}
            {hasPosition ? (
              <div className="rounded-3xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] to-teal-500/[0.04] p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">Claimable Rewards</span>
                </div>
                <p className="text-4xl font-black text-white mb-1">
                  ${position.pendingRewards.toFixed(4)}
                </p>
                <p className="text-xs text-zinc-500 mb-5">USDC · sent directly to your wallet</p>
                <button
                  onClick={handleClaim}
                  disabled={isClaiming || position.pendingRewards === 0}
                  className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isClaiming ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowUpRight className="h-4 w-4" /> Claim to Wallet
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-400">No active position</p>
                <p className="mt-1 text-xs text-zinc-600">Stake USDC to start earning 1.3% daily</p>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6 backdrop-blur-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                How It Works
              </p>
              <div className="space-y-4">
                <Step
                  num="1"
                  title="Stake USDC"
                  desc="Enter an amount and sign a gasless EIP-2612 permit. Your USDC is locked in the platform vault."
                />
                <Step
                  num="2"
                  title="Earn 1.3% Daily"
                  desc="Rewards accrue every 24 hours based on your staked principal. No action needed."
                />
                <Step
                  num="3"
                  title="Claim Anytime"
                  desc="Claim pending rewards to your wallet anytime, or let them accumulate."
                />
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Shield, label: 'Non-Custodial', sub: 'On-chain' },
                { icon: Zap, label: 'Instant', sub: 'Gasless' },
                { icon: Lock, label: 'Audited', sub: 'Polygon' },
              ].map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.05] bg-white/[0.02] py-3 text-center"
                >
                  <Icon className="h-4 w-4 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-300">{label}</p>
                  <p className="text-[10px] text-zinc-600">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Rate breakdown ────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold text-white">Rate Schedule</p>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              Hard Stake · Fixed Rate
            </span>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.03] sm:grid-cols-4">
            {[
              { period: 'Daily', rate: '1.3%', highlight: false },
              { period: 'Weekly', rate: `${(((1.013 ** 7) - 1) * 100).toFixed(2)}%`, highlight: false },
              { period: 'Monthly', rate: `${(((1.013 ** 30) - 1) * 100).toFixed(2)}%`, highlight: false },
              { period: 'Annual', rate: `${APY.toFixed(0)}%`, highlight: true },
            ].map(({ period, rate, highlight }) => (
              <div
                key={period}
                className={`flex flex-col items-center py-5 ${highlight ? 'bg-amber-500/[0.06]' : ''}`}
              >
                <p className="text-xs text-zinc-500">{period}</p>
                <p className={`mt-1 text-2xl font-black ${highlight ? 'text-amber-400' : 'text-white'}`}>
                  {rate}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600">
            <Info className="h-3 w-3" />
            Rates shown are non-compounding. Compound returns are higher if rewards are restaked.
          </p>
        </div>

        {/* ── Transaction history placeholder ──────────────────────────────── */}
        {hasPosition && (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-white">Transaction History</p>
              <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { type: 'Reward', amount: '+$6.50', time: '12 hours ago', color: 'text-emerald-400' },
                { type: 'Reward', amount: '+$6.50', time: '1 day ago', color: 'text-emerald-400' },
                { type: 'Deposit', amount: '+$500.00', time: '13 days ago', color: 'text-blue-400' },
              ].map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-white/[0.025] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      tx.type === 'Deposit' ? 'bg-blue-400' : 'bg-emerald-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white">{tx.type}</p>
                      <p className="text-xs text-zinc-600">{tx.time}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${tx.color}`}>{tx.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
