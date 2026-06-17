'use client'

import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { ALPHA_STAKE_ABI, getAlphaStakeAddress } from '@/lib/alphastake'

// Tier daily rates (mirror of AlphaClient's TIERS) for accrued-earnings math.
const TIERS = [
  { days: 15, dailyRate: 1.0 },
  { days: 30, dailyRate: 1.1 },
  { days: 60, dailyRate: 1.2 },
  { days: 150, dailyRate: 1.3 },
  { days: 300, dailyRate: 1.5 },
] as const

/**
 * On-chain value of a user's open AlphaStake positions (principal + accrued
 * earnings), read for the bound/connected wallet. Public read — no wallet
 * connection required, just an address. Used to fold staked assets into the
 * dashboard's Total Assets.
 */
export function useAlphaStakedValue(walletAddress?: string | null) {
  const publicClient = usePublicClient({ chainId: polygon.id })
  const [stakedValue, setStakedValue] = useState(0)
  const [positionCount, setPositionCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const address = getAlphaStakeAddress()
    if (!walletAddress || !publicClient || !address) {
      setStakedValue(0)
      setPositionCount(0)
      setIsLoading(false)
      return
    }

    ;(async () => {
      setIsLoading(true)
      try {
        const ids = await publicClient.readContract({
          address,
          abi: ALPHA_STAKE_ABI,
          functionName: 'getUserPositions',
          args: [walletAddress as `0x${string}`],
        })

        const raw = await Promise.all(
          ids.map((id) =>
            publicClient.readContract({
              address,
              abi: ALPHA_STAKE_ABI,
              functionName: 'getPosition',
              args: [id],
            }),
          ),
        )

        const nowSec = Math.floor(Date.now() / 1000)
        let total = 0
        let count = 0
        for (const p of raw) {
          const [, amount, tierId, startTime, , closed] = p
          if (closed) continue
          const tier = TIERS[Math.min(Number(tierId), TIERS.length - 1)]
          const principal = Number(formatUnits(amount, 6))
          const daysElapsed = Math.min(
            tier.days,
            Math.floor((nowSec - Number(startTime)) / 86400),
          )
          const accrued = principal * (tier.dailyRate / 100) * daysElapsed
          total += principal + accrued
          count++
        }

        if (alive) {
          setStakedValue(total)
          setPositionCount(count)
        }
      } catch {
        // RPC hiccup — keep zeros, never block the dashboard
      } finally {
        if (alive) setIsLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [walletAddress, publicClient])

  return { stakedValue, positionCount, isLoading }
}
