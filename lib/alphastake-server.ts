import {
  ALPHA_STAKE_ABI,
  ALPHA_TIERS,
  AUSDC_NATIVE_POLYGON,
  ERC20_BALANCE_ABI,
  getAlphaPublicClient,
  getAlphaStakeAddress,
  getAlphaStrategyAddress,
  usdcFromUnits,
  type OnChainPosition,
} from '@/lib/alphastake'

export async function fetchOnChainAlphaSummary() {
  const address = getAlphaStakeAddress()
  if (!address) {
    return {
      configured: false as const,
      contractAddress: null,
      summary: null,
      positions: [] as OnChainPosition[],
      pendingWithdrawals: [] as Array<{
        withdrawalId: number
        to: string
        amountUsdc: number
        executeAfter: string
        executed: boolean
        cancelled: boolean
        ready: boolean
      }>,
    }
  }

  const client = getAlphaPublicClient()
  const strategyAddress = getAlphaStrategyAddress()

  const [
    nextPositionId,
    totalStaked,
    aaveBalance,
    idleBalance,
    penaltyPool,
    minStake,
    owner,
    nextWithdrawalId,
  ] = await Promise.all([
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'nextPositionId' }),
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'totalStaked' }),
    strategyAddress
      ? client.readContract({
          address: AUSDC_NATIVE_POLYGON,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [strategyAddress],
        })
      : Promise.resolve(BigInt(0)),
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'idleBalance' }),
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'penaltyPool' }),
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'MIN_STAKE' }),
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'owner' }),
    client.readContract({ address, abi: ALPHA_STAKE_ABI, functionName: 'nextWithdrawalId' }),
  ])

  const totalAssets = idleBalance + aaveBalance
  const excessAaveUsdc = aaveBalance > totalStaked ? aaveBalance - totalStaked : BigInt(0)

  const positionCount = Number(nextPositionId)
  const positions: OnChainPosition[] = []
  const now = Math.floor(Date.now() / 1000)

  const positionReads = Array.from({ length: positionCount }, (_, i) =>
    client.readContract({
      address,
      abi: ALPHA_STAKE_ABI,
      functionName: 'getPosition',
      args: [BigInt(i)],
    })
  )

  const positionResults = positionReads.length > 0 ? await Promise.all(positionReads) : []

  for (let i = 0; i < positionResults.length; i++) {
    const [user, amount, tierId, startTime, unlockTime, closed] = positionResults[i]
    const tier = ALPHA_TIERS[Number(tierId)] ?? ALPHA_TIERS[0]
    let status: OnChainPosition['status'] = 'active'
    if (closed) status = 'closed'
    else if (Number(unlockTime) <= now) status = 'matured'

    positions.push({
      positionId: i,
      user: user.toLowerCase(),
      amountUsdc: usdcFromUnits(amount),
      amountRaw: amount.toString(),
      tierId: Number(tierId),
      tierDays: tier.days,
      startTime: new Date(Number(startTime) * 1000).toISOString(),
      unlockTime: new Date(Number(unlockTime) * 1000).toISOString(),
      closed,
      status,
    })
  }

  const withdrawalCount = Number(nextWithdrawalId)
  const pendingWithdrawals = []

  if (withdrawalCount > 0) {
    const withdrawalReads = Array.from({ length: withdrawalCount }, (_, i) =>
      client.readContract({
        address,
        abi: ALPHA_STAKE_ABI,
        functionName: 'pendingWithdrawals',
        args: [BigInt(i)],
      })
    )
    const withdrawalResults = await Promise.all(withdrawalReads)

    for (let i = 0; i < withdrawalResults.length; i++) {
      const [to, amount, executeAfter, executed, cancelled] = withdrawalResults[i]
      if (executed || cancelled) continue
      pendingWithdrawals.push({
        withdrawalId: i,
        to,
        amountUsdc: usdcFromUnits(amount),
        executeAfter: new Date(Number(executeAfter) * 1000).toISOString(),
        executed,
        cancelled,
        ready: Number(executeAfter) <= now,
      })
    }
  }

  const openPositions = positions.filter(p => !p.closed)
  const activePrincipal = openPositions.reduce((sum, p) => sum + p.amountUsdc, 0)
  const uniqueStakers = new Set(openPositions.map(p => p.user)).size

  return {
    configured: true as const,
    contractAddress: address,
    summary: {
      totalStakedUsdc: usdcFromUnits(totalStaked),
      activePrincipalUsdc: activePrincipal,
      aaveBalanceUsdc: usdcFromUnits(aaveBalance),
      totalAssetsUsdc: usdcFromUnits(totalAssets),
      idleBalanceUsdc: usdcFromUnits(idleBalance),
      penaltyPoolUsdc: usdcFromUnits(penaltyPool),
      excessAaveUsdc: usdcFromUnits(excessAaveUsdc),
      minStakeUsdc: usdcFromUnits(minStake),
      openPositionCount: openPositions.length,
      totalPositionCount: positions.length,
      uniqueStakerCount: uniqueStakers,
      owner: owner.toLowerCase(),
      aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    },
    positions: positions.sort((a, b) => b.positionId - a.positionId),
    pendingWithdrawals,
  }
}
