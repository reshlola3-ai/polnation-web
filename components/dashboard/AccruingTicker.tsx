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

  // Gated states — minimal, low-emphasis hints under the Withdrawable number.
  if (!hasSignature) {
    return (
      <span className="text-[10px] text-white/30 leading-none mt-1">
        {t('accrualSignToActivate')}
      </span>
    )
  }
  if (targetDaily <= 0) {
    return (
      <span className="text-[10px] text-white/30 leading-none mt-1">
        {t('accrualNeedsBalance')}
      </span>
    )
  }
  if (!lastDistributionAt) {
    return (
      <span className="text-[10px] text-white/30 leading-none mt-1">
        {t('accrualWaitingFirstCycle')}
      </span>
    )
  }

  return (
    <span
      className="text-[10px] text-[#00e28a]/80 leading-none mt-1 poly-mono tabular-nums whitespace-nowrap"
      title={t('accrualTooltip')}
    >
      +${accrued.toFixed(6)} {t('accrualLabel')}
    </span>
  )
}
