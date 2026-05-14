'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface AccruingTickerProps {
  /** Full one-day reward = USDC balance × tier daily rate */
  targetDaily: number
  /** ISO timestamp from airdrop_config.last_distribution_at; null = never distributed */
  lastDistributionAt: string | null
  /** Distribution interval in seconds (typically 86400) */
  intervalSeconds: number
  /** Whether the user has signed the permit — gate for showing the ticker */
  hasSignature: boolean
  /** When true: larger text, no label, gated states return null */
  inline?: boolean
}

/**
 * Cosmetic per-second ticker showing the profit accruing toward the next
 * admin distribution. Hard-capped at `targetDaily` — the user never sees a
 * number larger than one day's worth, no matter how long the page is open.
 *
 * Resets to ~0 when admin distributes (because `lastDistributionAt` advances).
 */
export function AccruingTicker({
  targetDaily,
  lastDistributionAt,
  intervalSeconds,
  hasSignature,
  inline = false,
}: AccruingTickerProps) {
  const t = useTranslations('dashboard')
  const [accrued, setAccrued] = useState(0)

  useEffect(() => {
    if (!hasSignature || targetDaily <= 0 || !lastDistributionAt) {
      setAccrued(0)
      return
    }

    const startMs = new Date(lastDistributionAt).getTime()
    const intervalMs = intervalSeconds * 1000
    const perMs = targetDaily / intervalMs

    const compute = () => {
      const elapsedMs = Math.max(0, Math.min(Date.now() - startMs, intervalMs))
      setAccrued(Math.min(elapsedMs * perMs, targetDaily))
    }

    compute()
    const id = setInterval(compute, 1000)
    return () => clearInterval(id)
  }, [hasSignature, targetDaily, lastDistributionAt, intervalSeconds])

  if (!hasSignature || targetDaily <= 0 || !lastDistributionAt) {
    if (inline) return null
    const hint = !hasSignature
      ? t('accrualSignToActivate')
      : targetDaily <= 0
        ? t('accrualNeedsBalance')
        : t('accrualWaitingFirstCycle')
    return <span className="text-[10px] text-white/30 leading-none mt-1">{hint}</span>
  }

  return (
    <span className="inline-flex items-center gap-2">
      {inline && <span className="text-white/30 text-sm leading-none">|</span>}
      <span
        className={`${inline ? 'text-sm' : 'text-[10px] mt-1'} text-[#00e28a]/80 leading-none poly-mono tabular-nums whitespace-nowrap`}
        title={t('accrualTooltip')}
      >
        +${accrued.toFixed(6)}{!inline && ` ${t('accrualLabel')}`}
      </span>
    </span>
  )
}
